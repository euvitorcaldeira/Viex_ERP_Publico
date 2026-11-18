import type { Actor } from './security/policy';
import type { State } from './v3/domain';

let csrfToken = '';
let dataRevision = 0;
let signedInActor: Actor | null = null;

export interface LocalStatus {
  available: boolean;
  setupRequired?: boolean;
  authenticated?: boolean;
  error?: string;
}

function request<T>(method: string, route: string, body?: unknown): T {
  const xhr = new XMLHttpRequest();
  xhr.open(method, route, false);
  xhr.setRequestHeader('Accept', 'application/json');
  if (body !== undefined) xhr.setRequestHeader('Content-Type', 'application/json');
  if (csrfToken && method !== 'GET') xhr.setRequestHeader('X-Dalex-CSRF', csrfToken);
  xhr.send(body === undefined ? null : JSON.stringify(body));
  let response: { error?: string; [key: string]: unknown } = {};
  try { response = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch { /* handled below */ }
  if (xhr.status < 200 || xhr.status >= 300) {
    if (xhr.status === 401) { csrfToken = ''; signedInActor = null; }
    throw new Error(response.error || 'Não foi possível concluir a operação local.');
  }
  return response as T;
}

export function localStatus(): LocalStatus {
  try {
    const response = request<{setupRequired:boolean;authenticated:boolean;actor?:Actor;csrf?:string}>('GET','/api/status');
    if (response.authenticated && response.actor && response.csrf) {
      signedInActor = {...response.actor, source:'authenticated'};
      csrfToken = response.csrf;
    }
    return {available:true,setupRequired:response.setupRequired,authenticated:response.authenticated};
  } catch (error) {
    return {available:false,error:error instanceof Error?error.message:'O serviço local do D’ALEX não está ativo.'};
  }
}

export function localActor(): Actor {
  if (!signedInActor) throw new Error('Entre novamente no D’ALEX.');
  return signedInActor;
}

export function localLogin(email:string,password:string,name?:string): void {
  const setup = name !== undefined;
  const response = request<{actor:Actor;csrf:string}>('POST',setup?'/api/setup':'/api/login',setup?{name,email,password}:{email,password});
  signedInActor = {...response.actor,source:'authenticated'};
  csrfToken = response.csrf;
}

export function localLogout(): void {
  request('POST','/api/logout',{});
  csrfToken = ''; signedInActor = null; dataRevision = 0;
}

export function loadLocalState(): State {
  const response = request<{state:State;revision:number}>('GET','/api/state');
  dataRevision = response.revision;
  return response.state;
}

export function saveLocalState(state:State): void {
  const response = request<{revision:number}>('PUT','/api/state',{state,revision:dataRevision});
  dataRevision = response.revision;
}

export interface LocalUserInput {id?:string;name:string;email:string;role:'Administrador'|'Operação'|'Consulta';active?:boolean;password?:string}
export function createLocalUser(user:LocalUserInput): State['users'] {
  const response=request<{users:NonNullable<State['users']>}>('POST','/api/users',user);
  return response.users;
}
export function updateLocalUser(id:string,user:Partial<LocalUserInput>): State['users'] {
  const response=request<{users:NonNullable<State['users']>}>('PUT',`/api/users/${encodeURIComponent(id)}`,user);
  return response.users;
}

async function protectedFetch(route:string,init:RequestInit={}):Promise<Response>{
  const headers=new Headers(init.headers);
  headers.set('Accept','application/json');
  if(csrfToken&&init.method&&init.method!=='GET')headers.set('X-Dalex-CSRF',csrfToken);
  const response=await fetch(route,{...init,headers,credentials:'same-origin'});
  if(!response.ok){let payload:{error?:string}={};try{payload=await response.json()}catch{/* generic response */}throw new Error(payload.error||'Não foi possível concluir a operação local.')}
  return response;
}

export interface LocalBackup {name:string;size:number;modified:string;automatic:boolean}
export async function listLocalBackups():Promise<LocalBackup[]>{return (await (await protectedFetch('/api/backups')).json() as {backups:LocalBackup[]}).backups}
export async function createLocalBackup():Promise<void>{await protectedFetch('/api/backups',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})}
export async function restoreLocalBackup(file:File):Promise<void>{await protectedFetch('/api/restore',{method:'POST',headers:{'Content-Type':'application/zip'},body:file})}

export interface HistoryPreview {
  counts: Record<string, number>;
  token: string;
}

const workbookType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function previewLocalHistory(file: File): Promise<HistoryPreview> {
  const response = await protectedFetch('/api/history/preview', {
    method: 'POST', headers: { 'Content-Type': workbookType }, body: file,
  });
  return response.json();
}

export async function importLocalHistory(file: File, token: string): Promise<State> {
  const response = await protectedFetch(`/api/history/import?preview=${encodeURIComponent(token)}`, {
    method: 'POST', headers: { 'Content-Type': workbookType }, body: file,
  });
  const result = await response.json() as { state: State; revision: number };
  dataRevision = result.revision;
  return result.state;
}

export async function downloadLocalFile(route:string):Promise<void>{
  const response=await protectedFetch(route);const blob=await response.blob();
  const disposition=response.headers.get('Content-Disposition')||'';
  const encoded=disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const filename=encoded?decodeURIComponent(encoded):route.split('/').pop()||'download';
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function uploadLocalAttachment(file:File,recordId:string,mime=file.type):Promise<string>{
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
  for(let offset=0;offset<bytes.length;offset+=0x8000)binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
  const response=await protectedFetch('/api/attachments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recordId,name:file.name,mime,data:btoa(binary)})});
  return (await response.json() as {reference:string}).reference;
}

export function emptyLocalState(): State {
  return {version:4,records:[],invoices:[],receipts:[],employees:[],attendance:[],employeePayments:[],workshops:[],workshopPayments:[],audit:[],clients:[],users:[],internalWorkshopName:'D’ALEX',systemDisplayName:'D’ALEX',invoiceSummaryPaymentText:'PIX 42655411862'};
}
