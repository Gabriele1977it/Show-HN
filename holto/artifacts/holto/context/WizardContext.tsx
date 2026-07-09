import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

export type DisruptionType =
  | "delay"
  | "cancellation"
  | "missed_connection"
  | "denied_boarding";

export interface WizardData {
  disruptionType: DisruptionType | null;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  scheduledAt: string;
  details: string;
}

interface WizardContextValue {
  step: number;
  data: WizardData;
  totalSteps: number;
  setStep: (step: number) => void;
  updateData: (partial: Partial<WizardData>) => void;
  reset: () => void;
}

const INITIAL: WizardData = {
  disruptionType: null,
  airline: "",
  flightNumber: "",
  origin: "",
  destination: "",
  scheduledAt: "",
  details: "",
};

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL);
  const totalSteps = 6;

  const updateData = useCallback((partial: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => {
    setStep(0);
    setData(INITIAL);
  }, []);

  return (
    <WizardContext.Provider value={{ step, data, totalSteps, setStep, updateData, reset }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
}
