import Image from "next/image";
import { getTranslations } from "next-intl/server";

export async function BrandHero() {
  const t = await getTranslations("app");
  return (
    <div className="flex flex-col items-center text-center">
      <Image src="/icons/swift-logo-256.png" alt="Swift" width={96} height={96} priority className="rounded-[26px] shadow-[var(--shadow-float)]" />
      <h1 className="mt-6 text-4xl font-bold tracking-tight">Swift</h1>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.35em] text-muted">{t("subtitle")}</p>
      <p className="mt-4 text-muted">{t("subline")}</p>
    </div>
  );
}
