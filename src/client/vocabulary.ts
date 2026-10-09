"use client";

import { useEffect, useState } from "react";
import type { Vocabulary } from "@/shared/types";
import { api, toApiError, type ApiError } from "./api";

// The allowed filter values (LLD 6.4): fetched the first time the filter editor opens,
// then kept for the rest of the visit.

let cached: Promise<Vocabulary> | undefined;

function loadVocabulary(): Promise<Vocabulary> {
  cached ??= api.get<Vocabulary>("/api/vocabulary").catch((error: unknown) => {
    cached = undefined; // try again next time
    throw error;
  });
  return cached;
}

export function useVocabulary(): { vocabulary?: Vocabulary; error?: ApiError } {
  const [state, setState] = useState<{ vocabulary?: Vocabulary; error?: ApiError }>({});
  useEffect(() => {
    let active = true;
    loadVocabulary().then(
      (vocabulary) => active && setState({ vocabulary }),
      (error: unknown) => active && setState({ error: toApiError(error) }),
    );
    return () => {
      active = false;
    };
  }, []);
  return state;
}
