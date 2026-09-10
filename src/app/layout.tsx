import { readOperatorPrefs } from "@/lib/operator-prefs-repository";
import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { labelFor } from "@/lib/modules/registry";
import { helpScreenIndex } from "@/lib/help/help-manifest";
import { loadHelpConcepts, loadHelpManifest } from "@/lib/help/help-source";
import { HelpProvider } from "@/components/help/HelpProvider";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import Sidebar, { MobileHeader } from "@/components/layout/Sidebar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { buttonChrome } from "@/components/ui/button-chrome";
import { FeedbackProvider } from "@/components/providers/FeedbackProvider";
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

/**
 * The tab title, from the registry, on the server (T-0097, D55).
 *
 * Most pages are client components and cannot export metadata, and a client
 * effect setting document.title is not enough: Next streams the layout's
 * metadata after hydration and React re-applies its <title>, so on a fresh
 * load the tab read "PatterStage" whatever the effect had set. The proxy
 * passes the request path in `x-ps-pathname`; labelFor turns it into the
 * rail's word. <PageTitle> still runs on the client for the transitions.
 */
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const label = labelFor(h.get("x-ps-pathname") ?? "/");
  return {
    title: label ? `${label} · PatterStage` : "PatterStage",
    description: "Monitor, update, and control your AI agent",
  };
}

/**
 * The rail's collapsed state is read HERE, on the server, and handed to the
 * rail as a prop. It used to be fetched on the client, so every hard load
 * painted a 224px rail and then snapped it to 64px once /api/prefs answered:
 * a visible jump on the one surface the operator is looking at while the page
 * arrives (T-0121).
 *
 * A read that throws leaves the rail expanded, which is the state a first-boot
 * install has anyway.
 */
function readRailCollapsed(): boolean {
  try {
    return readOperatorPrefs()["sidebar.collapsed"] === true;
  } catch {
    return false;
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const railCollapsed = readRailCollapsed();
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-ps-surface-ground text-ps-text-primary">
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
          links to reach what they came for (T-0096, D117). A native anchor,
          not LinkButton: Next's Link scrolls to a hash without moving focus
          to it, and moving focus is the whole point. It wears Button's chrome
          from the shared source, on the tooltip layer so it beats everything.
        */}
        <a
          href="#main"
          // The paint is the shared button's; the SIZE is focus-only, spelled
          // literally because a `focus:` prefix cannot be composed at runtime
          // (Tailwind compiles what it can read in the source). It mirrors
          // buttonHeights.sm and buttonPadding.sm, and a test holds the two
          // together. Unprefixed, they override sr-only's 1x1 clip and the
          // hidden link becomes a 22x26 target on every route. The border goes
          // the same way: sr-only zeroes border-width, and the chrome's own
          // border puts it back, which is a 2x2 box (C6, T-0143).
          className={`sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-tooltip focus:h-6.5 focus:px-2.5 focus:text-body focus:gap-1.5 border-0 focus:border ${buttonChrome({ variant: "secondary" })}`}
        >
          Skip to main content
        </a>
        {/*
          One feedback surface for the whole shell: the toast stack and the
          achievement-unlock toast live here, not on each page (T-0096, D122),
          and the query client with them (C6).
        */}
        <FeedbackProvider>
        {/*
          Help's two indexes, read off disk here and passed down once. This is
          the only place they are read: both loaders memoise per process, so a
          request costs no syscall, and every ? and every concept popover under
          this tree answers from props rather than a fetch. An unbuilt corpus
          reads as two empty objects, which is what makes the ? land on the
          Help index instead of a 404.
        */}
        <HelpProvider screens={helpScreenIndex(loadHelpManifest())} concepts={loadHelpConcepts()}>
        <SidebarProvider>
          <div className="h-full flex flex-col md:flex-row">
            {/* No border here. The rail draws its own seam; this wrapper
                drew a second one right beside it, so what looked like one
                divider was two 1px rules at 1.25:1 apiece. */}
            <div className="flex-shrink-0">
              <Sidebar initialCollapsed={railCollapsed} />
            </div>
            <div className="flex-1 flex flex-col min-h-screen min-w-0">
              <MobileHeader />
              {/* design-lint-disable-next-line no-bare- -- the skip link's target takes programmatic focus; a ring around the whole content pane is noise, and the first control inside it paints its own */}
              <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto" data-testid="ps-app-shell">
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
          </div>
        </SidebarProvider>
        </HelpProvider>
        </FeedbackProvider>
      </body>
    </html>
  );
}
