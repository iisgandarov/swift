"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { draftToInput } from "@/lib/domain/drafts";
import { api } from "@/lib/client/api";
import { useCreateItems, useProfile } from "@/lib/client/queries";
import { navigate } from "@/lib/client/nav";
import { tick } from "@/lib/haptics";
import { useToast } from "@/components/ui/toast";
import { ConfirmSheet } from "./confirm-sheet";
import type { useVoiceFlow, VoiceResult } from "./use-voice-flow";

/**
 * Shows parsed items for confirmation and saves them, or — with "create without
 * confirmation" on — saves right away with a 5 s undo. Shared by voice and text screens.
 */
export function ResultReview({ flow, onAgain }: { flow: ReturnType<typeof useVoiceFlow>; onAgain: () => void }) {
  const t = useTranslations();
  const toast = useToast();
  const profile = useProfile();
  const create = useCreateItems();
  const autoCreate = profile?.auto_create ?? false;

  const createFrom = useCallback(
    async (result: VoiceResult) => {
      const inputs = result.drafts.map((d) =>
        draftToInput(d, { source: result.source, transcript: result.transcript, language: result.language }),
      );
      const created = await create.mutateAsync(inputs);
      tick();
      return created;
    },
    [create],
  );

  const handled = useRef<VoiceResult | null>(null);
  useEffect(() => {
    const result = flow.result;
    if (!autoCreate || !result || handled.current === result) return;
    handled.current = result;
    createFrom(result)
      .then((created) => {
        flow.close();
        navigate("/", { replace: true });
        toast({
          message: t("voice.created", { count: created.length }),
          duration: 5000,
          action: {
            label: t("action.undo"),
            onClick: () => created.forEach((i) => api(`/api/items/${i.id}`, { method: "DELETE" }).catch(() => undefined)),
          },
        });
      })
      .catch(() => toast({ message: t("error.generic"), tone: "error" }));
  }, [autoCreate, flow, createFrom, toast, t]);

  return (
    <ConfirmSheet
      open={!autoCreate && flow.state === "review" && flow.result !== null}
      drafts={flow.result?.drafts ?? []}
      transcript={flow.result?.transcript ?? ""}
      busy={create.isPending}
      onChange={(drafts) => flow.result && flow.setResult({ ...flow.result, drafts })}
      onClose={flow.close}
      onRecordAgain={onAgain}
      againLabel={flow.result?.source === "text" ? t("action.edit") : undefined}
      onCreate={async () => {
        if (!flow.result) return;
        try {
          const created = await createFrom(flow.result);
          flow.close();
          toast({ message: t("voice.created", { count: created.length }), duration: 3000 });
          navigate("/", { replace: true });
        } catch {
          toast({ message: t("error.generic"), tone: "error" });
        }
      }}
    />
  );
}
