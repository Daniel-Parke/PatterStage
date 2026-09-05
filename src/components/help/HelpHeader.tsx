// ═══════════════════════════════════════════════════════════════
// HelpHeader — the Help section's PageHeader, on the client side of the line
//
// The Help page is the console's only SERVER page: it reads the corpus off
// disk. PageHeader is a client component and takes its icon as a component
// reference, and a component is a function, so a server page rendering
// `<PageHeader icon={LifeBuoy} />` hands a function across the boundary and
// Next refuses the whole render with "Functions cannot be passed directly to
// Client Components". The page 500s, and no jsdom test can see it, because a
// unit render has no server/client boundary to break.
//
// So the icon is chosen HERE, one module inside the boundary, and the server
// page passes only strings.
// ═══════════════════════════════════════════════════════════════

"use client";

import { LifeBuoy } from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";

export default function HelpHeader({ title, subtitle }: { title?: string; subtitle: string }) {
  return <PageHeader icon={LifeBuoy} title={title} subtitle={subtitle} color="cyan" />;
}
