import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Printer,
  Search,
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
import { Checkbox } from './checkbox';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '../../lib/utils';

export interface DataTableColumn<T> {
  id: string;
  header: string;
  accessor: (row: T) => string | number;
  cell?: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
  sortable?: boolean;
  defaultHidden?: boolean;
  widthClass?: string;
}

export interface DataTableBulkAction<T> {
  id: string;
  label: string;
  variant?: 'default' | 'destructive' | 'outline';
  onClick: (selectedRows: T[]) => void;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  searchPlaceholder?: string;
  emptyText?: string;
  pageSizeDefault?: number;
  selectable?: boolean;
  bulkActions?: DataTableBulkAction<T>[];
  onExportExcel?: (rows: T[]) => void;
  onExportPdf?: () => void;
  toolbarExtra?: React.ReactNode;
  maxHeightClass?: string;
  labels?: {
    columns?: string;
    selected?: string;
    rowsPerPage?: string;
    page?: string;
    of?: string;
    exportExcel?: string;
    exportPdf?: string;
  };
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchPlaceholder = 'Tìm kiếm...',
  emptyText = 'Không có dữ liệu',
  pageSizeDefault = 10,
  selectable = true,
  bulkActions = [],
  onExportExcel,
  onExportPdf,
  toolbarExtra,
  maxHeightClass = 'max-h-[480px]',
  labels,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeDefault);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id))
  );

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenCols.has(c.id)),
    [columns, hiddenCols]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      columns.some((col) => String(col.accessor(row) ?? '').toLowerCase().includes(q))
    );
  }, [data, columns, search]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    const col = columns.find((c) => c.id === sortCol);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const va = col.accessor(a);
      const vb = col.accessor(b);
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [filtered, columns, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  const toggleSort = (colId: string) => {
    if (sortCol === colId) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(colId);
      setSortDir('desc');
    }
  };

  const toggleColVisibility = (colId: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else if (visibleColumns.length > 1) next.add(colId);
      return next;
    });
  };

  const allPagedSelected =
    pagedRows.length > 0 && pagedRows.every((r) => selectedIds.has(getRowId(r)));

  const toggleAllPaged = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPagedSelected) {
        pagedRows.forEach((r) => next.delete(getRowId(r)));
      } else {
        pagedRows.forEach((r) => next.add(getRowId(r)));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedRows = useMemo(
    () => sorted.filter((r) => selectedIds.has(getRowId(r))),
    [sorted, selectedIds, getRowId]
  );

  return (
    <div className="space-y-2.5">
      {/* Compact 40px Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative w-full max-w-[260px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              className="h-[34px] w-full rounded-md border border-slate-200 bg-white pl-8 pr-2.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          {toolbarExtra}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {selectedRows.length > 0 && bulkActions.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50/80 px-2 py-1 text-[11px] dark:border-cyan-800 dark:bg-cyan-950/50">
              <span className="font-mono-num font-semibold text-cyan-800 dark:text-cyan-300">
                {selectedRows.length} {labels?.selected || 'selected'}
              </span>
              {bulkActions.map((act) => (
                <Button
                  key={act.id}
                  size="sm"
                  variant={act.variant || 'outline'}
                  onClick={() => {
                    act.onClick(selectedRows);
                    setSelectedIds(new Set());
                  }}
                >
                  {act.label}
                </Button>
              ))}
            </div>
          )}

          {/* Column Visibility */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="h-3.5 w-3.5" />
                <span>{labels?.columns || 'Columns'}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="end">
              <div className="space-y-1.5">
                {columns.map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 rounded px-1.5 py-1 text-[12px] hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Checkbox
                      checked={!hiddenCols.has(col.id)}
                      onCheckedChange={() => toggleColVisibility(col.id)}
                    />
                    <span className="truncate">{col.header}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {onExportExcel && (
            <Button variant="outline" size="sm" onClick={() => onExportExcel(sorted)}>
              <Download className="h-3.5 w-3.5" />
              <span>{labels?.exportExcel || 'Excel'}</span>
            </Button>
          )}
          {onExportPdf && (
            <Button variant="outline" size="sm" onClick={onExportPdf}>
              <Printer className="h-3.5 w-3.5" />
              <span>{labels?.exportPdf || 'PDF'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Compact Sticky-Header Table Container */}
      <div className={cn('overflow-auto rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900', maxHeightClass)}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectable && (
                <TableHead className="w-9 px-2.5">
                  <Checkbox checked={allPagedSelected} onCheckedChange={toggleAllPaged} aria-label="Select all" />
                </TableHead>
              )}
              {visibleColumns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn(col.align === 'right' && 'text-right', col.widthClass)}
                >
                  {col.sortable !== false ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.id)}
                      className={cn(
                        'inline-flex items-center gap-1 font-semibold hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer',
                        col.align === 'right' && 'flex-row-reverse'
                      )}
                    >
                      <span>{col.header}</span>
                      {sortCol === col.id ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-cyan-600" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-cyan-600" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                  className="h-24 text-center text-slate-400"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((row) => {
                const rowId = getRowId(row);
                const isSelected = selectedIds.has(rowId);
                return (
                  <TableRow key={rowId} data-state={isSelected ? 'selected' : undefined}>
                    {selectable && (
                      <TableCell className="w-9 px-2.5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(rowId)}
                          aria-label={`Select row ${rowId}`}
                        />
                      </TableCell>
                    )}
                    {visibleColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn(col.align === 'right' && 'text-right font-mono-num')}
                      >
                        {col.cell ? col.cell(row) : String(col.accessor(row) ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Compact Pagination Footer */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2 font-mono-num">
          <span>Total: {sorted.length}</span>
          <span aria-hidden="true">·</span>
          <label className="flex items-center gap-1.5">
            <span>{labels?.rowsPerPage || 'Rows'}:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-7 rounded border border-slate-200 bg-white px-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-1.5 font-mono-num">
          <span>
            {labels?.page || 'Page'} {safePage} {labels?.of || '/'} {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
