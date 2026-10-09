import { json, withRecruiter } from "@/server/http";
import { getCandidate } from "@/server/people";

export const runtime = "nodejs";

export const GET = withRecruiter<{ id: string }>(async (_request, { params }) => json(await getCandidate(params.id)));
