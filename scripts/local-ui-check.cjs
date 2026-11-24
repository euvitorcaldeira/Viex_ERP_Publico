const {spawn}=require('child_process');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {once}=require('events');

async function launchServer(appRoot,dataDirectory=null){
 const env={...process.env,DALEX_OPEN_BROWSER:'0'};
 if(dataDirectory)env.DALEX_DATA_DIR=dataDirectory;else delete env.DALEX_DATA_DIR;
 const child=spawn('python',['DALEX.py'],{
  cwd:appRoot,env,stdio:'ignore',windowsHide:true
 });
 for(let i=0;i<60;i++){
  if(child.exitCode!==null)throw new Error('O servidor local encerrou durante a inicialização.');
  try{const response=await fetch('http://127.0.0.1:8765/api/status');if(response.ok)return child}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 child.kill();throw new Error('O serviço local não iniciou em tempo hábil.');
}

async function stopServer(child){
 if(!child||child.exitCode!==null)return;
 child.kill();await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(resolve,2500))]);
}

async function main(){
 const playwrightPath=process.env.DALEX_PLAYWRIGHT||'playwright';
 const {chromium}=require(playwrightPath);
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'dalex-local-ui-'));
 const resolved=path.resolve(dataDir),tempRoot=path.resolve(os.tmpdir());
 if(!resolved.startsWith(tempRoot+path.sep))throw new Error('Pasta de teste fora do diretório temporário.');
 let child,browser,portableRoot,page;const pageErrors=[];
 try{
  child=await launchServer(path.resolve(__dirname,'..'),path.join(dataDir,'Dados'));
  browser=await chromium.launch({channel:'msedge',headless:true});
  page=await browser.newPage({permissions:['clipboard-read','clipboard-write']});page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('http://127.0.0.1:8765/');
  await page.getByRole('heading',{name:'Configure o primeiro acesso'}).waitFor();
  await page.getByLabel('Seu nome').fill('Teste Local');
  await page.getByLabel('E-mail').fill('teste@exemplo.invalid');
  await page.getByLabel('Senha').fill('Senha Local de Teste 2026!');
  await page.getByRole('button',{name:'Criar acesso de administrador'}).click();
  await page.locator('.demo-banner').getByText('APLICATIVO LOCAL').waitFor();
  await page.getByRole('button',{name:'Configurações'}).click();
  await page.getByRole('button',{name:'Cadastrar cliente'}).click();
  await page.getByLabel('Nome do cliente').fill('Cliente Persistido');
  await page.getByRole('button',{name:'Salvar cliente'}).click();
  await page.getByText('Cliente Persistido',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Oficinas',exact:true}).last().click();
  await page.getByRole('button',{name:'Cadastrar oficina'}).click();
  await page.getByLabel('Nome da oficina').fill('Oficina Teste');
  await page.getByLabel('Contato').fill('contato fictício');
  await page.getByLabel('Chave Pix').fill('pix-fictício');
  await page.getByRole('button',{name:'Salvar oficina'}).click();
  await page.getByText('Oficina Teste',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Funcionários',exact:true}).last().click();
  await page.getByRole('button',{name:'Cadastrar funcionário'}).click();
  await page.getByLabel('Nome do funcionário').fill('Pessoa Teste');
  await page.getByLabel('Função').fill('Costura');
  await page.getByLabel('Valor da diária (R$)').fill('120.00');
  await page.getByLabel('Chave Pix').fill('chave-fictícia');
  await page.getByRole('button',{name:'Salvar funcionário'}).click();
  await page.getByText('Pessoa Teste',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Usuários',exact:true}).last().click();
  await page.getByRole('button',{name:'Convidar usuário'}).click();
  await page.getByLabel('Nome').fill('Operação Teste');
  await page.getByLabel('E-mail').fill('operacao@exemplo.invalid');
  await page.getByLabel('Senha inicial').fill('Senha Operação Teste 2026!');
  await page.getByRole('button',{name:'Salvar acesso'}).click();
  await page.getByText('operacao@exemplo.invalid',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Romaneios e Produção'}).click();
  await page.getByRole('button',{name:'Configurações'}).click();
  await page.getByRole('button',{name:'Usuários',exact:true}).last().click();
  await page.getByText('operacao@exemplo.invalid',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Romaneios e Produção'}).click();
  await page.getByRole('button',{name:'Novo romaneio'}).click();
  await page.getByLabel('Cliente',{exact:true}).selectOption({label:'Cliente Persistido'});
  const today=await page.evaluate(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date()));
  await page.getByLabel('Local de produção').selectOption({label:'Oficina Teste'});
  await page.getByLabel('Data de recebimento do romaneio').fill(today);
  await page.getByLabel('Código modelo 1').fill('CAM-001');
  await page.getByLabel('Descrição modelo 1').fill('Camiseta básica');
  await page.getByLabel('Quantidade 34 modelo 1').fill('3');
  await page.locator('input[type=file]').setInputFiles({name:'pedido.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nPedido fictício\n')});
  await page.getByText('pedido.pdf',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Revisar romaneio'}).click();
  await page.getByRole('button',{name:'Confirmar cadastro'}).click();
  await page.getByText('ROM-001',{exact:true}).waitFor();
  await page.getByRole('button',{name:'ROM-001',exact:true}).click();
  await page.getByRole('button',{name:'Iniciar produção'}).click();
  await page.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.getByRole('button',{name:'ROM-001',exact:true}).click();
  await page.getByRole('button',{name:'Concluir produção'}).click();
  await page.getByLabel('Preço cliente CAM-001').fill('15.00');
  await page.getByLabel('Custo oficina CAM-001').fill('8.00');
  await page.getByRole('button',{name:'Salvar preços e concluir produção'}).click();
  await page.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.getByRole('button',{name:'Faturamento'}).click();
  await page.getByLabel('Selecionar ROM-001').check();
  await page.getByRole('button',{name:'Faturar selecionados (1)'}).click();
  await page.getByLabel('Número da NF').fill('NF-TESTE-001');
  await page.getByLabel('Data de emissão').fill(today);
  const invoiceSummary=await page.getByLabel('Resumo para NF').inputValue();
  if(!invoiceSummary.includes('CAM-001 - CAMISETA BÁSICA - 3 PEÇAS'))throw new Error('O resumo de faturamento não corresponde ao romaneio.');
  await page.getByRole('button',{name:'Copiar texto'}).click();
  await page.getByRole('button',{name:'Texto copiado'}).waitFor();
  if(!(await page.evaluate(()=>navigator.clipboard.readText())).includes('VALOR TOTAL'))throw new Error('O texto da NF não chegou à área de transferência.');
  await page.getByRole('button',{name:'Registrar NF e gerar contas a receber'}).click();
  await page.getByText('NF NF-TESTE-001',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Financeiro'}).click();
  await page.getByRole('button',{name:'Editar previsão'}).click();
  await page.getByRole('dialog',{name:'Editar previsão de pagamento'}).getByLabel('Previsão de pagamento').fill(today);
  await page.getByRole('button',{name:'Salvar previsão'}).click();
  await page.getByRole('button',{name:'Registrar recebimento'}).click();
  await page.getByLabel('Valor recebido (R$)').fill('20.00');
  await page.getByLabel('Data de recebimento').fill(today);
  await page.getByRole('button',{name:'Confirmar recebimento'}).click();
  await page.getByRole('button',{name:'Recebidas'}).click();
  await page.getByRole('button',{name:'Estornar recebimento'}).click();
  await page.getByText('Desfeito',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Funcionários'}).click();
  await page.getByRole('button',{name:'Frequência'}).click();
  await page.getByRole('button',{name:/Ações de frequência de Pessoa Teste/}).click();
  await page.getByRole('button',{name:'Marcar presença'}).click();
  await page.getByRole('button',{name:'Pagamentos e histórico'}).click();
  await page.getByLabel('Histórico do funcionário').selectOption({label:'Pessoa Teste'});
  await page.getByRole('button',{name:'Pagar funcionário'}).click();
  await page.getByLabel('Valor do pagamento (R$)').fill('50.00');
  await page.getByRole('button',{name:'Confirmar pagamento'}).click();
  await page.getByRole('button',{name:'Desfazer pagamento'}).click();
  await page.getByText('Desfeito',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Oficinas'}).click();
  await page.getByRole('button',{name:'Produções e histórico'}).click();
  await page.getByRole('button',{name:'Pagar produção'}).click();
  await page.getByLabel('Valor do pagamento (R$)').fill('5.00');
  await page.getByRole('button',{name:'Confirmar pagamento'}).click();
  await page.getByRole('button',{name:'Desfazer pagamento'}).click();
  await page.getByText('Desfeito',{exact:true}).waitFor();

  // A real service restart checks that SQLite, users and local files survive process closure.
  await browser.close();browser=undefined;await stopServer(child);child=await launchServer(path.resolve(__dirname,'..'),path.join(dataDir,'Dados'));
  browser=await chromium.launch({channel:'msedge',headless:true});page=await browser.newPage({permissions:['clipboard-read','clipboard-write']});page.on('pageerror',error=>pageErrors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.goto('http://127.0.0.1:8765/');
  await page.getByRole('heading',{name:'Entre no D’ALEX'}).waitFor();
  await page.getByLabel('E-mail').fill('teste@exemplo.invalid');
  await page.getByLabel('Senha').fill('Senha Local de Teste 2026!');
  await page.getByRole('button',{name:'Entrar'}).click();
  await page.getByRole('button',{name:'Romaneios e Produção'}).click();
  await page.getByRole('button',{name:'ROM-001',exact:true}).click();
  await page.getByRole('link',{name:'pedido.pdf'}).waitFor();
  const attachmentDownload=page.waitForEvent('download');await page.getByRole('link',{name:'pedido.pdf'}).click();
  const downloadedFile=await attachmentDownload;
  if(downloadedFile.suggestedFilename()!=='pedido.pdf')throw new Error('O anexo persistido não foi disponibilizado com o nome esperado.');
  await page.getByRole('button',{name:'Fechar',exact:true}).click();

  await page.getByRole('button',{name:'Configurações'}).click();
  await page.getByRole('button',{name:'Proteção de dados'}).click();
  await page.getByRole('button',{name:'Criar cópia agora'}).click();
  await page.getByRole('status').getByText('Cópia criada',{exact:false}).waitFor();
  const workbookDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar planilha'}).click();
  if(!(await workbookDownload).suggestedFilename().endsWith('.xlsx'))throw new Error('A exportação Excel não produziu um arquivo .xlsx.');
  await page.getByRole('button',{name:'Restaurar'}).first().click();
  await page.getByRole('heading',{name:'Entre no D’ALEX'}).waitFor();
  await page.getByLabel('E-mail').fill('teste@exemplo.invalid');
  await page.getByLabel('Senha').fill('Senha Local de Teste 2026!');
  await page.getByRole('button',{name:'Entrar'}).click();
  await page.getByRole('button',{name:'Romaneios e Produção'}).click();
  await page.getByRole('button',{name:'ROM-001',exact:true}).waitFor();

  // Copy only runtime files and persistent folders, then launch from another path.
  await browser.close();browser=undefined;await stopServer(child);
  portableRoot=fs.mkdtempSync(path.join(os.tmpdir(),'dalex-portable-'));
  const sourceRoot=path.resolve(__dirname,'..');
  for(const file of ['DALEX.py'])fs.copyFileSync(path.join(sourceRoot,file),path.join(portableRoot,file));
  for(const folder of ['backend','dist'])fs.cpSync(path.join(sourceRoot,folder),path.join(portableRoot,folder),{recursive:true});
  for(const folder of ['Dados','Anexos','Backups'])if(fs.existsSync(path.join(dataDir,folder)))fs.cpSync(path.join(dataDir,folder),path.join(portableRoot,folder),{recursive:true});
  child=await launchServer(portableRoot);
  browser=await chromium.launch({channel:'msedge',headless:true});page=await browser.newPage({permissions:['clipboard-read','clipboard-write']});page.on('pageerror',error=>pageErrors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.goto('http://127.0.0.1:8765/');
  await page.getByRole('heading',{name:'Entre no D’ALEX'}).waitFor();
  await page.getByLabel('E-mail').fill('teste@exemplo.invalid');
  await page.getByLabel('Senha').fill('Senha Local de Teste 2026!');
  await page.getByRole('button',{name:'Entrar'}).click();
  await page.getByRole('button',{name:'Romaneios e Produção'}).click();
  await page.getByRole('button',{name:'ROM-001',exact:true}).waitFor();
  await page.getByRole('button',{name:'ROM-001',exact:true}).click();
  await page.getByRole('link',{name:'pedido.pdf'}).waitFor();
  const movedAttachment=page.waitForEvent('download');await page.getByRole('link',{name:'pedido.pdf'}).click();await movedAttachment;
  await page.getByRole('button',{name:'Fechar',exact:true}).click();

  await page.getByRole('button',{name:'Alternar tema'}).click();
  if(!(await page.locator('.app').evaluate(element=>element.classList.contains('dark'))))throw new Error('O tema escuro não foi aplicado.');
  await page.setViewportSize({width:390,height:844});
  const width=await page.locator('body').evaluate(element=>({scroll:element.scrollWidth,client:element.clientWidth}));
  if(width.scroll>width.client+2)throw new Error(`A tela móvel apresenta rolagem horizontal (${width.scroll}px).`);
  if(pageErrors.length)throw new Error(`Erros JavaScript: ${pageErrors.join('; ')}`);
  console.log(JSON.stringify({status:'passou',cadastros:'cliente, funcionário e oficina',produção:'terceirizada, preços unitários e romaneio',faturamento:'NF, resumo copiado e parcela sem vencimento obrigatório',recebimento:'parcial e desfeito com histórico',pagamentos:'funcionário e oficina desfeitos com histórico',reinício:'dados persistiram após reinício do serviço',anexo:'PDF enviado, preservado e presente após transferência',excel:'exportação .xlsx',backup:'criado e restaurado com os cadastros',portabilidade:'pasta copiada e DALEX.py aberto no novo caminho',tema:'claro/escuro',mobile:`${width.client}px sem rolagem horizontal`,errosJavaScript:pageErrors.length}));
 }catch(error){
  if(page){console.error(`URL: ${page.url()}`);console.error(`INTERFACE: ${(await page.locator('body').innerText().catch(()=>'' )).slice(-5000)}`);console.error(`OVERFLOW: ${JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('*')).map(element=>{const r=element.getBoundingClientRect();return {tag:element.tagName,className:typeof element.className==='string'?element.className:'',left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),scroll:element.scrollWidth}}).filter(element=>element.right>innerWidth+1||element.left< -1).sort((a,b)=>b.right-a.right).slice(0,14)))}`)}
  throw error;
 }finally{
  if(browser)await browser.close();await stopServer(child);
  if(fs.existsSync(resolved))fs.rmSync(resolved,{recursive:true,force:true});
  if(portableRoot&&fs.existsSync(portableRoot))fs.rmSync(portableRoot,{recursive:true,force:true});
 }
}

main().catch(error=>{console.error(error.message);process.exitCode=1});
