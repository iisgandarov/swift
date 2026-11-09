import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { isLocale, localeFromAcceptLanguage, LOCALE_COOKIE, type Locale } from "./config";

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieLocale)
    ? cookieLocale
    : localeFromAcceptLanguage((await headers()).get("accept-language"));

  return {
    locale,
    timeZone: "Asia/Baku",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
