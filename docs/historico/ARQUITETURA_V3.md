# D’ALEX Simple ERP — Decisões arquiteturais V3

Registro histórico. A versão ativa está documentada em [ARQUITETURA_V4.md](ARQUITETURA_V4.md).

## Escopo autorizado

A solicitação “Avaliação V2 e Solicitação de Melhorias para V3” pede explicitamente a implementação e os testes. A Visão Geral foi mantida; não houve reformulação do menu, temas ou identidade visual. O trabalho evolui o protótipo novo e não acessa Apps Script.

## Estrutura

- `src/v3/domain.ts`: regras e transições puras de produção, faturamento, recebimentos, frequência e pagamentos, com retorno de novo estado. Não depende de React nem de armazenamento.
- `src/v3/store.ts`: carga, migração e persistência local versionada. Leitura inválida não sobrescreve automaticamente a chave existente. A composição da aplicação impede gravações no estado de demonstração alternativo até restauração explícita.
- `src/v3/Application.tsx`: composição das telas e gravação atômica do estado local. Só atualiza a interface após a gravação bem-sucedida. `src/App.tsx` seleciona a versão ativa.
- `src/v3/RecordForm.tsx`, `Production.tsx`, `Billing.tsx`, `Finance.tsx`, `Employees.tsx`, `Workshops.tsx`: experiências separadas por módulo.
- `src/v3/common.tsx`: pagamentos e histórico reutilizáveis. `components/Modal.tsx`, `ItemsEditor.tsx`, `ItemTable.tsx`, `RomaneioTable.tsx` e `Stat.tsx` preservam os componentes existentes.
- Código e testes V1/V2 permanecem como histórico e regressão. A aplicação ativa importa a V3; módulos antigos não executam em paralelo.

## NF normalizada e valores imutáveis

Cada romaneio possui `invoiceId`; cada NF possui uma lista de romaneios e um snapshot das linhas e preços. A NF e suas parcelas são armazenadas uma única vez. O painel e o Financeiro somam as notas, evitando a multiplicação do valor quando dois romaneios apontam para a mesma NF.

Os preços do cliente e custos de oficina são informados por código de modelo ao concluir a produção. Cor e grade não criam preços novos automaticamente. Um mesmo modelo possui um tipo de produção por romaneio nesta versão. Cores/tamanhos são agrupados no faturamento. Na consolidação, o resumo agrupa somente linhas de código, descrição e preço iguais; preços diferentes permanecem em linhas separadas.

Regras de consistência: apenas concluídos com preços completos e sem NF entram na fila; todos os selecionados devem pertencer ao mesmo cliente; mais de um exige autorização expressa na interface; não há refaturamento; número de NF é único na demonstração (sem séries nesta fase). Valores monetários são centavos inteiros. Parcelas iguais distribuem sobras de centavos nas primeiras parcelas, sem perda no total.

## Edição, exclusão e histórico

Romaneios sem NF ou pagamento de oficina podem ser editados/excluídos. Mudanças nos itens invalidam a precificação, impedindo faturar com valores antigos. Com NF ou pagamento, campos financeiros e itens ficam protegidos; correções não financeiras permanecem permitidas. É a opção conservadora para não modificar obrigações registradas. Não há cancelamento/substituição de NF neste lote.

O histórico guarda data/hora, entidade, ação e snapshots anterior/posterior. A interface mostra ações, datas e resumos antes/depois; a exportação preserva os snapshots completos. A exclusão conserva uma entrada de histórico e o próximo número do romaneio considera também os registros excluídos, evitando reutilização acidental.

## Recebimentos e correções

Uma parcela pode ter vários recebimentos parciais. Saldo = valor da parcela menos recebimentos ativos. Desfazer marca o recebimento com data/hora de reversão, mantém o registro e recalcula o saldo; uma reversão não pode ser aplicada duas vezes. NF emitida nunca significa recebimento automático.

O card Recebido e a lista Recebidas usam a data efetiva e o mês/ano selecionado, iniciando no mês vigente de São Paulo. Baixas desfeitas aparecem como correções, mas não entram no total. Os saldos pendentes permanecem globais para manter a correspondência com o indicador aprovado da Visão Geral.

## Diárias e adiantamentos

Frequência tem chave funcionário + data. Lista diária e calendários semanal/mensal alteram o mesmo registro, sem criar duplicatas. Cada dia preserva a diária vigente em seu primeiro registro; alterar o cadastro não recalcula histórico. Presente gera diária integral; Falta e Não trabalhado geram zero. Não há meia diária nesta entrega.

Saldo = diárias presentes menos pagamentos e adiantamentos. Pagamento normal não pode exceder o saldo; adiantamento pode gerar crédito negativo para compensar em dias futuros. Corrigir uma presença já paga pode gerar esse mesmo crédito sem apagar o pagamento. Fechamento em grupo quita os saldos positivos selecionados em uma gravação, com identificador comum. Pagamentos parciais são feitos individualmente, sem periodicidade fixa.

## Oficinas e pagamentos

Produção terceirizada exige oficina ativa e custo unitário, separado do preço do cliente. Custos de produções concluídas geram obrigações calculadas por romaneio + modelo + oficina. Pagamentos possuem alocações explícitas para essas obrigações. Pagamento acumulado consome os saldos selecionados na ordem de listagem até o valor informado; pode ser parcial. Não há adiantamento de oficina nem logística nesta etapa.

Desativação de funcionário/oficina impede novos vínculos/novos dias sem registro, preservando consultas, correções históricas e pagamentos pendentes. Uma oficina desativada depois da conclusão não bloqueia o faturamento já preparado.

## Migração e limites

O adaptador cria `dalex-prototype-v3`, preservando as chaves V1/V2. Importa cada NF e recebimento da V2 uma única vez e conserva preços e totais históricos. Preços ausentes e custos de terceiros não são inventados; produção concluída sem preço exige revisão. O export contém todo o estado V3 e o histórico.

Sem banco remoto, autenticação, serviços pagos, dados reais, emissão de NF ou transação bancária. O armazenamento é síncrono e local, com uma gravação por operação. A versão é destinada à avaliação por uma sessão; não oferece concorrência multiusuário nem auditoria inviolável. Para Supabase/PostgreSQL, transformar a mesma separação de responsabilidades em repositórios assíncronos, tabelas relacionadas, restrições, transações e políticas de acesso RLS. Validar essas permissões antes de conectar dados reais.
