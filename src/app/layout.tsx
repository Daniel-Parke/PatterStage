import type { Metadata } from "next";
import localFont from "next/font/local";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import Sidebar from "@/components/layout/Sidebar";
import MobileHeader from "@/components/layout/MobileHeader";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { FeedbackProvider } from "@/components/providers/FeedbackProvider";
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
        {/*
          The skip link: the first tab stop on every page, visible only while
          focused, so a keyboard user is not made to tab through thirty nav
          links to reach what they came for (T-0096, D117).
        */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-lg focus:border focus:border-neon-cyan/40 focus:bg-dark-900 focus:px-3 focus:py-2 focus:text-sm focus:font-mono focus:text-ps-text-primary"
        >
          Skip to main content
        </a>
        <QueryProvider>
        {/*
          One feedback surface for the whole shell: the toast stack and the
          achievement-unlock toast live here, not on each page (T-0096, D122).
          Inside QueryProvider because it reads the stats poll.
        */}
        <FeedbackProvider>
        <SidebarProvider>
          <div className="h-full flex flex-col lg:flex-row">
            <div className="border-r border-white/10 flex-shrink-0">
              <Sidebar />
            </div>
            <div className="flex-1 flex flex-col min-h-screen min-w-0">
              <MobileHeader />
              {/* design-lint-disable-next-line no-bare-outline-none -- the skip link's target takes programmatic focus; a ring around the whole content pane is noise, and the first control inside it paints its own */}
              <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto outline-none" data-testid="ps-app-shell">
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
          </div>
        </SidebarProvider>
        </FeedbackProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
