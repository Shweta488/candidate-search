"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import type { PlanResponse } from "@/shared/types";
import type { ApiError } from "./api";
import { useApiQuery } from "./useApiQuery";

// The plan and searches left, shown in the header on every page (LLD 6.4).
// Reloaded when the window regains focus, which picks up an upgrade made elsewhere.

type PlanValue = { plan: PlanResponse | undefined; loading: boolean; error: ApiError | undefined; reload: () => void };

const PlanContext = createContext<PlanValue | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, error, reload } = useApiQuery<PlanResponse>("/api/plan");

  useEffect(() => {
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [reload]);

  const value = useMemo(() => ({ plan: data, loading, error, reload }), [data, loading, error, reload]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanValue {
  const value = useContext(PlanContext);
  if (!value) throw new Error("usePlan must be used inside PlanProvider");
  return value;
}
