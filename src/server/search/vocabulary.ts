import "server-only";
import type { Vocabulary } from "@/shared/types";
import { serverClient } from "../supabase";

// The allowed filter values (LLD 3.2), loaded once per server process. The candidates
// only change when the database is re-seeded, which also means restarting make dev.

let cached: Promise<Vocabulary> | undefined;

export function getVocabulary(): Promise<Vocabulary> {
  if (!cached) {
    cached = load().catch((error: unknown) => {
      cached = undefined; // try again on the next request
      throw error;
    });
  }
  return cached;
}

async function load(): Promise<Vocabulary> {
  const { data, error } = await serverClient().schema("private").rpc("get_vocabulary");
  if (error) throw error;
  return data as Vocabulary;
}
