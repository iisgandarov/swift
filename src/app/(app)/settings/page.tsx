import { useTranslations } from "next-intl";
import { PageTitle } from "@/components/ui/page-title";
import { ListSkeleton } from "@/components/ui/skeleton";

export default function Page() {
  const t = useTranslations("nav");
  return (
    <>
      <PageTitle>{t("settings")}</PageTitle>
      <ListSkeleton rows={3} />
    </>
  );
}
