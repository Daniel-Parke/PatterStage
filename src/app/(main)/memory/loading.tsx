import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function MemoryLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <LoadingSpinner text="Detecting memory provider..." />
    </div>
  );
}