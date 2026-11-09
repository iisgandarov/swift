import { withAuth, json } from "@/lib/server/api";
import { decryptToken } from "@/lib/google/crypto";
import { revokeToken } from "@/lib/google/oauth";
import { forgetAccessToken } from "@/lib/google/client";

/** Revokes Swift's access and forgets the token. Events already in Google stay there. */
export const POST = withAuth(async (ctx) => {
  const conn = await ctx.repo.getGoogleConnection();
  if (conn && !ctx.demo) {
    try {
      await revokeToken(decryptToken(conn.refresh_token_encrypted));
    } catch {
      /* token unreadable or already revoked */
    }
  }
  await ctx.repo.deleteGoogleConnection();
  forgetAccessToken(ctx.user.id);
  return json({ ok: true });
});
