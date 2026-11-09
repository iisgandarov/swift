"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { navigate } from "@/lib/client/nav";

/** An <a> that navigates inside the app shell without a server round-trip (modifier clicks still open normally). */
export function AppLink({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      href={href}
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href);
      }}
    />
  );
}
