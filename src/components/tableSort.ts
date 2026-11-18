export type SortValue = string | number | null | undefined;
export type ColumnSort = { column: number; direction: 'asc' | 'desc' };

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

export function tableSortValue(value: SortValue): string | number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = value?.replace(/\s+/g, ' ').trim() ?? '';
  if (!text || text === '—' || /^(a definir|sem data|não informad)/i.test(text)) return null;
  const date = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (date) return Number(date[3] + date[2] + date[1]);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return Number(text.replaceAll('-', ''));
  const currency = text.match(/^(-?)R\$\s*(-?[\d.,]+)/);
  if (currency) return Number(currency[2].replaceAll('.', '').replace(',', '.')) * (currency[1] ? -1 : 1);
  if (/^-?\d+(?:[.,]\d+)?%?$/.test(text)) return Number(text.replace('%', '').replace(',', '.'));
  return text;
}

export function compareTableValues(left: SortValue, right: SortValue, direction: ColumnSort['direction']): number {
  const a = tableSortValue(left), b = tableSortValue(right);
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  const compared = typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b));
  return direction === 'asc' ? compared : -compared;
}

export function sortTableRows<T>(rows: T[], sort: ColumnSort | null, values: (row: T) => SortValue[]): T[] {
  if (!sort) return rows;
  return rows.map((row, index) => ({ row, index })).sort((a, b) =>
    compareTableValues(values(a.row)[sort.column], values(b.row)[sort.column], sort.direction) || a.index - b.index,
  ).map(item => item.row);
}
