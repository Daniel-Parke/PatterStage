import type { Metadata } from "next";
import localFont from "next/font/local";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import Sidebar from "@/components/layout/Sidebar";
import MobileHeader from "@/components/layout/MobileHeader";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import QueryProvider from "@/components/providers/QueryProvider";
import BloomField from "@/kit/BloomField";
import "./globals.css";

// Vendored, not fetched (WG-DEL-004, ruled C: determinism first). These were
// next/font/google, which made `next build` reach fonts.googleapis.com and made CI
// carry a font warmup plus a whole-build retry to survive the flake. The files are
// committed under src/app/fonts/; re-run scripts/tooling/vendor-fonts.mjs only to
// add or update a family.
//
// Both are variable fonts, so one file covers the whole weight range the app used
// to request from the CSS API.
const inter = localFont({
  src: "./fonts/Inter.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});
const jetbrainsMono = localFont({
  src: "./fonts/JetBrainsMono.woff2",
  variable: "--font-mono",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  // Per-page titles are set client-side by <PageTitle> (most pages are client
  // components and can't export their own metadata); this template/default is
  // the SSR baseline before that effect runs.
  title: { default: "PatterStage", template: "%s · PatterStage" },
  description: "Monitor, update, and control your AI agent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-dark-950 text-white">
        {/*
          The bloom tier: ONE delegated pointer listener for the whole console,
          vendored from PatterTech_Website (src/kit/PROVENANCE.md). It renders
          nothing and mounts exactly once, here, because a second mount would
          mean a second listener doing identical work. It sets --bx/--by/--bloom
          on the [data-bloom] element under the cursor; globals.css paints the
          radial. Fine pointers only, and reduced motion opts out in both the
          listener and the paint rule.
        */}
        <BloomField />
        <QueryProvider>
        <SidebarProvider>
          <div className="h-full flex flex-col lg:flex-row">
            <div className="border-r border-white/10 flex-shrink-0">
              <Sidebar />
            </div>
            <div className="flex-1 flex flex-col min-h-screen min-w-0">
              <MobileHeader />
              <main className="flex-1 overflow-y-auto" data-testid="ps-app-shell">
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
          </div>
        </SidebarProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
