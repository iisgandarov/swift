"use client";

import { useTranslations } from "next-intl";
import { CalendarClock, CalendarPlus, ListTodo, Pencil, Trash2 } from "lucide-react";
import type { Item } from "@/lib/domain/types";
import { Sheet } from "@/components/ui/sheet";

export type MenuAction = "edit" | "changeDate" | "toggleType" | "delete";

export function ItemMenuSheet({
  item,
  onClose,
  onAction,
}: {
  item: Item | null;
  onClose: () => void;
  onAction: (action: MenuAction, item: Item) => void;
}) {
  const t = useTranslations("action");
  const rows: { action: MenuAction; label: string; icon: React.ReactNode; danger?: boolean }[] = item
    ? [
        { action: "edit", label: t("edit"), icon: <Pencil className="size-5" /> },
        { action: "changeDate", label: t("changeDate"), icon: <CalendarClock className="size-5" /> },
        item.type === "task"
          ? { action: "toggleType", label: t("makeEvent"), icon: <CalendarPlus className="size-5" /> }
          : { action: "toggleType", label: t("makeTask"), icon: <ListTodo className="size-5" /> },
        { action: "delete", label: t("delete"), icon: <Trash2 className="size-5" />, danger: true },
      ]
    : [];
  return (
    <Sheet open={item !== null} onClose={onClose} title={item?.title}>
      <ul className="divide-y divide-divider">
        {rows.map((r) => (
          <li key={r.action}>
            <button
              type="button"
              onClick={() => item && onAction(r.action, item)}
              className={"flex min-h-14 w-full items-center gap-4 text-left text-[16px] " + (r.danger ? "text-danger" : "")}
            >
              <span aria-hidden className={r.danger ? "" : "text-muted"}>
                {r.icon}
              </span>
              {r.label}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
