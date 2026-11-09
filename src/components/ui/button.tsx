import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "bg-chip text-chip-fg",
  ghost: "text-fg hover:bg-surface-2",
  danger: "bg-danger text-white",
};

export function Button({
  variant = "primary",
  className,
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "md" | "lg" }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        size === "lg" ? "h-14 px-6 text-[17px]" : "h-11 px-5 text-[15px]",
        styles[variant],
        className,
      )}
    />
  );
}
