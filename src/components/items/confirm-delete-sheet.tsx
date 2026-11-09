"use client";

import { useTranslations } from "next-intl";
import type { Item } from "@/lib/domain/types";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function ConfirmDeleteSheet({ item, onClose, onConfirm }: { item: Item | null; onClose: () => void; onConfirm: (item: Item) => void }) {
  const t = useTranslations();
  const synced = item?.type === "event" && Boolean(item.google_event_id);
  return (
    <Sheet
      open={item !== null}
      onClose={onClose}
      title={t("confirmDelete.title")}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button variant="danger" className="flex-1" onClick={() => item && onConfirm(item)} data-testid="confirm-delete">
            {t("action.delete")}
          </Button>
        </div>
      }
    >
      <p className="font-medium">{item?.title}</p>
      <p className="mt-1 text-sm text-muted">{synced ? t("confirmDelete.bodyEvent") : t("confirmDelete.body")}</p>
    </Sheet>
  );
}
