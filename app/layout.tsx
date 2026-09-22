import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@/components/session-provider";
import { getPublicConfig } from "@/lib/config";
import { DEMO_USER } from "@/lib/telegram-auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "supershell",
  description: "supershell — domain ve siteler. USDT TRC-20, Telegram Mini App.",
};

export const viewport: Viewport = {
  themeColor: "#07070b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const config = getPublicConfig();
  const initialSession = {
    user: DEMO_USER,
    mode: config.devBypass ? ("demo" as const) : ("blocked" as const),
    config,
    balanceUsdt: 0,
  };
  return (
    <html
      lang="tr"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Native head script — next/script + React 19 client nav /stock'u kırıyordu */}
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <SessionProvider initialSession={initialSession}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
