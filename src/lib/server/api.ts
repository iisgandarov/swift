import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { RuleError } from "@/lib/domain/rules";
import { getAppContext, type AppContext } from "./context";
import { NotFoundError } from "./repo";
import { timingFor } from "./timing";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

type Handler<P> = (ctx: AppContext, req: NextRequest, params: P) => Promise<Response>;

/** Wraps a route handler: requires an allowed signed-in user and maps errors to JSON responses. */
export function withAuth<P = Record<string, never>>(fn: Handler<P>) {
  return async (req: NextRequest, segment: { params: Promise<P> }) => {
    const timing = timingFor(req);
    let res: Response;
    try {
      const ctx = await timing.time("auth", getAppContext());
      res = ctx ? await fn(ctx, req, await segment.params) : json({ error: "unauthorized" }, 401);
    } catch (err) {
      res = errorResponse(err);
    }
    try {
      res.headers.set("server-timing", timing.header());
    } catch {
      /* immutable headers (e.g. a proxied response): timing is optional */
    }
    return res;
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof ZodError) return json({ error: "invalid_input", issues: err.issues }, 400);
  if (err instanceof RuleError) return json({ error: err.code }, 422);
  if (err instanceof NotFoundError) return json({ error: "not_found" }, 404);
  if (err instanceof HttpError) return json({ error: err.code, message: err.message }, err.status);
  console.error("[api]", err);
  return json({ error: "server_error" }, 500);
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}
