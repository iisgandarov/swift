import type { Category } from "@/lib/domain/types";
import { categoryName, categoryStyle } from "@/lib/client/display";
import type { UiLocale } from "@/lib/dates";
import { cn } from "@/lib/cn";

export function CategoryChip({ category, locale, className }: { category: Category; locale: UiLocale; className?: string }) {
  const s = categoryStyle(category.color);
  return (
    <span
      className={cn("inline-flex h-7 max-w-[9rem] items-center truncate rounded-full px-3 text-[13px] font-medium", className)}
      style={{ background: s.chipBg, color: s.chipText }}
    >
      <span className="truncate">{categoryName(category, locale)}</span>
    </span>
  );
}
