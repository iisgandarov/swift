import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";

export default async function PrivatePage({ searchParams }: PageProps<"/private">) {
  const t = await getTranslations("auth");
  const { email } = await searchParams;
  const shown = typeof email === "string" && email.includes("@") ? email : null;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-chip text-accent">
        <Lock className="size-7" aria-hidden />
      </div>
      <h1 className="text-2xl font-bold">{t("privateTitle")}</h1>
      <p className="mt-3 text-muted">{t("privateBody")}</p>
      {shown && <p className="mt-3 rounded-full bg-chip px-4 py-1.5 text-sm font-medium">{shown}</p>}
      <form action="/auth/signout" method="post" className="mt-8">
        <button className="btn-primary h-12 rounded-full px-6 font-semibold">{t("tryAnother")}</button>
      </form>
    </main>
  );
}
