import { json, readJson, withRecruiter } from "@/server/http";
import { createShortlist, listShortlists, ShortlistName } from "@/server/shortlists";

export const runtime = "nodejs";

export const GET = withRecruiter(async (_request, { recruiter }) =>
  json({ shortlists: await listShortlists(recruiter) }),
);

export const POST = withRecruiter(async (request, { recruiter }) => {
  const body = await readJson(request, ShortlistName);
  return json(await createShortlist(recruiter, body.name), 201);
});
