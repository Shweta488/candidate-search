import { json, noContent, readJson, withRecruiter } from "@/server/http";
import { deleteShortlist, getShortlist, renameShortlist, ShortlistName } from "@/server/shortlists";

export const runtime = "nodejs";

type Params = { id: string };

export const GET = withRecruiter<Params>(async (_request, { recruiter, params }) =>
  json(await getShortlist(recruiter, params.id)),
);

export const PATCH = withRecruiter<Params>(async (request, { recruiter, params }) => {
  const body = await readJson(request, ShortlistName);
  return json(await renameShortlist(recruiter, params.id, body.name));
});

export const DELETE = withRecruiter<Params>(async (_request, { recruiter, params }) => {
  await deleteShortlist(recruiter, params.id);
  return noContent();
});
