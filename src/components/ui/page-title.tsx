import type { ReactNode } from "react";

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <header className="chrome mb-5 flex min-h-12 items-center justify-between gap-3">
      <h1 className="text-[26px] font-bold tracking-tight">{children}</h1>
      {action}
    </header>
  );
}
