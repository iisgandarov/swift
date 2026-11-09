import type { ReactNode } from "react";

/** Full screen on phones, a centered card ("modal") on desktop. */
export function FormFrame({ children }: { children: ReactNode }) {
  return <div className="lg:card lg:mx-auto lg:mt-4 lg:max-w-xl lg:p-8">{children}</div>;
}
