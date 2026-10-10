import { z } from "zod";
import { json, parseParams, withRecruiter } from "@/server/http";
import { getSearchPage } from "@/server/search/getSearchPage";

export const runtime = "nodejs";

// page: a whole number from 1, default 1. A page past the end returns no results.
const PageQuery = z.object({
  page: z
    .string()
    .regex(/^\d+$/, "must be a whole number")
    .transform(Number)
    .pipe(z.number().int().min(1, "must be 1 or more").max(1_000_000))
    .default(1),
});

export const GET = withRecruiter<{ id: string }>(async (request, { recruiter, params }) => {
  const page = new URL(request.url).searchParams.get("page");
  const query = parseParams({ page: page ?? undefined }, PageQuery);
  return json(await getSearchPage(recruiter, params.id, query.page));
});
