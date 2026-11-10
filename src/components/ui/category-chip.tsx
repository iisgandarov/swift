import type { Category } from "@/lib/domain/types";
import { categoryName, categoryStyle } from "@/lib/client/display";
import type { UiLocale } from "@/lib/dates";
import { cn } from "@/lib/cn";

export function CategoryChip({
  category,
  locale,
  className,
  size = "md",
}: {
  category: Category;
  locale: UiLocale;
  className?: string;
  /** sm: inline with other 13 px meta text (task cards) */
  size?: "sm" | "md";
}) {
  const s = categoryStyle(category.color);
  return (
    <span
      className={cn(
        "inline-flex items-center truncate rounded-full font-medium",
        size === "sm" ? "h-5 max-w-[8rem] px-2 text-[13px] leading-5" : "h-7 max-w-[9rem] px-3 text-[13px]",
        className,
      )}
      style={{ background: s.chipBg, color: s.chipText }}
    >
      <span className="truncate">{categoryName(category, locale)}</span>
    </span>
  );
}
