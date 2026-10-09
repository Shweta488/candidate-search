import "server-only";
import { requireRecruiter, type Recruiter } from "./auth";
import { toErrorResponse } from "./errors";
import { logRequest } from "./log";

// The shape every recruiter route follows (LLD 4.3): auth, read input, call one service,
// return. Errors and the request log are handled here once.

type Params = Record<string, string | string[] | undefined>;

export type RecruiterContext<P extends Params> = { recruiter: Recruiter; params: P; requestId: string };

export function withRecruiter<P extends Params = Record<string, never>>(
  handler: (request: Request, context: RecruiterContext<P>) => Promise<Response>,
) {
  return async (request: Request, route: { params: Promise<P> }): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const started = performance.now();
    let companyId: string | null = null;
    let response: Response;
    try {
      const recruiter = await requireRecruiter(request);
      companyId = recruiter.companyId;
      response = await handler(request, { recruiter, params: await route.params, requestId });
    } catch (error) {
      response = toErrorResponse(error, requestId);
    }
    logRequest({
      request_id: requestId,
      method: request.method,
      route: new URL(request.url).pathname,
      status: response.status,
      ms: Math.round(performance.now() - started),
      company_id: companyId,
    });
    return response;
  };
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}
