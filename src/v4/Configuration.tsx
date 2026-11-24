import { useScreenPreference } from '../components/screenPreferences';
import { itemDisplayOptions, type ItemDisplay } from '../components/RomaneioTable';
import { Maintenance } from './Maintenance';
import { Moon, Sun, Download, SlidersHorizontal, Building2, Database } from 'lucide-react';
import { type State } from '../v3/domain';
import { type Commit } from '../v3/common';
import { Registry, registrySections } from './Registry';
import { DataProtection } from './DataProtection';
import { HistoryImport } from './HistoryImport';
import { SystemIdentitySettings } from './SystemIdentitySettings';
import './configuration.css';

export function Configuration({itemDisplay,onItemDisplay,state,commit,dark,localMode=false,onTheme,onExport,onReset,onUsersChange,onHistoryImported}:{itemDisplay:ItemDisplay;onItemDisplay:(mode:ItemDisplay)=>void;state:State;commit:Commit;dark:boolean;localMode?:boolean;onTheme:()=>void;onExport:()=>void;onReset:()=>void;onUsersChange?:(users:NonNullable<State['users']>)=>void;onHistoryImported?:(state:State)=>void}){
  const [tab, setTab] = useScreenPreference('configuracoes:aba','Aparência');
  const groups = [
    { title: 'Preferências', icon: SlidersHorizontal, pages: ['Aparência'] },
    { title: 'Empresa', icon: Building2, pages: [...registrySections, 'Nome do sistema'] },
    { title: 'Dados', icon: Database, pages: localMode
      ? ['Proteção de dados', ...(onHistoryImported ? ['Importar histórico'] : []), 'Manutenção', 'Exportar dados']
      : ['Exportar dados', 'Demonstração'] },
  ];

  return <div className="configuration-layout">
    <nav className="panel configuration-nav" aria-label="Seções de configurações">
      {groups.map(({ title, icon: Icon, pages }) => <div className="configuration-group" key={title}>
        <h2><Icon size={15} aria-hidden="true" />{title}</h2>
        {pages.map(page => <button type="button" key={page} aria-current={page === tab ? 'page' : undefined}
          onClick={() => setTab(page)}>{page}</button>)}
      </div>)}
    </nav>
    <div className="configuration-content">
      {registrySections.filter(section => section === tab).map(section => <Registry key={section} tab={section} state={state} commit={commit} localMode={localMode} onUsersChange={onUsersChange} />)}
      {tab === 'Nome do sistema' && <SystemIdentitySettings state={state} commit={commit} />}
      {tab === 'Proteção de dados' && <DataProtection />}
      {tab === 'Importar histórico' && onHistoryImported && <HistoryImport onImported={onHistoryImported} />}
      {tab === 'Manutenção' && <Maintenance state={state} commit={commit} />}
      {tab === 'Aparência' && <section className="panel configuration-panel">
        <h2>Aparência</h2>
        <div className="configuration-option">
          <div><h3>Tema</h3><p>{dark ? 'Tema escuro ativo' : 'Tema claro ativo'}</p></div>
          <button type="button" className="secondary" onClick={onTheme}>{dark ? <Sun size={16} /> : <Moon size={16} />} {dark ? 'Usar tema claro' : 'Usar tema escuro'}</button>
        </div>
        <div className="configuration-option">
          <div><h3><label htmlFor="configuration-item-display">Coluna de itens em Romaneios</label></h3><p>Escolha o que aparece na lista de romaneios.</p></div>
          <select id="configuration-item-display" value={itemDisplay} onChange={event => onItemDisplay(event.target.value as ItemDisplay)}>
            {Object.entries(itemDisplayOptions).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}
          </select>
        </div>
      </section>}
      {tab === 'Exportar dados' && <section className="panel configuration-panel">
        <h2>{localMode ? 'Exportar dados' : 'Exportar demonstração'}</h2>
        <div className="configuration-option">
          <div><h3>Arquivo JSON</h3><p>Inclui registros e histórico disponíveis para seu perfil.</p></div>
          <button type="button" className="secondary" onClick={onExport}><Download size={16} />Exportar JSON</button>
        </div>
      </section>}
      {tab === 'Demonstração' && <section className="panel configuration-panel">
        <h2>Demonstração</h2>
        <div className="configuration-option">
          <div><h3>Restaurar exemplos</h3><p>Restaura os dados fictícios da versão atual.</p></div>
          <button type="button" className="secondary danger" onClick={onReset}>Restaurar exemplos</button>
        </div>
      </section>}
    </div>
  </div>;
}
