export type InvoiceRequestRow = { id: string; number: string; totalCents: number };
export type OpenInvoiceRow = { number: string; balanceCents: number };

export function buildOpenInvoiceText(invoices: OpenInvoiceRow[], formatAmount: (cents: number) => string): string {
  return invoices
    .filter(invoice => invoice.balanceCents > 0)
    .map(invoice => `NF ${invoice.number} -\n${formatAmount(invoice.balanceCents)}`)
    .join('\n\n');
}

export function buildInvoiceDateRequest(
  invoices: InvoiceRequestRow[],
  selectedIds: string[],
  formatAmount: (cents: number) => string,
  dates: Record<string, string> = {},
  formatDate: (date: string) => string = value => value,
): string {
  return invoices
    .filter(invoice => selectedIds.includes(invoice.id))
    .map(invoice => `NF ${invoice.number} -${dates[invoice.id] ? ` ${formatDate(dates[invoice.id])}` : ''}\n${formatAmount(invoice.totalCents)}`)
    .join('\n\n');
}
