import { json, noContent, withRecruiter } from "@/server/http";
import { addMember, removeMember } from "@/server/shortlists";

export const runtime = "nodejs";

type Params = { id: string; personId: string };

export const POST = withRecruiter<Params>(async (_request, { recruiter, params }) =>
  json(await addMember(recruiter, params.id, params.personId)),
);

export const DELETE = withRecruiter<Params>(async (_request, { recruiter, params }) => {
  await removeMember(recruiter, params.id, params.personId);
  return noContent();
});
