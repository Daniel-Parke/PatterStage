// ═══════════════════════════════════════════════════════════════
// Pagination — Shared pagination buttons for list pages
// ═══════════════════════════════════════════════════════════════

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-white/10">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 0}
        className="text-xs font-mono px-3 py-1.5 rounded bg-white/5 text-ps-text-muted hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>
      <span className="text-xs text-ps-text-muted font-mono">
        Page {currentPage + 1} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages - 1}
        className="text-xs font-mono px-3 py-1.5 rounded bg-white/5 text-ps-text-muted hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>
  );
}