import { useTranslations } from "next-intl";
import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";

// Milestone 1 placeholder: real Home (greeting, filters, list) lands in milestone 3.
export default function HomePage() {
  const t = useTranslations();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="space-y-2">
          <p className="text-sm text-muted">{t("greeting.morning")}</p>
          <Skeleton className="h-5 w-28" />
        </div>
      </div>
      <div className="chrome flex gap-2 overflow-x-auto no-scrollbar">
        {(["all", "today", "upcoming", "completed"] as const).map((k, i) => (
          <span
            key={k}
            className={
              i === 0
                ? "shrink-0 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
                : "shrink-0 whitespace-nowrap rounded-full bg-chip px-4 py-2 text-sm font-medium text-chip-fg"
            }
          >
            {t(`filter.${k}`)}
          </span>
        ))}
      </div>
      <section>
        <h2 className="mb-3 text-xl font-bold">{t("home.today")}</h2>
        <ListSkeleton />
      </section>
    </div>
  );
}
