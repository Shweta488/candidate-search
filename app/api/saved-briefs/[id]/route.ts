import { noContent, withRecruiter } from "@/server/http";
import { deleteSavedBrief } from "@/server/savedBriefs";

export const runtime = "nodejs";

type Params = { id: string };

export const DELETE = withRecruiter<Params>(async (_request, { recruiter, params }) => {
  await deleteSavedBrief(recruiter, params.id);
  return noContent();
});
