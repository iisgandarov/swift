"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { clearPerf, summarize, usePerfLog, type PerfKind } from "@/lib/client/perf";

const KINDS: PerfKind[] = ["text", "voice", "save"];
const LABEL = { text: "speedText", voice: "speedVoice", save: "speedSave" } as const;

/** Settings → Speed: p50/p90 per stage from this device's speed log, with a copy button for reports. */
export function SpeedSection() {
  const t = useTranslations("settings");
  const entries = usePerfLog();
  const [copied, setCopied] = useState(false);

  const report = () =>
    JSON.stringify(
      {
        summary: Object.fromEntries(KINDS.map((k) => [k, summarize(entries, k)])),
        recent: entries.slice(-30).map((e) => ({ ...e, at: new Date(e.at).toISOString() })),
      },
      null,
      1,
    );

  if (entries.length === 0) return <p className="text-sm text-muted">{t("speedEmpty")}</p>;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t("speedHint")}</p>
      {KINDS.map((kind) => {
        const s = summarize(entries, kind);
        if (s.count === 0) return null;
        return (
          <div key={kind}>
            <p className="mb-1 text-[15px] font-medium">
              {t(LABEL[kind])} <span className="text-sm font-normal text-muted">· {t("speedCount", { count: s.count })}</span>
            </p>
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-1 font-normal">{t("speedStage")}</th>
                  <th className="py-1 text-right font-normal">p50</th>
                  <th className="py-1 text-right font-normal">p90</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.stage} className="border-t border-divider">
                    <td className="py-1">{r.stage}</td>
                    <td className="py-1 text-right">{r.stage.endsWith("kb") ? r.p50 : `${r.p50} ms`}</td>
                    <td className="py-1 text-right">{r.stage.endsWith("kb") ? r.p90 : `${r.p90} ms`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      <div className="flex gap-3">
        <button
          type="button"
          className="h-10 rounded-full bg-surface px-4 text-[15px] font-medium"
          onClick={() =>
            navigator.clipboard
              ?.writeText(report())
              .then(() => setCopied(true))
              .catch(() => undefined)
          }
        >
          {copied ? t("speedCopied") : t("speedCopy")}
        </button>
        <button
          type="button"
          className="h-10 rounded-full px-4 text-[15px] font-medium text-muted"
          onClick={clearPerf}
        >
          {t("speedClear")}
        </button>
      </div>
    </div>
  );
}
