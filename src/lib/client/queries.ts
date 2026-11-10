"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Category, FocusSession, GoogleStatus, Item, Profile } from "@/lib/domain/types";
import type { CategoryInput, FocusSessionInput, ItemInput, ItemPatch, ProfilePatch } from "@/lib/domain/schemas";
import { api } from "./api";
import { parseServerTiming, recordPerf } from "./perf";

export interface Bootstrap {
  user: { email: string; name: string };
  profile: Profile;
  categories: Category[];
  google: GoogleStatus;
  demo: boolean;
}

export const qk = {
  bootstrap: ["bootstrap"] as const,
  items: ["items"] as const,
  range: (from: string, to: string) => ["items", "range", from, to] as const,
  googleEvents: (from: string, to: string) => ["google-events", from, to] as const,
  focus: ["focus"] as const,
};

export function useBootstrap() {
  return useQuery({ queryKey: qk.bootstrap, queryFn: () => api<Bootstrap>("/api/bootstrap"), staleTime: 5 * 60_000 });
}

export function useProfile() {
  return useBootstrap().data?.profile;
}

export function useCategories() {
  return useBootstrap().data?.categories ?? [];
}

export function useItems() {
  return useQuery({
    queryKey: qk.items,
    queryFn: async () => (await api<{ items: Item[] }>("/api/items")).items,
    staleTime: 30_000,
  });
}

/** Replace or insert an item in every cached list. */
function upsertCached(qc: ReturnType<typeof useQueryClient>, item: Item) {
  qc.setQueriesData<Item[]>({ queryKey: qk.items }, (old) => {
    if (!old) return old;
    const i = old.findIndex((x) => x.id === item.id);
    if (i === -1) return [...old, item];
    const next = old.slice();
    next[i] = item;
    return next;
  });
}

function removeCached(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.setQueriesData<Item[]>({ queryKey: qk.items }, (old) => old?.filter((x) => x.id !== id));
}

export function useCreateItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inputs: ItemInput[]) => {
      const t0 = performance.now();
      const stages: Record<string, number> = {};
      const onResponse = (res: Response) => Object.assign(stages, parseServerTiming(res.headers.get("server-timing")).stages);
      let ok = false;
      try {
        const items =
          inputs.length === 1
            ? [(await api<{ item: Item }>("/api/items", { method: "POST", json: inputs[0], onResponse })).item]
            : (await api<{ items: Item[] }>("/api/items", { method: "POST", json: { items: inputs }, onResponse })).items;
        ok = true;
        return items;
      } finally {
        recordPerf({ kind: "save", at: Date.now(), ok, totalMs: Math.round(performance.now() - t0), stages, note: `${inputs.length}` });
      }
    },
    onSuccess: (items) => items.forEach((i) => upsertCached(qc, i)),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.items }),
  });
}

/** Optimistic for simple fields (status/title/...); timing changes are confirmed by the server response. */
export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ItemPatch }) =>
      api<{ item: Item }>(`/api/items/${id}`, { method: "PATCH", json: patch }).then((r) => r.item),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.items });
      const snapshot = qc.getQueriesData<Item[]>({ queryKey: qk.items });
      qc.setQueriesData<Item[]>({ queryKey: qk.items }, (old) =>
        old?.map((x) => {
          if (x.id !== id) return x;
          const next: Item = { ...x };
          if (patch.status) {
            next.status = patch.status;
            next.completed_at = patch.status === "done" ? new Date().toISOString() : null;
          }
          if (patch.title !== undefined) next.title = patch.title;
          if (patch.priority) next.priority = patch.priority;
          if (patch.category_id !== undefined) next.category_id = patch.category_id ?? null;
          if (patch.date !== undefined && x.type === "task") next.date = patch.date ?? null;
          return next;
        }),
      );
      return { snapshot };
    },
    onError: (_e, _v, c) => c?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSuccess: (item) => upsertCached(qc, item),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ item: Item }>(`/api/items/${id}`, { method: "DELETE" }).then((r) => r.item),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.items });
      const snapshot = qc.getQueriesData<Item[]>({ queryKey: qk.items });
      removeCached(qc, id);
      return { snapshot };
    },
    onError: (_e, _v, c) => c?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data)),
  });
}

export function useRestoreItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: Item) => api<{ item: Item }>("/api/items/restore", { method: "POST", json: item }).then((r) => r.item),
    onMutate: (item) => upsertCached(qc, item),
    onSuccess: (item) => upsertCached(qc, item),
  });
}

export function useRetrySync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ item: Item }>(`/api/items/${id}/retry-sync`, { method: "POST" }).then((r) => r.item),
    onSuccess: (item) => upsertCached(qc, item),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => api<{ profile: Profile }>("/api/profile", { method: "PATCH", json: patch }).then((r) => r.profile),
    onMutate: (patch) => {
      qc.setQueryData<Bootstrap>(qk.bootstrap, (b) => (b ? { ...b, profile: { ...b.profile, ...patch } } : b));
    },
    onSuccess: (profile) => qc.setQueryData<Bootstrap>(qk.bootstrap, (b) => (b ? { ...b, profile } : b)),
  });
}

export function useCategoryMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: qk.bootstrap });
  return {
    create: useMutation({
      mutationFn: (input: CategoryInput) => api("/api/categories", { method: "POST", json: input }),
      onSettled: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Partial<CategoryInput> }) =>
        api(`/api/categories/${id}`, { method: "PATCH", json: patch }),
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api(`/api/categories/${id}`, { method: "DELETE" }),
      onSettled: () => {
        refresh();
        qc.invalidateQueries({ queryKey: qk.items });
      },
    }),
    reorder: useMutation({
      mutationFn: (order: string[]) => api("/api/categories", { method: "PUT", json: { order } }),
      onMutate: (order) =>
        qc.setQueryData<Bootstrap>(qk.bootstrap, (b) =>
          b
            ? {
                ...b,
                categories: order
                  .map((id, i) => {
                    const c = b.categories.find((x) => x.id === id);
                    return c ? { ...c, sort_order: i } : null;
                  })
                  .filter((c): c is Category => c !== null),
              }
            : b,
        ),
      onSettled: refresh,
    }),
  };
}

// ---------------------------------------------------------------- Google Calendar

export interface GoogleEventLite {
  id: string;
  title: string;
  date: string;
  start_at: string | null;
  end_at: string | null;
  all_day: boolean;
  html_link: string | null;
  color: string | null;
}

export function useGoogleEvents(from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.googleEvents(from, to),
    queryFn: () =>
      api<{ events: GoogleEventLite[]; status: "ok" | "not_connected" | "reconnect_required" | "error" }>(
        `/api/calendar/events?from=${from}&to=${to}`,
      ),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useGoogleCalendars(enabled: boolean) {
  return useQuery({
    queryKey: ["google-calendars"],
    queryFn: () => api<{ calendars: { id: string; summary: string; primary: boolean }[] }>("/api/google/calendars"),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useGoogleMutations() {
  const qc = useQueryClient();
  const setStatus = (google: GoogleStatus) => qc.setQueryData<Bootstrap>(qk.bootstrap, (b) => (b ? { ...b, google } : b));
  return {
    disconnect: useMutation({
      mutationFn: () => api("/api/google/disconnect", { method: "POST" }),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qk.bootstrap });
        qc.removeQueries({ queryKey: ["google-events"] });
      },
    }),
    setCalendar: useMutation({
      mutationFn: (calendar_id: string) =>
        api<{ google: GoogleStatus }>("/api/google/settings", { method: "PATCH", json: { calendar_id } }).then((r) => r.google),
      onSuccess: setStatus,
    }),
  };
}

/** Items whose local date is within [from, to] (any status). */
export function useRangeItems(from: string, to: string) {
  return useQuery({
    queryKey: qk.range(from, to),
    queryFn: async () => (await api<{ items: Item[] }>(`/api/items?from=${from}&to=${to}`)).items,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useFocusSessions() {
  return useQuery({
    queryKey: qk.focus,
    queryFn: async () => (await api<{ sessions: FocusSession[] }>("/api/focus")).sessions,
    staleTime: 60_000,
  });
}

export function useLogFocus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FocusSessionInput) => api("/api/focus", { method: "POST", json: input }),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.focus }),
  });
}
