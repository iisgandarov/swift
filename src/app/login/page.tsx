import { getTranslations } from "next-intl/server";
import { BrandHero } from "@/components/auth/brand-hero";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { isDemoMode } from "@/lib/server/env";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations();
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-between px-6 pt-[calc(var(--safe-top)+15vh)] pb-[calc(var(--safe-bottom)+32px)]">
      <BrandHero />
      <div className="w-full space-y-6">
        {error && (
          <p role="alert" className="text-center text-sm text-danger">
            {error === "setup" ? t("auth.setupError") : t("auth.error")}
          </p>
        )}
        <GoogleSignIn demo={isDemoMode()} />
        <p className="text-center text-sm font-semibold text-primary dark:text-secondary">{t("app.tagline")}</p>
      </div>
    </main>
  );
}
