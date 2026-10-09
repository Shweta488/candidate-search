import { json, withRecruiter } from "@/server/http";
import { getVocabulary } from "@/server/search/vocabulary";

export const runtime = "nodejs";

// The allowed values for the filter editor (LLD 1.7).
export const GET = withRecruiter(async () => json(await getVocabulary()));
