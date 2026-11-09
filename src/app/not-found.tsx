import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl font-bold text-primary dark:text-secondary">404</p>
      <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-full bg-primary px-6 font-semibold text-white">
        {t("nav.home")}
      </Link>
    </main>
  );
}
