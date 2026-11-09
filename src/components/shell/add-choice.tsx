"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Keyboard, Mic } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { navigate } from "@/lib/client/nav";

// tiny global store so the FAB, the sidebar and empty states can all open the same sheet
let open = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => {
  open = v;
  listeners.forEach((l) => l());
};
export const openAddChoice = () => set(true);

/** "+" → choose between a voice task and a text task. */
export function AddChoiceSheet() {
  const t = useTranslations("newTask");
  const isOpen = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => false,
  );
  const go = (path: string) => {
    set(false);
    navigate(path);
  };
  const options = [
    { path: "/new/voice", icon: Mic, title: t("voiceTitle"), hint: t("voiceHint"), testId: "choose-voice" },
    { path: "/new/text", icon: Keyboard, title: t("textTitle"), hint: t("textHint"), testId: "choose-text" },
  ];
  return (
    <Sheet open={isOpen} onClose={() => set(false)} title={t("chooseTitle")}>
      <div className="grid gap-3 pb-2">
        {options.map(({ path, icon: Icon, title, hint, testId }) => (
          <button
            key={path}
            type="button"
            data-testid={testId}
            onClick={() => go(path)}
            className="flex min-h-20 items-center gap-4 rounded-[20px] border border-line bg-surface-2 px-4 py-4 text-left transition active:scale-[0.99]"
          >
            <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-accent">
              <Icon className="size-6" />
            </span>
            <span className="min-w-0">
              <span className="block text-[17px] font-semibold">{title}</span>
              <span className="mt-0.5 block text-sm text-muted">{hint}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
