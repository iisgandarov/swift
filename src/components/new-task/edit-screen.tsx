"use client";

import { AppLink as Link } from "@/components/shell/app-link";
import { useTranslations } from "next-intl";
import { useItems } from "@/lib/client/queries";
import { useAppSettings } from "@/hooks/use-app-settings";
import { ListSkeleton } from "@/components/ui/skeleton";
import { formFromItem, ItemForm } from "./item-form";
import { FormFrame } from "./form-frame";

export function EditScreen({ id, makeEvent }: { id: string; makeEvent: boolean }) {
  const t = useTranslations();
  const { tz } = useAppSettings();
  const { data: items, isPending } = useItems();
  const item = items?.find((i) => i.id === id);

  if (!item) {
    return (
      <FormFrame>
        {isPending ? (
          <ListSkeleton rows={5} />
        ) : (
          <div className="py-16 text-center">
            <p className="text-muted">{t("error.generic")}</p>
            <Link href="/" className="mt-4 inline-block font-semibold text-accent">
              {t("nav.home")}
            </Link>
          </div>
        )}
      </FormFrame>
    );
  }
  const initial = formFromItem(item, tz);
  if (makeEvent) initial.type = "event";
  return (
    <FormFrame>
      <ItemForm key={item.id} item={item} initial={initial} openTimeOnMount={makeEvent && !initial.start} />
    </FormFrame>
  );
}
