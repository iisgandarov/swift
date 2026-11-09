import { withAuth, json } from "@/lib/server/api";
import { ensureUserSetup } from "@/lib/server/context";
import { getGoogleStatus } from "@/lib/google/status";

/** Everything the client needs on start: user, profile, categories, Google status. */
export const GET = withAuth(async (ctx) => {
  const profile = await ensureUserSetup(ctx);
  const [categories, google] = await Promise.all([ctx.repo.listCategories(), getGoogleStatus(ctx)]);
  return json({ user: { email: ctx.user.email, name: ctx.user.name }, profile, categories, google, demo: ctx.demo });
});
