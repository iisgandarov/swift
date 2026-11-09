"use client";

import { Suspense, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Download, LogOut, Smartphone } from "lucide-react";
import { useBootstrap, useProfile, useUpdateProfile } from "@/lib/client/queries";
import { useTheme } from "@/components/theme/theme-provider";
import { Segmented, Switch } from "@/components/ui/segmented";
import { PageTitle } from "@/components/ui/page-title";
import { ListSkeleton } from "@/components/ui/skeleton";
import { setClientCookie } from "@/lib/cookies";
import { LOCALE_COOKIE } from "@/i18n/config";
import type { ThemePref } from "@/lib/theme";
import { GoogleSection } from "./google-section";
import { CategoryManager } from "./category-manager";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-[13px] font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2 py-2 first:pt-0 last:pb-0">
      <div>
        <p className="text-[15px] font-medium">{label}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const t = useTranslations();
  const ts = useTranslations("settings");
  const router = useRouter();
  const locale = useLocale() as "az" | "en";
  const boot = useBootstrap();
  const profile = useProfile();
  const update = useUpdateProfile();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState<string | null>(null);

  if (!profile) {
    return (
      <>
        <PageTitle>{ts("title")}</PageTitle>
        <ListSkeleton rows={4} />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageTitle>{ts("title")}</PageTitle>

      <Section title={ts("profile")}>
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-medium">{ts("name")}</span>
          <input
            value={name ?? profile.display_name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name !== null && name.trim() !== profile.display_name) update.mutate({ display_name: name.trim() });
            }}
            className="h-12 w-full rounded-2xl border border-line bg-surface-2 px-4"
          />
        </label>
        <p className="mt-2 text-sm text-muted">{boot.data?.user.email}</p>
      </Section>

      <Section title={`${ts("uiLanguage")} · ${ts("theme")}`}>
        <Row label={ts("uiLanguage")}>
          <Segmented
            label={ts("uiLanguage")}
            value={locale}
            options={[
              { value: "az", label: "Azərbaycan" },
              { value: "en", label: "English" },
            ]}
            onChange={(v) => {
              setClientCookie(LOCALE_COOKIE, v);
              update.mutate({ ui_locale: v }, { onSettled: () => router.refresh() });
            }}
          />
        </Row>
        <Row label={ts("voiceLanguage")}>
          <Segmented
            label={ts("voiceLanguage")}
            value={profile.voice_locale}
            options={[
              { value: "auto", label: t("voice.auto") },
              { value: "az", label: "AZ" },
              { value: "en", label: "EN" },
            ]}
            onChange={(v) => update.mutate({ voice_locale: v })}
          />
        </Row>
        <Row label={ts("theme")}>
          <Segmented<ThemePref>
            label={ts("theme")}
            value={theme}
            options={[
              { value: "system", label: ts("themeSystem") },
              { value: "light", label: ts("themeLight") },
              { value: "dark", label: ts("themeDark") },
            ]}
            onChange={(v) => {
              setTheme(v);
              update.mutate({ theme: v });
            }}
          />
        </Row>
      </Section>

      <Section title={ts("google")}>
        <Suspense>
          <GoogleSection />
        </Suspense>
      </Section>

      <Section title={t("type.task") + " · " + t("type.event")}>
        <Row label={ts("eventDuration")}>
          <Segmented
            label={ts("eventDuration")}
            value={profile.default_event_minutes}
            options={[30, 45, 60, 90].map((m) => ({ value: m, label: `${m} ${t("focus.minutes")}` }))}
            onChange={(v) => update.mutate({ default_event_minutes: v as 30 | 45 | 60 | 90 })}
          />
        </Row>
        <Row label={ts("timeFormat")}>
          <Segmented
            label={ts("timeFormat")}
            value={profile.time_format}
            options={[
              { value: "24h", label: ts("h24") },
              { value: "12h", label: ts("h12") },
            ]}
            onChange={(v) => update.mutate({ time_format: v })}
          />
        </Row>
        <div className="flex items-center justify-between gap-4 pt-3">
          <div>
            <p className="text-[15px] font-medium">{ts("autoCreate")}</p>
            <p className="text-sm text-muted">{ts("autoCreateHint")}</p>
          </div>
          <Switch label={ts("autoCreate")} checked={profile.auto_create} onChange={(v) => update.mutate({ auto_create: v })} />
        </div>
      </Section>

      <Section title={ts("categories")}>
        <CategoryManager />
      </Section>

      <Section title={ts("install")}>
        <div className="flex gap-3">
          <Smartphone className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <div className="space-y-2 text-[15px] leading-relaxed text-muted">
            <p>{ts("installIos")}</p>
            <p>{ts("installAndroid")}</p>
          </div>
        </div>
      </Section>

      <section className="card divide-y divide-divider px-5">
        <a href="/api/export" download className="flex min-h-14 items-center gap-3 text-[15px] font-medium">
          <Download className="size-5 text-muted" aria-hidden />
          {ts("export")}
        </a>
        <form action="/auth/signout" method="post">
          <button className="flex min-h-14 w-full items-center gap-3 text-[15px] font-medium text-danger">
            <LogOut className="size-5" aria-hidden />
            {ts("signOut")}
          </button>
        </form>
      </section>

      <footer className="pt-4 pb-2 text-center">
        <p lang="en" className="font-semibold text-accent">{t("app.tagline")}</p>
        <p lang="en" className="mt-1 text-xs tracking-[0.3em] text-subtle uppercase">{t("app.footer")}</p>
        <p className="mt-3 text-xs text-subtle">
          Swift · {ts("version", { version: process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0" })}
          {boot.data?.demo ? " · demo" : ""}
        </p>
      </footer>
    </div>
  );
}
