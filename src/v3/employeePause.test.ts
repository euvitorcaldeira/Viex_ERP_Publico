import { afterEach, describe, expect, it, vi } from 'vitest';
import { employeeBalance, markAttendance, saveEmployee, type Employee, type State } from './domain';

const employee: Employee = { id:'e',name:'Costureira',role:'Costura',dailyCents:15000,pix:'',active:true,attendanceStartDate:'2026-11-16' };
const initial: State = {version:4,records:[],invoices:[],receipts:[],employees:[employee],attendance:[],employeePayments:[],workshops:[],workshopPayments:[],audit:[]};
const on = (date: string) => { vi.useFakeTimers();vi.setSystemTime(new Date(date+'T12:00:00-03:00')); };
afterEach(()=>vi.useRealTimers());

describe('pausa do controle de diárias',()=>{
 it('suspende desde o dia da pausa e retoma sem cobrar os dias suspensos',()=>{
  on('2026-11-17');
  let state=saveEmployee(initial,{...employee,active:false});
  expect(employeeBalance(state,'e')).toBe(15000);
  on('2026-11-20');
  expect(employeeBalance(state,'e')).toBe(15000);
  state=saveEmployee(state,{...state.employees[0],active:true});
  expect(employeeBalance(state,'e')).toBe(30000);
  on('2026-11-23');
  expect(employeeBalance(state,'e')).toBe(45000);
  expect(()=>markAttendance(state,'e','2026-11-18','Presente')).toThrow(/pausa/);
 });
 it('não cria diárias para cadastros em pausa sem histórico de ativação',()=>{
  on('2026-11-18');
  expect(employeeBalance({...initial,employees:[{...employee,active:false}]},'e')).toBe(0);
 });
 it('mantém lançamentos explícitos e pagamentos anteriores na apuração',()=>{
  on('2026-11-16');
  let state=markAttendance(initial,'e','2026-11-16','Presente',2000);
  state=saveEmployee(state,{...employee,active:false});
  on('2026-11-18');
  state={...state,employeePayments:[{id:'p',employeeId:'e',date:'2026-11-16',amountCents:5000,advance:false,groupId:null}]};
  expect(employeeBalance(state,'e')).toBe(12000);
 });
 it('interpreta o dia da pausa no horário de São Paulo',()=>{
  on('2026-11-18');
  const state=saveEmployee(initial,{...employee,active:false});
  state.audit[0].at='2026-11-18T01:00:00Z';
  expect(employeeBalance(state,'e')).toBe(15000);
 });
});
