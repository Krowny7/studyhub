import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { getLocale } from "@/lib/i18n/server";

export const metadata = {
  title: "CFA Hub",
  description: "Your shared CFA study workspace"
};

// Ensure iOS safe-area insets (env(safe-area-inset-*)) work reliably for fixed UI
// like the bottom navigation bar.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-neutral-950 text-white antialiased">
        <Providers initialLocale={locale}>
          {/* Ambient background */}
          <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_10%,rgba(59,130,246,0.18),transparent_45%),radial-gradient(700px_circle_at_85%_0%,rgba(16,185,129,0.12),transparent_40%)]" />
            <div className="absolute inset-0 opacity-[0.18] bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:56px_56px]" />
            <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900" />
          </div>
          <Header />
          {/* Reserve space on mobile for the bottom navigation bar */}
          <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-24 sm:px-6 sm:pb-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}