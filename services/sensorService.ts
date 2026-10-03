import { clamp, readNumber } from "../utils/number";

export type MoistureSource = "iot" | "demo" | "unavailable";

export type MoistureReading = {
  moisture: number | null;
  source: MoistureSource;
  label: string;
};

type SensorBody = {
  moisture?: unknown;
  soilMoisture?: unknown;
};

function readEnv(name: string): string | undefined {
  const env = process.env as Record<string, string | undefined>;
  const value = env[name];
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Optional device endpoint. Expected JSON: { "moisture": 42 }. */
export function iotSensorUrl(): string | undefined {
  return readEnv("EXPO_PUBLIC_IOT_SENSOR_URL");
}

/**
 * Live sensor first. Demo moisture only when demo mode is on.
 * A failed device never gets labeled as a real IoT reading.
 */
export async function getSoilMoisture(options: {
  demoMode: boolean;
  demoMoisture: number;
}): Promise<MoistureReading> {
  const url = iotSensorUrl();
  if (url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) {
        const body = (await response.json()) as SensorBody;
        const moisture = readNumber(body.moisture ?? body.soilMoisture, Number.NaN);
        if (Number.isFinite(moisture)) {
          return {
            moisture: clamp(Math.round(moisture), 0, 100),
            source: "iot",
            label: "IoT sensor",
          };
        }
      }
    } catch {
      // Fall through to demo or unavailable.
    } finally {
      clearTimeout(timer);
    }
  }

  if (options.demoMode) {
    return {
      moisture: clamp(Math.round(options.demoMoisture), 0, 100),
      source: "demo",
      label: "DEMO sensor",
    };
  }

  return {
    moisture: null,
    source: "unavailable",
    label: "Sensor unavailable",
  };
}
