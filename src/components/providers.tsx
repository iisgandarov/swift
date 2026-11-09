"use client";

import { useState, type ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { del, get, set } from "idb-keyval";
import { ToastProvider } from "@/components/ui/toast";

const CACHE_BUSTER = "swift-1";

/** Data layer: React Query, persisted to IndexedDB so the app opens instantly and works offline (read-only). */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { gcTime: 1000 * 60 * 60 * 24 * 7, retry: 1, refetchOnWindowFocus: true, networkMode: "offlineFirst" },
          mutations: { networkMode: "online" },
        },
      }),
  );
  const [persister] = useState(() =>
    createAsyncStoragePersister({
      storage: typeof window === "undefined" ? undefined : { getItem: get, setItem: set, removeItem: del },
      key: "swift-cache",
      throttleTime: 1000,
    }),
  );
  return (
    <PersistQueryClientProvider client={client} persistOptions={{ persister, buster: CACHE_BUSTER, maxAge: 1000 * 60 * 60 * 24 * 7 }}>
      <ToastProvider>{children}</ToastProvider>
    </PersistQueryClientProvider>
  );
}
