import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import Sidebar from "@/components/layout/Sidebar";
import MobileHeader from "@/components/layout/MobileHeader";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import QueryProvider from "@/components/providers/QueryProvider";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

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
