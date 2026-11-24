import { SortableTable } from '../components/SortableTable';
import { useState } from 'react';
import { useFormError } from '../components/useFormError';
import { type State, type Client, type UserProfile, uid } from '../v3/domain';
import { type Commit } from '../v3/common';
import { Employees } from '../v3/Employees';
import { Workshops } from '../v3/Workshops';
import { Modal } from '../components/Modal';
import { saveClient, saveUser } from './domain';
import { createLocalUser, updateLocalUser } from '../localApi';

const isUser=(item:Client|UserProfile):item is UserProfile=>'email' in item && 'role' in item;

export const registrySections = ['Clientes','Funcionários','Oficinas','Usuários'] as const;
export type RegistrySection = typeof registrySections[number];

export function Registry({tab,state,commit,localMode=false,onUsersChange}:{tab:RegistrySection;state:State;commit:Commit;localMode?:boolean;onUsersChange?:(users:NonNullable<State['users']>)=>void}){
 const [client,setClient]=useState<Client|null>(null),[user,setUser]=useState<UserProfile|null>(null),[password,setPassword]=useState(''),[error,setError]=useFormError(),[inactive,setInactive]=useState(false),[users,setUsers]=useState(state.users||[]);
 function closeUser(){setUser(null);setPassword('');setError('')}
 function saveAccount(){
  if(!user)return;
  try{
   const existing=users.some(u=>u.id===user.id);
   if(!existing&&password.length<12)throw new Error('Defina uma senha com pelo menos 12 caracteres.');
   const nextUsers=existing&&localMode?updateLocalUser(user.id,{name:user.name,email:user.email,role:user.role,active:user.active,...(password?{password}:{})}):!existing&&localMode?createLocalUser({...user,password}):null;
   if(nextUsers){setUsers(nextUsers);onUsersChange?.(nextUsers);closeUser();return}
   const err=commit(s=>saveUser(s,user),'Usuário salvo.');setError(err||'');if(!err)closeUser();
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar o usuário.')}
 }
 function toggle(item:Client|UserProfile){
  if(!window.confirm(`${item.active?'Desativar':'Reativar'} ${item.name}? Os vínculos e o histórico serão preservados.`))return;
  if(isUser(item)&&localMode){try{const next=updateLocalUser(item.id,{active:!item.active})||[];setUsers(next);onUsersChange?.(next)}catch(e){setError(e instanceof Error?e.message:'Não foi possível atualizar o acesso.')}return}
  commit(s=>isUser(item)?saveUser(s,{...item,active:!item.active}):saveClient(s,{...item,active:!item.active}),'Cadastro atualizado.');
 }
 const rows=tab==='Clientes'?(state.clients||[]):users;
 return <>
  {(tab==='Clientes'||tab==='Usuários')&&<div className="module-actions">
   <h2>{tab}</h2>
   {tab==='Clientes'&&<button className="primary" onClick={()=>{setClient({id:uid(),name:'',active:true});setError('')}}>Cadastrar cliente</button>}
   {tab==='Usuários'&&<button className="primary" onClick={()=>{setUser({id:uid(),name:'',email:'',role:'Operação',active:true});setPassword('');setError('')}}>{localMode?'Convidar usuário':'Cadastrar usuário'}</button>}
  </div>}
  {tab==='Funcionários'&&<Employees key="registry-employees" state={state} commit={commit} mode="registry"/>}
  {tab==='Oficinas'&&<Workshops state={state} commit={commit} mode="registry" onOpen={()=>{}}/>}
  {(tab==='Clientes'||tab==='Usuários')&&<section className="panel"><div className="toolbar"><label className="check-label"><input type="checkbox" checked={inactive} onChange={e=>setInactive(e.target.checked)}/> Mostrar inativos</label></div>
   {tab==='Usuários'&&<div className="notice compact registry-note">{localMode?'Acesso privado: novas contas só podem ser criadas por um Administrador. Senhas nunca aparecem nesta lista.':'Cadastros demonstrativos, sem senha ou controle de acesso real.'}</div>}
   <div className="table-wrap"><SortableTable><thead><tr><th>Nome</th>{tab==='Usuários'&&<><th>E-mail</th><th>Perfil</th></>}<th>Situação</th>{tab==='Clientes'&&<th>Padrão</th>}<th>Ações</th></tr></thead><tbody>
    {rows.filter(item=>inactive||item.active).map(item=><tr key={item.id}><td>{item.name}</td>{isUser(item)&&<><td>{item.email}</td><td>{item.role}</td></>}<td><span className={'badge '+(item.active?'done':'waiting')}>{item.active?'Ativo':'Inativo'}</span></td>{!isUser(item)&&<td>{item.isDefault?'Sim':'—'}</td>}<td><div className="inline-actions">
     <button className="text-link" onClick={()=>{setError('');if(isUser(item)){setUser({...item});setPassword('')}else setClient({...item})}}>Editar</button>
     {!isUser(item)&&item.active&&!item.isDefault&&<button className="text-link" onClick={()=>commit(s=>saveClient(s,{...item,isDefault:true}),'Cliente padrão atualizado.')}>Tornar padrão</button>}<button className="text-link" onClick={()=>toggle(item)}>{item.active?'Desativar':'Reativar'}</button>
    </div></td></tr>)}
   </tbody></SortableTable></div>
  </section>}
  {client&&<Modal title="Cadastro de cliente" subtitle="CADASTROS GERAIS" onClose={()=>setClient(null)} footer={<><button className="secondary" onClick={()=>setClient(null)}>Cancelar</button><button className="primary" onClick={()=>{const err=commit(s=>saveClient(s,client),'Cliente salvo.');setError(err||'');if(!err)setClient(null)}}>Salvar cliente</button></>}><div className="modal-body"><label>Nome do cliente<input value={client.name} onChange={e=>setClient({...client,name:e.target.value})}/></label>{error&&<p className="error" role="alert">{error}</p>}</div></Modal>}
  {user&&<Modal title={users.some(u=>u.id===user.id)?'Editar acesso':'Convidar usuário'} subtitle={localMode?'ACESSO LOCAL PROTEGIDO':'CADASTRO DEMONSTRATIVO'} onClose={closeUser} footer={<><button className="secondary" onClick={closeUser}>Cancelar</button><button className="primary" onClick={saveAccount}>{localMode?'Salvar acesso':'Salvar usuário'}</button></>}><div className="modal-body"><div className="form-grid"><label>Nome<input value={user.name} onChange={e=>setUser({...user,name:e.target.value})}/></label><label>E-mail<input type="email" value={user.email} onChange={e=>setUser({...user,email:e.target.value})}/></label><label>Perfil<select value={user.role} onChange={e=>setUser({...user,role:e.target.value as UserProfile['role']})}><option>Administrador</option><option>Operação</option><option>Consulta</option></select></label>{localMode&&<label>{users.some(u=>u.id===user.id)?'Nova senha (opcional)':'Senha inicial'}<input type="password" autoComplete="new-password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} required={!users.some(u=>u.id===user.id)}/><small>Use pelo menos 12 caracteres.</small></label>}</div>{error&&<p className="error" role="alert">{error}</p>}</div></Modal>}
 </>
}
