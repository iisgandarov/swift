"use client";

import { cn } from "@/lib/cn";

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="chrome flex rounded-full bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 flex-1 whitespace-nowrap rounded-full px-3 text-[14px] font-semibold transition-colors duration-200",
            value === o.value ? "bg-surface text-primary shadow-sm dark:bg-primary dark:text-white" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200", checked ? "bg-primary" : "bg-surface-2 ring-1 ring-line")}
    >
      <span className={cn("absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform duration-200", checked && "translate-x-5")} />
    </button>
  );
}
