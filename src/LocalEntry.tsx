import { Brand } from './components/Brand';
import { useState } from 'react';
import { LockKeyhole, LogIn } from 'lucide-react';
import Application from './v4/Application';
import { localLogin, localLogout, localStatus } from './localApi';
import './style.css';

export default function LocalEntry(){
 const [status,setStatus]=useState(()=>localStatus());
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[error,setError]=useState('');
 if(status.available&&status.authenticated)return <Application localMode onLogout={()=>{try{localLogout()}finally{window.location.reload()}}}/>;
 const setup=!!status.setupRequired;
 function submit(event:React.FormEvent){event.preventDefault();setError('');try{localLogin(email,password,setup?name:undefined);setStatus({available:true,authenticated:true,setupRequired:false});}catch(e){setError(e instanceof Error?e.message:'Não foi possível entrar.');}}
 return <div className="app"><main className="access-shell"><section className="panel access-panel"><div className="access-brand"><Brand/></div><p className="eyebrow">ACESSO PRIVADO</p><h1>{!status.available?'Inicie o aplicativo':setup?'Configure o primeiro acesso':'Entre no VIEX ERP'}</h1><p className="subtitle">{!status.available?'O serviço local não está disponível. Abra VIEX.py para iniciar o sistema.':setup?'Crie a conta de administrador para proteger este computador.':'Use sua conta autorizada para abrir os dados locais.'}</p>
 {!status.available?<div className="notice compact">{status.error||'Inicie o sistema usando o arquivo VIEX.py.'}</div>:<form className="access-form" onSubmit={submit}>{setup&&<label>Seu nome<input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} required/></label>}<label>E-mail<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Senha<input type="password" autoComplete={setup?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={setup?12:1} required/>{setup&&<small>Use pelo menos 12 caracteres.</small>}</label>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" type="submit">{setup?<LockKeyhole size={17}/>:<LogIn size={17}/>} {setup?'Criar acesso de administrador':'Entrar'}</button></form>}
 <p className="footnote">Dados armazenados neste computador. O acesso ao sistema fica restrito a este dispositivo.</p></section></main></div>
}
