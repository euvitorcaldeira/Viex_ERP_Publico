import { describe, expect, it } from 'vitest';
import { buildInvoiceDateRequest, buildOpenInvoiceText } from './financeExport';

describe('mensagem de solicitação de datas das notas', () => {
  const invoices = [
    { id: 'i169', number: '169', totalCents: 1_036_000 },
    { id: 'i170', number: '170', totalCents: 494_000 },
    { id: 'i171', number: '171', totalCents: 748_000 },
  ];
  const brl = (cents: number) => `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  it('formata no modelo de WhatsApp e inclui apenas as notas selecionadas', () => {
    expect(buildInvoiceDateRequest(invoices, ['i169', 'i171'], brl)).toBe(
      'NF 169 -\nR$ 10.360,00\n\nNF 171 -\nR$ 7.480,00',
    );
  });

  it('inclui a data escolhida no modelo preenchido', () => {
    expect(buildInvoiceDateRequest(invoices, ['i170'], brl, { i170: '2026-11-20' }, date => date.split('-').reverse().join('/'))).toBe(
      'NF 170 - 20/11/2026\nR$ 4.940,00',
    );
  });

  it('gera texto vazio quando nenhuma nota foi selecionada', () => {
    expect(buildInvoiceDateRequest(invoices, [], brl)).toBe('');
  });

  it('exporta somente notas com saldo em aberto e usa o saldo restante', () => {
    expect(buildOpenInvoiceText([
      { number: '169', balanceCents: 1_036_000 },
      { number: '170', balanceCents: 0 },
      { number: '171', balanceCents: 300_000 },
    ], brl)).toBe('NF 169 -\nR$ 10.360,00\n\nNF 171 -\nR$ 3.000,00');
  });
});
