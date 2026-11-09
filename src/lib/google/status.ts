import "server-only";
import type { GoogleStatus } from "@/lib/domain/types";
import type { AppContext } from "@/lib/server/context";
import { googleConfigured } from "@/lib/server/env";

export async function getGoogleStatus(ctx: AppContext): Promise<GoogleStatus> {
  const configured = googleConfigured() || ctx.demo;
  const conn = configured ? await ctx.repo.getGoogleConnection() : null;
  return {
    configured,
    connected: Boolean(conn),
    email: conn?.google_email ?? null,
    calendar_id: conn?.calendar_id ?? null,
    needs_reconnect: conn?.needs_reconnect ?? false,
    last_error: conn?.last_error ?? null,
  };
}
