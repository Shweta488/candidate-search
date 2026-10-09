import "server-only";
import { z } from "zod";

// A search brief, as sent with a search or a saved search (LLD 1.3).
// Postgres can't store the NUL character in text, so it is removed first.
export const Brief = z
  .string()
  .transform((brief) => brief.replaceAll("\u0000", ""))
  .pipe(z.string().trim().min(1).max(500));
