import { json, readJson, withRecruiter } from "@/server/http";
import { runSearch, SearchBody } from "@/server/search/runSearch";

export const runtime = "nodejs";

export const POST = withRecruiter(async (request, { recruiter, requestId }) => {
  const body = await readJson(request, SearchBody);
  return json(await runSearch(recruiter, body, requestId));
});
