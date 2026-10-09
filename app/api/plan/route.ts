import { getPlan } from "@/server/plan";
import { json, withRecruiter } from "@/server/http";

export const runtime = "nodejs";

export const GET = withRecruiter(async (_request, { recruiter }) => json(await getPlan(recruiter.companyId)));
