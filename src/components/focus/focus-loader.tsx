"use client";

import { useSyncExternalStore } from "react";
import { ListSkeleton } from "@/components/ui/skeleton";
import { FocusScreen } from "./focus-screen";

const noop = () => () => {};

// The timer restores from localStorage, so it renders on the client only (no hydration mismatch).
// Not a lazy import: the code must ship with the page so Focus also opens offline.
export function FocusLoader() {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? <FocusScreen /> : <ListSkeleton rows={2} />;
}
