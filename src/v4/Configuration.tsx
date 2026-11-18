import { Maintenance } from './Maintenance';
import { useState } from 'react';
import { Moon, Sun, Download } from 'lucide-react';
import { type State } from '../v3/domain';
import { type Commit } from '../v3/common';
import { Registry } from './Registry';
import { DataProtection } from './DataProtection';
import { HistoryImport } from './HistoryImport';
import { SystemIdentitySettings } from './SystemIdentitySettings';
export function Configuration({state,commit,dark,localMode=false,onTheme,onExport,onReset,onUsersChange,onHistoryImported}:{state:State;commit:Commit;dark:boolean;localMode?:boolean;onTheme:()=>void;onExport:()=>void;onReset:()=>void;onUsersChange?:(users:NonNullable<State['users']>)=>void;onHistoryImported?:(state:State)=>void}){
 const [tab,setTab]=useState('Cadastros gerais');
 const localTabs=['Cadastros gerais','Nome do sistema','Proteção de dados','Manutenção',...(onHistoryImported?['Importar histórico']:[])];
 const tabs=localMode?localTabs:['Cadastros gerais','Nome do sistema','Ambiente'];
 return <><div className="module-actions"><div className="tabs">{tabs.map(t=><button key={t} className={tab===t?'selected':''} onClick={()=>setTab(t)}>{t}</button>)}</div></div>{tab==='Cadastros gerais'?<Registry state={state} commit={commit} localMode={localMode} onUsersChange={onUsersChange}/>:tab==='Nome do sistema'?<SystemIdentitySettings state={state} commit={commit}/>:localMode&&tab==='Manutenção'?<Maintenance state={state} commit={commit}/>:localMode&&tab==='Proteção de dados'?<DataProtection/>:localMode&&tab==='Importar histórico'&&onHistoryImported?<HistoryImport onImported={onHistoryImported}/>:<section className="panel settings"><h2>{localMode?'Configurações locais':'Seu ambiente de teste'}</h2><p>{localMode?'Aparência do aplicativo neste computador.':'Personalize a visualização e gerencie os dados fictícios.'}</p><div><span><b>Aparência</b><small>Escolha o tema mais confortável para trabalhar.</small></span><button className="secondary" onClick={onTheme}>{dark?<Sun size={18}/>:<Moon size={18}/>} {dark?'Usar tema claro':'Usar tema escuro'}</button></div><div><span><b>{localMode?'Exportar dados':'Exportar demonstração'}</b><small>Inclui registros e histórico disponíveis para seu perfil.</small></span><button className="secondary" onClick={onExport}><Download size={18}/> Exportar JSON</button></div>{!localMode&&<><div><span><b>Recomeçar demonstração</b><small>Restaura exemplos V4. Preserva as chaves V1, V2 e V3.</small></span><button className="secondary danger" onClick={onReset}>Restaurar exemplos</button></div><div><span><b>Login e permissões</b><small>O cadastro de usuários é demonstrativo. Não há autenticação real nesta etapa.</small></span><span className="badge waiting">Etapa futura</span></div></>}</section>}</>
}
