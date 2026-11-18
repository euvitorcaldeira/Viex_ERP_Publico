import { describe, expect, it } from 'vitest';
import { compareTableValues, sortTableRows } from './tableSort';

describe('ordenação das tabelas', () => {
  it('compara moeda brasileira, valores negativos e datas pela ordem real', () => {
    expect(compareTableValues('R$ 90,00', 'R$ 1.000,00', 'asc')).toBeLessThan(0);
    expect(compareTableValues('-R$ 20,00', 'R$ 10,00', 'asc')).toBeLessThan(0);
    expect(compareTableValues('31/10/2026', '01/11/2026', 'asc')).toBeLessThan(0);
    expect(compareTableValues('2026-10-31', '2026-11-01', 'desc')).toBeGreaterThan(0);
  });

  it('ordena códigos naturalmente e mantém valores ausentes no fim nas duas direções', () => {
    expect(compareTableValues('NF 2', 'NF 10', 'asc')).toBeLessThan(0);
    expect(compareTableValues('A definir', '20/11/2026', 'asc')).toBeGreaterThan(0);
    expect(compareTableValues('A definir', '20/11/2026', 'desc')).toBeGreaterThan(0);
  });

  it('ordena toda a coleção antes da paginação, sem modificar a origem e preservando empates', () => {
    const rows = [{ id: 'a', value: 3 }, { id: 'b', value: 2 }, { id: 'c', value: 1 }, { id: 'd', value: 2 }];
    const ordered = sortTableRows(rows, { column: 0, direction: 'asc' }, row => [row.value]);
    expect(ordered.slice(0, 2).map(row => row.id)).toEqual(['c', 'b']);
    expect(ordered.map(row => row.id)).toEqual(['c', 'b', 'd', 'a']);
    expect(rows.map(row => row.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
