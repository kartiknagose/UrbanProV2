/**
 * Table Component
 * Reusable data table with sorting, pagination, filtering
 *
 * Replaces scattered table implementations across admin/analytics pages.
 * Provides consistent table styling and interactions.
 * 
 * Usage:
 * <Table
 *   columns={[
 *     { key: 'id', label: 'ID', width: '80px', sortable: true },
 *     { key: 'name', label: 'Name', sortable: true },
 *   ]}
 *   data={items}
 *   rowKey="id"
 *   onRowClick={(row) => navigate(...)}
 * />
 */

import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronUpDown } from 'lucide-react';
import { motion as Motion } from 'framer-motion';

export function Table({
  columns = [],
  data = [],
  rowKey = 'id',
  onRowClick = null,
  sortable = true,
  striped = true,
  hoverable = true,
  compact = false,
  loading = false,
  emptyState = null,
  pagination = null, // { current, total, pageSize, onChange }
  variant = 'default', // default, compact, minimal
  className = '',
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Handle sort
  const handleSort = (columnKey) => {
    if (!sortable) return;

    setSortConfig(prev => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Sorted data
  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0;

    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) {
    return (
      <div className={`animate-pulse space-y-3 ${className}`}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-12 bg-neutral-200 dark:bg-dark-700 rounded" />
        ))}
      </div>
    );
  }

  if (!data.length && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  const sizeClass = compact ? 'py-2 px-3' : 'py-4 px-4';
  const headerBg = variant === 'minimal' ? '' : 'bg-neutral-50 dark:bg-dark-900';
  const rowBg = striped
    ? 'even:bg-neutral-50 dark:even:bg-dark-900/40'
    : '';

  return (
    <div className={`overflow-x-auto rounded-lg border border-neutral-200 dark:border-dark-700 ${className}`}>
      <table className="w-full text-left">
        {/* Header */}
        <thead>
          <tr className={`${headerBg} border-b border-neutral-200 dark:border-dark-700`}>
            {columns.map(col => (
              <th
                key={col.key}
                style={{ width: col.width }}
                onClick={() => col.sortable && handleSort(col.key)}
                className={`
                  ${sizeClass}
                  text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider
                  ${col.sortable && sortable ? 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-dark-800' : ''}
                `}
              >
                <div className="flex items-center gap-2">
                  <span>{col.label}</span>
                  {col.sortable && sortable && (
                    <SortIcon
                      isActive={sortConfig.key === col.key}
                      direction={sortConfig.direction}
                    />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {sortedData.map((row, idx) => (
            <Motion.tr
              key={row[rowKey] || idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.02 }}
              onClick={() => onRowClick?.(row)}
              className={`
                border-b border-neutral-200 dark:border-dark-700 last:border-b-0
                ${rowBg}
                ${hoverable && onRowClick ? 'hover:bg-brand-50 dark:hover:bg-brand-500/10 cursor-pointer' : ''}
                transition-colors
              `}
            >
              {columns.map(col => (
                <td
                  key={`${row[rowKey]}-${col.key}`}
                  style={{ width: col.width }}
                  className={`${sizeClass} text-neutral-900 dark:text-neutral-100 text-sm`}
                >
                  {/* Render cell content */}
                  {col.render ? (
                    col.render(row[col.key], row)
                  ) : (
                    <span>{row[col.key]}</span>
                  )}
                </td>
              ))}
            </Motion.tr>
          ))}
        </tbody>
      </table>

      {/* Pagination footer */}
      {pagination && (
        <div className="px-4 py-3 border-t border-neutral-200 dark:border-dark-700 bg-neutral-50 dark:bg-dark-900">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">
              Page {pagination.current} of {Math.ceil(pagination.total / pagination.pageSize)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => pagination.onChange(pagination.current - 1)}
                disabled={pagination.current === 1}
                className="px-2 py-1 rounded hover:bg-neutral-200 dark:hover:bg-dark-700 disabled:opacity-50"
              >
                ← Prev
              </button>
              <button
                onClick={() => pagination.onChange(pagination.current + 1)}
                disabled={pagination.current * pagination.pageSize >= pagination.total}
                className="px-2 py-1 rounded hover:bg-neutral-200 dark:hover:bg-dark-700 disabled:opacity-50"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Sort icon indicator
 */
function SortIcon({ isActive, direction }) {
  if (!isActive) {
    return <ChevronUpDown size={14} className="text-neutral-400" />;
  }

  return direction === 'asc' ? (
    <ChevronUp size={14} className="text-brand-500" />
  ) : (
    <ChevronDown size={14} className="text-brand-500" />
  );
}

/**
 * TableSkeleton - Loading state for tables
 */
export function TableSkeleton({ rows = 5, _columns = 4 }) {
  return (
    <div className="space-y-2">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-12 bg-neutral-200 dark:bg-dark-700 rounded animate-pulse" />
      ))}
    </div>
  );
}
