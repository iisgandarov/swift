import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { ThemeScript } from "@/components/theme/theme-script";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ServiceWorkerRegister } from "@/components/shell/service-worker-register";
import { cookies } from "next/headers";
import { isThemePref, THEME_COLORS, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"], // latin-ext carries ə ğ ı ö ü ş ç İ
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: { default: "Swift", template: "%s · Swift" },
    description: t("subline"),
    applicationName: "Swift",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "Swift", statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
    icons: {
      icon: [
        { url: "/icons/swift-16.png", sizes: "16x16", type: "image/png" },
        { url: "/icons/swift-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icons/swift-48.png", sizes: "48x48", type: "image/png" },
      ],
      apple: [{ url: "/icons/swift-apple-v2-180.png", sizes: "180x180" }],
    },
    other: { "mobile-web-app-capable": "yes" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  const initialTheme = isThemePref(themeCookie) ? themeCookie : "system";
  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <NextIntlClientProvider>
          <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>
        </NextIntlClientProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
