"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";

export interface Option<T> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/** A list of choices in a bottom sheet (category, priority, ...). */
export function OptionSheet<T extends string | null>({
  open,
  onClose,
  title,
  options,
  value,
  onChange,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  footer?: ReactNode;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <ul className="divide-y divide-divider" role="listbox" aria-label={title}>
        {options.map((o) => (
          <li key={String(o.value)}>
            <button
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                onClose();
              }}
              className="flex min-h-14 w-full items-center gap-3 py-3 text-left text-[16px]"
            >
              {o.icon}
              <span className="flex-1">{o.label}</span>
              {o.value === value && <Check className="size-5 text-primary dark:text-secondary" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
      {footer}
    </Sheet>
  );
}
