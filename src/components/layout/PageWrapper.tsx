// ═══════════════════════════════════════════════════════════════
// PageWrapper — Consistent full-page layout with sidebar padding
//
// All full-page content wrappers MUST use this component or
// apply the equivalent classes directly:
//
//   className="pl-64 flex flex-col h-full"
// ═══════════════════════════════════════════════════════════════

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageWrapper({ children, className = "" }: PageWrapperProps) {
  return (
    <div className={`pl-64 flex flex-col h-full ${className}`}>
      {children}
    </div>
  );
}
