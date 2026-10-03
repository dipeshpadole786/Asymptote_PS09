import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FarmProfile, Session } from "../types/farm";
import { clamp } from "../utils/number";

type FarmContextValue = {
  session: Session | null;
  profile: FarmProfile | null;
  demoMode: boolean;
  demoMoisture: number;
  signIn: (contact: string) => void;
  signOut: () => void;
  saveProfile: (profile: FarmProfile) => void;
  setDemoMode: (enabled: boolean) => void;
  setDemoMoisture: (moisture: number) => void;
};

const FarmContext = createContext<FarmContextValue | null>(null);

export function FarmProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<FarmProfile | null>(null);
  const [demoMode, setDemoModeState] = useState(true);
  const [demoMoisture, setDemoMoistureState] = useState(42);

  const signIn = useCallback((contact: string) => {
    setSession({ contact });
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
  }, []);

  const saveProfile = useCallback((next: FarmProfile) => {
    setProfile(next);
  }, []);

  const setDemoMode = useCallback((enabled: boolean) => {
    setDemoModeState(enabled);
  }, []);

  const setDemoMoisture = useCallback((moisture: number) => {
    setDemoMoistureState(clamp(Math.round(moisture), 0, 100));
  }, []);

  const value = useMemo(
    () => ({
      session,
      profile,
      demoMode,
      demoMoisture,
      signIn,
      signOut,
      saveProfile,
      setDemoMode,
      setDemoMoisture,
    }),
    [
      session,
      profile,
      demoMode,
      demoMoisture,
      signIn,
      signOut,
      saveProfile,
      setDemoMode,
      setDemoMoisture,
    ],
  );

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm(): FarmContextValue {
  const value = useContext(FarmContext);
  if (!value) {
    throw new Error("useFarm must be used within FarmProvider");
  }
  return value;
}
