import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useAuth } from "@/context/AuthContext";

// Typed react-query hooks for the claims API. Kept intentionally close to the
// server shape so this can be swapped for generated hooks (openapi.yaml) later
// without touching call sites.

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export type ClaimStatus =
  | "draft"
  | "submitted"
  | "airline_responded"
  | "paid"
  | "rejected"
  | "escalated"
  | "closed";

export interface TimelineEntry {
  status: ClaimStatus;
  at: string;
  note?: string;
}

export interface Claim {
  id: number;
  userId: number;
  disruptionId: number;
  airline: string;
  flightNumber: string;
  amount: number | null;
  currency: string;
  status: ClaimStatus;
  referenceNumber: string | null;
  letter: string;
  timeline: TimelineEntry[];
  amountReceived: number | null;
  submittedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimPatch {
  status?: ClaimStatus;
  referenceNumber?: string;
  amountReceived?: number;
  note?: string;
}

export const claimsQueryKey = ["claims"] as const;
export const claimQueryKey = (id: number) => ["claims", id] as const;

function useClaimsFetch() {
  const { token } = useAuth();
  return useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const res = await fetch(`${API_BASE}/api/claims${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init?.headers ?? {}),
        },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Request failed. Check your connection and try again.");
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    },
    [token],
  );
}

export function useClaims() {
  const cf = useClaimsFetch();
  const { token } = useAuth();
  return useQuery({
    queryKey: claimsQueryKey,
    queryFn: () => cf<Claim[]>(""),
    enabled: !!token,
  });
}

export function useClaim(id: number) {
  const cf = useClaimsFetch();
  const { token } = useAuth();
  return useQuery({
    queryKey: claimQueryKey(id),
    queryFn: () => cf<Claim>(`/${id}`),
    enabled: !!token && Number.isInteger(id) && id > 0,
  });
}

/** Create (or fetch the existing) claim for a disruption. Idempotent server-side. */
export function useCreateClaim() {
  const cf = useClaimsFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (disruptionId: number) =>
      cf<Claim>("", { method: "POST", body: JSON.stringify({ disruptionId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: claimsQueryKey }),
  });
}

export function useUpdateClaim(id: number) {
  const cf = useClaimsFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ClaimPatch) =>
      cf<Claim>(`/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: (claim) => {
      qc.setQueryData(claimQueryKey(id), claim);
      qc.invalidateQueries({ queryKey: claimsQueryKey });
    },
  });
}
