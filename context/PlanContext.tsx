import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFarm } from "./FarmContext";
import { buildFarmPlan, type FarmPlan } from "../logic/plannerLogic";
import {
  explainPlan,
  isGrokConfigured,
  type GrokPlanInput,
} from "../services/grokService";
import { getSoilMoisture, type MoistureReading } from "../services/sensorService";
import { getSoilData, type SoilData } from "../services/soilService";
import { getWeather, type WeatherReport } from "../services/weatherService";
import { cropById, stageLabel, type FarmProfile } from "../types/farm";

export type AdvisorState =
  | { status: "off" }
  | { status: "loading" }
  | { status: "ready"; summary: string; daily: string[] }
  | { status: "error" };

type LoadStatus = "idle" | "loading" | "ready" | "error";

type PlanContextValue = {
  status: LoadStatus;
  error: string | null;
  weather: WeatherReport | null;
  soil: SoilData | null;
  moisture: MoistureReading;
  plan: FarmPlan | null;
  advisor: AdvisorState;
  refresh: () => void;
};

const UNAVAILABLE: MoistureReading = {
  moisture: null,
  source: "unavailable",
  label: "Sensor unavailable",
};

const PlanContext = createContext<PlanContextValue | null>(null);

function toGrokInput(
  profile: FarmProfile,
  soil: SoilData,
  moisture: MoistureReading,
  plan: FarmPlan,
): GrokPlanInput {
  return {
    crop: cropById(profile.crop).name,
    cropStage: stageLabel(profile.stage),
    soil: {
      soilType: soil.soilType,
      drainage: soil.drainage,
      fieldCapacity: soil.fieldCapacity,
      moistureBaseline: soil.moistureBaseline,
      soilTemperature: soil.soilTemperature,
      source: soil.source,
    },
    soilMoisture: moisture.moisture,
    moistureSource: moisture.source,
    sevenDayWeather: plan.days.map((day) => ({
      day: day.weekday,
      temperatureMax: day.temperatureMax,
      humidity: day.humidityMean,
      rainProbability: day.rainProbability,
      rainfallMm: day.rainfallMm,
      windSpeed: day.windSpeed,
    })),
    irrigationDecisions: plan.days.map((day) => ({
      day: day.weekday,
      motor: day.irrigation.motor,
      reason: day.irrigation.reason,
    })),
    sprayDecisions: plan.days.map((day) => ({
      day: day.weekday,
      advice: day.spray.label,
      reason: day.spray.reason,
    })),
  };
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const { session, profile, demoMode, demoMoisture } = useFarm();
  const latitude = profile?.place.latitude;
  const longitude = profile?.place.longitude;
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherReport | null>(null);
  const [soil, setSoil] = useState<SoilData | null>(null);
  const [sensor, setSensor] = useState<MoistureReading | null>(null);
  const [advisor, setAdvisor] = useState<AdvisorState>({ status: "off" });
  const request = useRef(0);
  const weatherRef = useRef<WeatherReport | null>(null);
  const demoRef = useRef({ demoMode, demoMoisture });
  demoRef.current = { demoMode, demoMoisture };

  const refresh = useCallback(async () => {
    if (latitude == null || longitude == null) {
      return;
    }
    const id = request.current + 1;
    request.current = id;
    setStatus("loading");
    setError(null);
    try {
      const demo = demoRef.current;
      const [nextWeather, nextSoil, nextSensor] = await Promise.all([
        getWeather(latitude, longitude),
        getSoilData(latitude, longitude),
        getSoilMoisture({ demoMode: demo.demoMode, demoMoisture: demo.demoMoisture }),
      ]);
      if (request.current !== id) {
        return;
      }
      const mergedSoil: SoilData = {
        ...nextSoil,
        soilTemperature: nextWeather.current.soilTemperature,
      };
      weatherRef.current = nextWeather;
      setWeather(nextWeather);
      setSoil(mergedSoil);
      setSensor(nextSensor);
      setStatus("ready");
    } catch (err) {
      if (request.current !== id) {
        return;
      }
      const message = err instanceof Error ? err.message : "Could not load weather.";
      setError(message);
      setStatus(weatherRef.current ? "ready" : "error");
    }
  }, [latitude, longitude]);

  useEffect(() => {
    if (!session || latitude == null || longitude == null) {
      return;
    }
    weatherRef.current = null;
    setWeather(null);
    setSoil(null);
    setError(null);
    setStatus("loading");
    void refresh();
  }, [session, latitude, longitude, refresh]);

  useEffect(() => {
    if (!profile || demoMode) {
      return;
    }
    let cancelled = false;
    void getSoilMoisture({ demoMode: false, demoMoisture: 0 }).then((reading) => {
      if (!cancelled) {
        setSensor(reading);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [demoMode, profile]);

  const weatherForPlace =
    weather &&
    latitude != null &&
    longitude != null &&
    weather.requestedLatitude === latitude &&
    weather.requestedLongitude === longitude
      ? weather
      : null;

  const soilForPlace = weatherForPlace ? soil : null;

  const moisture = useMemo<MoistureReading>(() => {
    if (sensor?.source === "iot") {
      return sensor;
    }
    if (demoMode) {
      return {
        moisture: Math.max(0, Math.min(100, Math.round(demoMoisture))),
        source: "demo",
        label: "DEMO sensor",
      };
    }
    if (sensor && sensor.source !== "demo") {
      return sensor;
    }
    return UNAVAILABLE;
  }, [sensor, demoMode, demoMoisture]);

  const plan = useMemo(() => {
    if (!weatherForPlace || !soilForPlace || !profile) {
      return null;
    }
    return buildFarmPlan({
      weather: weatherForPlace,
      soil: soilForPlace,
      moisture,
      crop: profile.crop,
      stage: profile.stage,
    });
  }, [weatherForPlace, soilForPlace, moisture, profile]);

  useEffect(() => {
    if (!weatherForPlace || !soilForPlace || !profile || !plan) {
      setAdvisor({ status: "off" });
      return;
    }
    if (!isGrokConfigured()) {
      setAdvisor({ status: "off" });
      return;
    }
    let cancelled = false;
    setAdvisor({ status: "loading" });
    void explainPlan(toGrokInput(profile, soilForPlace, moisture, plan)).then((result) => {
      if (cancelled) {
        return;
      }
      setAdvisor(
        result
          ? { status: "ready", summary: result.summary, daily: result.daily }
          : { status: "error" },
      );
    });
    return () => {
      cancelled = true;
    };
    // Moisture slider must not call Grok again. Decisions already update on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherForPlace, soilForPlace, profile]);

  const value = useMemo(
    () => ({
      status,
      error,
      weather: weatherForPlace,
      soil: soilForPlace,
      moisture,
      plan,
      advisor,
      refresh,
    }),
    [status, error, weatherForPlace, soilForPlace, moisture, plan, advisor, refresh],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const value = useContext(PlanContext);
  if (!value) {
    throw new Error("usePlan must be used within PlanProvider");
  }
  return value;
}
