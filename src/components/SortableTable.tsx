import { Children, Fragment, cloneElement, isValidElement, useContext, type ReactElement, type ReactNode, type TableHTMLAttributes } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { sortTableRows, type ColumnSort, type SortValue } from './tableSort';
import './sortableTable.css';
import { ScreenPreferenceScope, useScreenPreference } from './screenPreferences';

type NodeProps = { children?: ReactNode; value?: string | number; defaultValue?: string | number; 'data-sort-value'?: SortValue };
type Element = ReactElement<NodeProps>;

function elements(children: ReactNode): Element[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<NodeProps>(child)) return [];
    return child.type === Fragment ? elements(child.props.children) : [child];
  });
}

function textValue(children: ReactNode): string {
  return Children.toArray(children).map(child => {
    if (typeof child === 'string' || typeof child === 'number') return String(child);
    if (!isValidElement<NodeProps>(child)) return '';
    if (child.props['data-sort-value'] !== undefined) return String(child.props['data-sort-value'] ?? '');
    if (child.type === 'input' || child.type === 'select') return String(child.props.value ?? child.props.defaultValue ?? '');
    return textValue(child.props.children);
  }).join(' ').replace(/\s+/g, ' ').trim();
}

export function SortableTable({ children, sort: controlledSort, defaultSort, onSortChange, ...props }: TableHTMLAttributes<HTMLTableElement> & {
  sort?: ColumnSort | null;
  defaultSort?: ColumnSort;
  onSortChange?: (sort: ColumnSort) => void;
}) {
  const scope = useContext(ScreenPreferenceScope);
  const headings = elements(children).filter(section => section.type === 'thead').flatMap(section =>
    elements(section.props.children).flatMap(row => elements(row.props.children).map(cell => textValue(cell.props.children))));
  const [localSort, setLocalSort] = useScreenPreference<ColumnSort | null>(
    'sort:' + JSON.stringify([scope, headings]), defaultSort ?? null,
  );
  const sort = controlledSort === undefined ? localSort : controlledSort;

  function toggle(column: number) {
    const next: ColumnSort = { column, direction: sort?.column === column && sort.direction === 'asc' ? 'desc' : 'asc' };
    if (onSortChange) onSortChange(next);
    else setLocalSort(next);
  }

  return <table {...props}>{elements(children).map((section, sectionIndex) => {
    if (section.type === 'thead') return cloneElement(section, { key: section.key ?? sectionIndex }, elements(section.props.children).map((row, rowIndex) =>
      cloneElement(row, { key: row.key ?? rowIndex }, elements(row.props.children).map((header, column) => {
        const label = textValue(header.props.children);
        if (header.type !== 'th' || /^(ações|selecionar|grupo)$/i.test(label)) return cloneElement(header, { key: column });
        const active = sort?.column === column;
        const Icon = active ? sort.direction === 'asc' ? ArrowUp : ArrowDown : ArrowUpDown;
        return <th key={column} aria-sort={active ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}>
          <button type="button" className="table-sort-button" title={`Ordenar por ${label} em ordem ${active && sort.direction === 'asc' ? 'decrescente' : 'crescente'}`} onClick={() => toggle(column)}>
            <span>{header.props.children}</span><Icon aria-hidden="true" size={12} />
          </button>
        </th>;
      })),
    ));
    if (section.type === 'tbody' && !onSortChange) {
      const rows = sortTableRows(elements(section.props.children), sort, row => elements(row.props.children).map(cell =>
        cell.props['data-sort-value'] !== undefined ? cell.props['data-sort-value'] : textValue(cell.props.children),
      ));
      return cloneElement(section, { key: section.key ?? sectionIndex }, rows);
    }
    return cloneElement(section, { key: section.key ?? sectionIndex });
  })}</table>;
}
