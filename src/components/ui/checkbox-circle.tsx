"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

export function CheckboxCircle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className="chrome -m-2.5 flex size-11 shrink-0 items-center justify-center rounded-full"
    >
      <motion.span
        animate={{ scale: checked ? [1, 1.15, 1] : 1 }}
        transition={{ duration: 0.25 }}
        className={cn(
          "flex size-[26px] items-center justify-center rounded-full border-2 transition-colors duration-200",
          checked ? "border-primary bg-primary text-white dark:border-secondary dark:bg-primary" : "border-subtle",
        )}
      >
        {checked && <Check className="size-4" strokeWidth={3} aria-hidden />}
      </motion.span>
    </button>
  );
}
