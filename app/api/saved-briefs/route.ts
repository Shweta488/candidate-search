import { json, readJson, withRecruiter } from "@/server/http";
import { listSavedBriefs, saveBrief, SavedBriefBody } from "@/server/savedBriefs";

export const runtime = "nodejs";

export const GET = withRecruiter(async (_request, { recruiter }) =>
  json({ saved_briefs: await listSavedBriefs(recruiter) }),
);

export const POST = withRecruiter(async (request, { recruiter }) => {
  const body = await readJson(request, SavedBriefBody);
  return json(await saveBrief(recruiter, body), 201);
});
