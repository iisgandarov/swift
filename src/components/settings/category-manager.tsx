"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { CATEGORY_COLORS, type Category, type CategoryColor } from "@/lib/domain/types";
import { categoryName, categoryStyle } from "@/lib/client/display";
import { useCategories, useCategoryMutations } from "@/lib/client/queries";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Draft = { id: string | null; name_az: string; name_en: string; color: CategoryColor };

export function CategoryManager() {
  const t = useTranslations();
  const locale = useLocale() as "az" | "en";
  const categories = useCategories();
  const m = useCategoryMutations();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const move = (i: number, dir: -1 | 1) => {
    const order = categories.map((c) => c.id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    m.reorder.mutate(order);
  };

  const edit = (c: Category) => {
    setConfirmDelete(false);
    setDraft({ id: c.id, name_az: c.name_az, name_en: c.name_en, color: c.color });
  };

  const save = () => {
    if (!draft) return;
    const input = { name_az: draft.name_az.trim(), name_en: draft.name_en.trim() || draft.name_az.trim(), color: draft.color };
    if (draft.id) m.update.mutate({ id: draft.id, patch: input });
    else m.create.mutate(input);
    setDraft(null);
  };

  return (
    <div>
      <ul className="divide-y divide-divider">
        {categories.map((c, i) => (
          <li key={c.id} className="flex min-h-14 items-center gap-2">
            <button type="button" onClick={() => edit(c)} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left">
              <span aria-hidden className="size-3.5 shrink-0 rounded-full" style={{ background: categoryStyle(c.color).dot }} />
              <span className="truncate text-[16px]">{categoryName(c, locale)}</span>
              {c.name_az !== c.name_en && <span className="truncate text-sm text-muted">· {categoryName(c, locale === "az" ? "en" : "az")}</span>}
            </button>
            <button type="button" aria-label="↑" disabled={i === 0} onClick={() => move(i, -1)} className="flex size-10 items-center justify-center rounded-full text-muted disabled:opacity-30">
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button type="button" aria-label="↓" disabled={i === categories.length - 1} onClick={() => move(i, 1)} className="flex size-10 items-center justify-center rounded-full text-muted disabled:opacity-30">
              <ArrowDown className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" className="mt-3" onClick={() => setDraft({ id: null, name_az: "", name_en: "", color: "blue" })}>
        <Plus className="size-4" aria-hidden />
        {t("settings.addCategory")}
      </Button>

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? t("action.edit") : t("settings.addCategory")}
        footer={
          <div className="flex gap-3">
            {draft?.id &&
              (confirmDelete ? (
                <Button
                  variant="danger"
                  onClick={() => {
                    m.remove.mutate(draft.id!);
                    setDraft(null);
                  }}
                >
                  {t("confirmDelete.title")}
                </Button>
              ) : (
                <Button variant="secondary" aria-label={t("action.delete")} onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4 text-danger" aria-hidden />
                </Button>
              ))}
            <Button className="flex-1" onClick={save} disabled={!draft?.name_az.trim()}>
              {t("action.save")}
            </Button>
          </div>
        }
      >
        {draft && (
          <div className="space-y-4">
            {(["name_az", "name_en"] as const).map((k) => (
              <label key={k} className="block">
                <span className="mb-1.5 block text-sm text-muted">{k === "name_az" ? t("settings.nameAz") : t("settings.nameEn")}</span>
                <input
                  value={draft[k]}
                  maxLength={40}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                  className="h-12 w-full rounded-2xl border border-line bg-surface-2 px-4"
                />
              </label>
            ))}
            <div>
              <span className="mb-2 block text-sm text-muted">{t("settings.color")}</span>
              <div role="radiogroup" aria-label={t("settings.color")} className="flex flex-wrap gap-3">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={draft.color === c}
                    aria-label={c}
                    onClick={() => setDraft({ ...draft, color: c })}
                    className={cn("size-10 rounded-full ring-offset-2 ring-offset-surface", draft.color === c && "ring-2 ring-primary")}
                    style={{ background: categoryStyle(c).dot }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
