import { customFetch } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import type { Tier } from "@/constants/tiers";
import { useAuth } from "@/context/AuthContext";

export interface SubscriptionState {
  tier: Tier;
  isLoading: boolean;
  refresh: () => void;
}

export function useSubscription(): SubscriptionState {
  const { token } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["stripe", "tier"],
    queryFn: async () => {
      try {
        return await customFetch<{ tier: Tier }>("/api/stripe/tier");
      } catch {
        return { tier: "free" as Tier };
      }
    },
    enabled: !!token,
    staleTime: 60_000,
    retry: false,
  });

  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        void qc.invalidateQueries({ queryKey: ["stripe", "tier"] });
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [qc]);

  const refresh = () => void qc.invalidateQueries({ queryKey: ["stripe", "tier"] });

  return { tier: data?.tier ?? "free", isLoading, refresh };
}

export interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  tier: string;
  prices: Array<{
    id: string;
    unitAmount: number;
    currency: string;
    interval: string | null;
    intervalCount: number | null;
  }>;
}

export function useStripeProducts() {
  return useQuery({
    queryKey: ["stripe", "products"],
    queryFn: async () => {
      try {
        return await customFetch<{ products: StripeProduct[] }>("/api/stripe/products");
      } catch {
        return { products: [] as StripeProduct[] };
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}
