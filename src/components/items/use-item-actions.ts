"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import type { Item } from "@/lib/domain/types";
import type { ItemPatch } from "@/lib/domain/schemas";
import { useDeleteItem, useRestoreItem, useRetrySync, useUpdateItem } from "@/lib/client/queries";
import { ApiError } from "@/lib/client/api";
import { useToast } from "@/components/ui/toast";
import { tick } from "@/lib/haptics";

export function useItemActions() {
  const t = useTranslations();
  const toast = useToast();
  const update = useUpdateItem();
  const del = useDeleteItem();
  const restore = useRestoreItem();
  const retry = useRetrySync();

  const fail = useCallback(
    (err: unknown) => {
      const offline = err instanceof ApiError && err.code === "network";
      toast({ message: offline ? t("error.offlineSave") : t("error.generic"), tone: "error" });
    },
    [t, toast],
  );

  const toggleDone = useCallback(
    (item: Item) => {
      const status = item.status === "done" ? "open" : "done";
      if (status === "done") tick();
      update.mutate(
        { id: item.id, patch: { status } },
        {
          onError: fail,
          onSuccess: () => {
            if (status === "done")
              toast({
                message: t("state.completed"),
                action: { label: t("action.undo"), onClick: () => update.mutate({ id: item.id, patch: { status: "open" } }) },
                duration: 4000,
              });
          },
        },
      );
    },
    [update, toast, t, fail],
  );

  const patch = useCallback(
    (item: Item, p: ItemPatch, onSuccess?: (i: Item) => void) =>
      update.mutate({ id: item.id, patch: p }, { onError: fail, onSuccess }),
    [update, fail],
  );

  /** Deletes right away and offers undo for 5 seconds. */
  const remove = useCallback(
    (item: Item) => {
      tick();
      del.mutate(item.id, {
        onError: fail,
        onSuccess: (deleted) =>
          toast({
            message: t("state.deleted"),
            action: { label: t("action.undo"), onClick: () => restore.mutate(deleted, { onError: fail }) },
            duration: 5000,
          }),
      });
    },
    [del, restore, toast, t, fail],
  );

  const retrySync = useCallback((item: Item) => retry.mutate(item.id, { onError: fail }), [retry, fail]);

  return { toggleDone, patch, remove, retrySync };
}
