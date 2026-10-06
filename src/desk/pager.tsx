import { useState } from 'react';

export const TABLE_PAGE_SIZE = 10;

export function usePagedRows<T>(rows: T[], resetKey: string) {
  const [page, setPage] = useState(1);
  const [seenKey, setSeenKey] = useState(resetKey);
  const pages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
  const requested = seenKey === resetKey ? page : 1;
  const current = Math.min(Math.max(requested, 1), pages);

  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setPage(1);
  } else if (page !== current) {
    setPage(current);
  }

  const start = (current - 1) * TABLE_PAGE_SIZE;
  return {
    page: current,
    pages,
    visible: rows.slice(start, start + TABLE_PAGE_SIZE),
    total: rows.length,
    setPage,
    from: rows.length === 0 ? 0 : start + 1,
    to: Math.min(start + TABLE_PAGE_SIZE, rows.length),
  };
}

function pageItems(page: number, pages: number): Array<number | 'gap'> {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  const items: Array<number | 'gap'> = [1];
  if (start > 2) items.push('gap');
  for (let index = start; index <= end; index += 1) items.push(index);
  if (end < pages - 1) items.push('gap');
  items.push(pages);
  return items;
}

export function TablePager({
  page,
  pages,
  total,
  from,
  to,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  from: number;
  to: number;
  onPage: (page: number) => void;
}) {
  if (total <= TABLE_PAGE_SIZE) return null;
  return (
    <nav className="dpager" aria-label="Paginación">
      <span>{from}–{to} de {total}</span>
      <div className="dpages">
        <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
        {pageItems(page, pages).map((item, index) => (
          item === 'gap'
            ? <span key={`gap-${index}`} className="gap" aria-hidden="true">…</span>
            : (
              <button
                key={item}
                type="button"
                className={item === page ? 'on' : ''}
                aria-label={`Página ${item}`}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onPage(item)}
              >
                {item}
              </button>
            )
        ))}
        <button type="button" aria-label="Página siguiente" disabled={page >= pages} onClick={() => onPage(page + 1)}>›</button>
      </div>
    </nav>
  );
}
