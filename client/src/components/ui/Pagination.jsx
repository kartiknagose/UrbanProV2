/**
 * Pagination Component
 * Reusable pagination controls for lists, tables, and data pages
 * 
 * Replaces scattered manual pagination logic across pages.
 * Provides consistent UI and state management.
 */

import { Button } from './Button';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useMemo } from 'react';

export function Pagination({
  currentPage = 1,
  totalPages = 1,
  pageSize = 10,
  totalItems = 0,
  onPageChange = () => {},
  onPageSizeChange = () => {},
  showPageSizeSelector = true,
  pageSizeOptions = [10, 20, 50, 100],
  className = '',
  variant = 'default', // default, compact, minimal
}) {
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  // Calculate shown items
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers to display
  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first, last, and some around current
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }

    return pages;
  }, [currentPage, totalPages]);

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center justify-between ${className}`}>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          Page {currentPage} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={ChevronLeft}
            disabled={isFirstPage}
            onClick={() => onPageChange(currentPage - 1)}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={ChevronRight}
            disabled={isLastPage}
            onClick={() => onPageChange(currentPage + 1)}
          />
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center justify-between gap-4 ${className}`}>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Showing {startItem} to {endItem} of {totalItems} items
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={ChevronLeft}
            disabled={isFirstPage}
            onClick={() => onPageChange(currentPage - 1)}
          />
          <Button
            variant="secondary"
            size="sm"
            icon={ChevronRight}
            disabled={isLastPage}
            onClick={() => onPageChange(currentPage + 1)}
          />
        </div>
      </div>
    );
  }

  // Default (full) variant
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      {/* Items info */}
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Showing <span className="font-medium">{startItem}</span> to{' '}
        <span className="font-medium">{endItem}</span> of{' '}
        <span className="font-medium">{totalItems}</span> results
      </p>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Page size selector */}
        {showPageSizeSelector && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-neutral-600 dark:text-neutral-400">
              Per page:
            </label>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 text-sm border rounded-lg border-neutral-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-neutral-900 dark:text-white"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Page buttons */}
        <div className="flex gap-1">
          {/* Previous button */}
          <Button
            variant="secondary"
            size="sm"
            icon={ChevronLeft}
            disabled={isFirstPage}
            onClick={() => onPageChange(currentPage - 1)}
            title="Previous page"
          />

          {/* Page numbers */}
          <div className="flex gap-1">
            {pageNumbers.map((page, idx) => {
              if (page === '...') {
                return (
                  <div
                    key={`ellipsis-${idx}`}
                    className="flex items-center justify-center w-8 h-8 text-neutral-400"
                  >
                    <MoreHorizontal size={16} />
                  </div>
                );
              }

              const isActive = page === currentPage;

              return (
                <Button
                  key={page}
                  variant={isActive ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => onPageChange(page)}
                  className="min-w-[32px]"
                  title={`Go to page ${page}`}
                >
                  {page}
                </Button>
              );
            })}
          </div>

          {/* Next button */}
          <Button
            variant="secondary"
            size="sm"
            icon={ChevronRight}
            disabled={isLastPage}
            onClick={() => onPageChange(currentPage + 1)}
            title="Next page"
          />
        </div>
      </div>
    </div>
  );
}
