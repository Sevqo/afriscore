import { useLayoutEffect, useRef, type TableHTMLAttributes } from 'react';
/** Label compact tables for stacked mobile records; wide ledgers keep contained scrolling. */
export function DataTable(props: TableHTMLAttributes<HTMLTableElement>) {
  const ref = useRef<HTMLTableElement>(null);
  useLayoutEffect(() => {
    const table = ref.current;
    if (!table) return;
    const headers = Array.from(table.querySelectorAll('thead th')).map(
      (th) => th.textContent?.trim() || 'Actions',
    );
    table.classList.toggle(
      'stackable',
      headers.length > 0 && headers.length <= 5,
    );
    table
      .querySelectorAll('thead th')
      .forEach((th) => th.setAttribute('scope', 'col'));
    table.querySelectorAll('tbody tr').forEach((row) =>
      Array.from(row.children).forEach((cell, i) => {
        cell.setAttribute('data-label', headers[i] || 'Details');
        if (
          /amount|total|invoiced|outstanding|paid|debit|credit|balance/i.test(
            headers[i] || '',
          )
        )
          cell.classList.add('numeric');
      }),
    );
  });
  return <table {...props} ref={ref} role="table" />;
}
