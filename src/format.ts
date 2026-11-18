export const money=(cents:number)=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export const dateLabel=(date:string)=>date?new Date(date+'T12:00:00').toLocaleDateString('pt-BR'):'—';
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const stageClass=(stage:string)=>stage==='Concluído'?'done':stage==='Em fila'?'waiting':'progress';
export function cents(value:string):number { if(!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim()))return NaN;const [whole,fraction='']=value.replace(',','.').split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0')); }
