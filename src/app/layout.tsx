import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

/* Display: headings and money figures. Carries the personality. */
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

/* UI: labels, nav, controls. Stays out of the way. */
const sans = Instrument_Sans({
  variable: "--font-sans-ui",
  subsets: ["latin"],
  display: "swap",
});

/* Data: dates, meta, anything that should line up in a column. */
const mono = IBM_Plex_Mono({
  variable: "--font-mono-data",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mes Finances",
  description: "Gestion de finances personnelles",
  applicationName: "Mes Finances",
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mes Finances",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0b10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`dark ${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
