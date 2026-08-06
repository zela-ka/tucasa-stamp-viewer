import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GlassButton } from '@/components/glass';

export const PAGE_SIZE = 10;

export function usePaged<T>(items: T[], pageSize: number = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  return { page, setPage, totalPages, pageItems, total: items.length, pageSize };
}

interface ListPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}

export function ListPagination({ page, totalPages, total, pageSize, onPageChange }: ListPaginationProps) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
      <p className="text-xs text-white/70">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <GlassButton
          size="icon"
          className="h-9 w-9 rounded-full disabled:opacity-40"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </GlassButton>
        <span className="text-xs text-white/80 tabular-nums">
          {page} / {totalPages}
        </span>
        <GlassButton
          size="icon"
          className="h-9 w-9 rounded-full disabled:opacity-40"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </GlassButton>
      </div>
    </div>
  );
}