import { json, withRecruiter } from "@/server/http";
import { getCandidate } from "@/server/people";

export const runtime = "nodejs";

export const GET = withRecruiter<{ id: string }>(async (_request, { recruiter, params }) =>
  json(await getCandidate(recruiter, params.id)),
);
