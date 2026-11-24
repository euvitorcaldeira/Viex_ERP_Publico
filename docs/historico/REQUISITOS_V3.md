# D’ALEX ERP — Avaliação V2 e Solicitação de Melhorias para V3

Atue como desenvolvedor full-stack sênior responsável pela evolução do D’ALEX ERP.

Após testar o protótipo V2, identifiquei melhorias e funcionalidades que precisam ser implementadas na próxima versão.

**Objetivo:** evoluir o protótipo atual, preservando o que já funciona, corrigindo os fluxos operacionais e tornando os módulos ainda incompletos disponíveis para testes reais.

## 1. Visão Geral — 100% APROVADA

A tela inicial está funcionando conforme esperado.

Todos os indicadores, botões, filtros e links estão operacionais.

**Orientação:** preservar a Visão Geral atual. Não modificar desnecessariamente seu layout ou comportamento.

## 2. Romaneios e Produção — Ajustes necessários

### 2.1. Edição e exclusão

Implementar as funcionalidades:

- Editar romaneios já cadastrados.
- Excluir romaneios mediante confirmação.
- Permitir alterar códigos, descrições, famílias, cores, grades e quantidades, desde que não comprometam dados financeiros já registrados.
- Impedir exclusão indevida de romaneios vinculados a notas fiscais ou pagamentos.
- Preservar o histórico de alterações importantes quando houver dados financeiros envolvidos.

### 2.2. Precificação na conclusão da produção

O valor negociado com o cliente deverá ser informado na tela **Romaneios e Produção**, e não na tela de Faturamento.

Ao concluir a produção, solicitar, por modelo ou item:

- Valor unitário negociado com o cliente.
- Tipo de produção: interna ou terceirizada.
- Oficina externa responsável, quando aplicável.
- Valor unitário a pagar à oficina terceirizada, quando aplicável.

**Regras:**

- Valor unitário do cliente: obrigatório para liberar o romaneio para faturamento.
- Produção interna: não solicitar custo por peça da oficina.
- Produção terceirizada: exigir oficina responsável e valor unitário negociado com ela.
- Calcular automaticamente receita prevista e custo da oficina.
- Preservar os valores informados para reutilização no faturamento.
- Não recalcular automaticamente notas fiscais já emitidas quando os valores do romaneio forem alterados posteriormente.

Manter o fluxo de produção:

**EM FILA → EM PRODUÇÃO → CONCLUÍDO**

A conferência permanece visual e manual, sem uma tela independente ou etapa sistêmica obrigatória.

A entrega ao cliente poderá ser registrada separadamente do faturamento, sem criar controles complexos de logística.

## 3. Faturamento — Reformulação do fluxo

### 3.1. Fila de romaneios prontos

A tela de Faturamento deverá apresentar automaticamente os romaneios concluídos e ainda não faturados.

O usuário não deverá precisar cadastrar novamente os itens ou digitar os valores unitários.

Todos esses dados devem ser recuperados da etapa de produção.

### 3.2. Faturamento consolidado

Implementar a possibilidade de selecionar vários romaneios para gerar uma única nota fiscal.

**Comportamento esperado:**

1. Exibir os romaneios disponíveis para faturamento.
2. Adicionar caixas de seleção individuais.
3. Permitir selecionar um ou vários romaneios.
4. Calcular automaticamente o valor total consolidado.
5. Apresentar o resumo completo dos itens selecionados.
6. Registrar uma única NF vinculada a todos os romaneios selecionados.
7. Impedir que esses mesmos itens sejam faturados novamente por engano.

O faturamento padrão continuará sendo um romaneio por NF. A consolidação será uma alternativa quando autorizada pelo cliente.

### 3.3. Texto copiável para emissão da nota fiscal

Criar uma seção **Resumo para NF**, com botão **Copiar texto**.

O objetivo é facilitar o preenchimento do campo de descrição dos serviços no portal externo de emissão de nota fiscal.

Cada item deverá apresentar:

- Código do produto.
- Descrição.
- Quantidade total de peças.
- Valor unitário.
- Valor total.

Não é necessário detalhar a grade de tamanhos ou as cores nesse resumo.

**Formato sugerido:**

RG0256 - REGATA MARIANA - 40 PEÇAS - UNI R$ 85,00 - TOTAL R$ 3.400,00

CL0187 - CALÇA CELIA - 25 PEÇAS - UNI R$ 100,00 - TOTAL R$ 2.500,00

**VALOR TOTAL: R$ 5.900,00**

Utilizar separadores com traços para facilitar a leitura e deixar uma linha em branco entre os itens.

Os valores deverão ser calculados automaticamente e formatados em reais.

Quando vários romaneios forem selecionados, gerar um único texto consolidado com os itens correspondentes.

### 3.4. Registro da nota fiscal

Após emitir a nota no portal externo, permitir registrar:

- Número da NF.
- Data de emissão.
- Valor total calculado.
- Data prevista de pagamento.
- Parcelas e vencimentos, quando houver.

A NF registrada deverá aparecer automaticamente em Contas a Receber.

**Importante:** a emissão da NF não significa que houve recebimento do valor.

## 4. Financeiro — Aprovado com ajustes

A estrutura atual está aprovada, principalmente o acompanhamento das notas e recebimentos.

### 4.1. Filtro por período

Implementar filtros de mês e ano para consultar os recebimentos.

- O período padrão deverá ser o mês vigente.
- Permitir selecionar meses anteriores.
- Considerar a data efetiva do recebimento para calcular os totais.
- Manter o histórico completo para consultas.

### 4.2. Indicador de valores recebidos

O card **Recebido** deverá apresentar o total recebido no período selecionado, em vez de acumular indefinidamente todos os recebimentos históricos.

Ao selecionar outro mês, atualizar o indicador e a lista correspondente.

### 4.3. Desfazer recebimento

Permitir corrigir uma baixa realizada incorretamente.

Ao desfazer:

- Cancelar a baixa equivocada mediante confirmação.
- Recalcular automaticamente o saldo pendente.
- Atualizar o status para Em aberto, Parcialmente recebido ou outra situação correspondente.
- Preservar o histórico da correção.
- Impedir inconsistências e pagamentos duplicados.

## 5. Funcionários — Implementar para testes

O protótipo V2 apresenta apenas funcionários fictícios, sem disponibilizar o cadastro e as operações necessárias.

Precisamos transformar essa área em um módulo navegável e testável.

### 5.1. Cadastro

Implementar:

- Cadastrar funcionários.
- Editar e desativar funcionários.
- Registrar nome, função, valor individual da diária e chave Pix.
- Consultar o histórico individual.

### 5.2. Frequência

Implementar dois formatos integrados:

**Lista diária:** registrar rapidamente quem trabalhou em determinada data, com opção de marcar todos como presentes.

**Calendário semanal/mensal:** consultar e corrigir registros de presença, faltas e dias não trabalhados.

Ambas as visualizações deverão utilizar os mesmos dados.

### 5.3. Pagamentos

Implementar:

- Cálculo automático das diárias acumuladas.
- Consulta de saldo por funcionário.
- Pagamentos totais e parciais.
- Adiantamentos.
- Pagamento individual.
- Fechamento de pagamentos em grupo.
- Histórico de pagamentos.

Não exigir periodicidade fixa. O Alex poderá pagar semanalmente, quinzenalmente ou em outro intervalo.

## 6. Oficinas externas — Implementar para testes

Atualmente, o protótipo também apresenta apenas dados demonstrativos, sem permitir cadastro e gerenciamento completos.

### 6.1. Cadastro das oficinas

Implementar cadastro, edição, desativação e consulta de oficinas externas.

### 6.2. Custos por peça

Permitir vincular uma oficina externa à produção e registrar:

- Romaneio e modelo.
- Quantidade produzida.
- Valor unitário combinado com a oficina.
- Valor total a pagar.

Esses custos deverão ser separados do valor cobrado ao cliente.

### 6.3. Pagamentos das oficinas

Implementar:

- Pagamento por produção concluída.
- Pagamento acumulado de diferentes produções.
- Pagamentos parciais.
- Histórico de pagamentos.
- Saldo pendente por oficina.

Não implementar controle complexo de transporte, movimentações ou recolhimento de peças.

## 7. Testes obrigatórios da V3

Após implementar os ajustes, testar os seguintes cenários:

1. Cadastrar, editar e excluir romaneios permitidos.
2. Concluir produção interna com preço negociado com o cliente.
3. Concluir produção terceirizada com preço do cliente e custo da oficina.
4. Selecionar dois romaneios e registrar uma NF consolidada.
5. Gerar e copiar o resumo da NF no formato solicitado.
6. Registrar uma NF parcelada e verificar seu saldo financeiro.
7. Registrar e desfazer um recebimento.
8. Filtrar recebimentos por mês e ano.
9. Cadastrar funcionário e registrar frequência diária.
10. Corrigir frequência pelo calendário.
11. Registrar pagamento individual e fechamento em grupo.
12. Cadastrar oficina externa e registrar pagamentos por peça.

## 8. Orientações de desenvolvimento

- Preservar a Visão Geral, que já está aprovada.
- Manter o design moderno, menu híbrido, responsividade e temas claro/escuro.
- Priorizar fluxos completos e testáveis, não apenas telas demonstrativas.
- Manter os módulos integrados, evitando duplicação de cadastros.
- Utilizar dados fictícios nesta etapa, sem contratar serviços pagos ou colocar dados reais em produção.
- Manter o código modular e organizado.
- Não reutilizar o Apps Script antigo.
- Executar testes antes de apresentar a entrega.

**Entrega esperada: D’ALEX ERP — Protótipo V3**, com as funcionalidades acima disponíveis para avaliação.

Ao finalizar, informar quais funcionalidades foram implementadas, quais foram testadas e quais permanecem pendentes.