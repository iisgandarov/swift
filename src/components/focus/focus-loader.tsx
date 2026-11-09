"use client";

import dynamic from "next/dynamic";
import { ListSkeleton } from "@/components/ui/skeleton";

// The timer restores from localStorage, so it renders on the client only (no hydration mismatch).
export const FocusLoader = dynamic(() => import("./focus-screen").then((m) => m.FocusScreen), {
  ssr: false,
  loading: () => <ListSkeleton rows={2} />,
});
