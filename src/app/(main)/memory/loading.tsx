import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { Brain } from "lucide-react";

export default function MemoryLoading() {
  return (
    <AppPageShell>
      <PageHeader icon={Brain} title="Memory" subtitle="Loading..." color="pink" />
      <div className="flex items-center justify-center min-h-[40vh] px-6">
        <LoadingSpinner text="Detecting memory provider..." />
      </div>
    </AppPageShell>
  );
}
