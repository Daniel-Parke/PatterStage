// ═══════════════════════════════════════════════════════════════
// Pagination — page controls for list pages
// ═══════════════════════════════════════════════════════════════
//
// Previous and Next alone is a usable control over three pages and an
// unusable one over 716: reaching the oldest session meant 715 clicks, and
// there was no way to make the pages bigger (T-0105, D39). First and Last are
// two more buttons; the page size is a select.

/** The row counts the sessions list offers. 100 is parseListBounds' ceiling. */
export const PAGE_SIZE_OPTIONS = [25, 50, 100];

interface PaginationProps {
  /** 0-based. */
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  /** Omit to render no size control at all. */
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

const BTN =
  "text-micro font-mono px-3 py-1.5 rounded-ps-sm bg-ps-surface-raised text-ps-text-muted hover:text-ps-text-primary hover:bg-ps-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors";

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  const atStart = currentPage === 0;
  const atEnd = currentPage >= totalPages - 1;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mt-6 pt-4 border-t border-ps-edge-hairline">
      <button type="button" onClick={() => onPageChange(0)} disabled={atStart} className={BTN}>
        First
      </button>
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={atStart}
        className={BTN}
      >
        Previous
      </button>
      <span className="text-micro text-ps-text-muted font-mono">
        Page {currentPage + 1} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={atEnd}
        className={BTN}
      >
        Next
      </button>
      <button
        type="button"
        onClick={() => onPageChange(totalPages - 1)}
        disabled={atEnd}
        className={BTN}
      >
        Last
      </button>
      {onPageSizeChange && (
        <select
          aria-label="Rows per page"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="text-micro font-mono px-2 py-1.5 rounded-ps-sm bg-ps-surface-ground border border-ps-edge text-ps-text-muted"
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n} per page
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
