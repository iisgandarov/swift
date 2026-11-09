"use client";

import { useTranslations } from "next-intl";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("error");
  return (
    <div className="card mx-auto mt-10 flex max-w-md flex-col items-center px-6 py-10 text-center">
      <p className="text-lg font-semibold">{t("generic")}</p>
      <Button className="mt-6" onClick={reset}>
        <RotateCw className="size-4" aria-hidden />
        {t("tryAgain")}
      </Button>
    </div>
  );
}
