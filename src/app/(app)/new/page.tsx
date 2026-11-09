import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { ListSkeleton } from "@/components/ui/skeleton";

export default function NewTaskPage() {
  const t = useTranslations("newTask");
  return (
    <>
      <header className="chrome mb-6 grid grid-cols-[44px_1fr_44px] items-center">
        <Link href="/" aria-label={t("back")} className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2">
          <ArrowLeft className="size-6" aria-hidden />
        </Link>
        <h1 className="text-center text-xl font-bold">{t("title")}</h1>
      </header>
      <ListSkeleton rows={5} />
    </>
  );
}
