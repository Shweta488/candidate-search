"use client";

import { useCallback, useEffect, useState } from "react";
import { api, toApiError, type ApiError } from "./api";

// Loads one GET endpoint (LLD 6.4). Keeps the last data while reloading, so the UI does not flicker.

type Result<T> = { key: string; data?: T; error?: ApiError };

export function useApiQuery<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const key = path === null ? null : `${path}#${version}`;

  useEffect(() => {
    if (path === null || key === null) return;
    let active = true;
    api.get<T>(path).then(
      (data) => active && setResult({ key, data }),
      (error: unknown) => active && setResult({ key, error: toApiError(error) }),
    );
    return () => {
      active = false;
    };
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const current = result?.key === key ? result : null;
  return { data: result?.data, error: current?.error, loading: key !== null && current === null, reload };
}
