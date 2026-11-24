# D’ALEX Simple ERP — Decisões V4 — 29/10/2026

## Requisitos desta avaliação

A solicitação autoriza implementar: previsão de pagamento opcional e editável, ordenação financeira, grade adulta padrão, origem de produção integrada, clientes/oficinas selecionáveis por cadastro, console geral, chegada e pedido externo, período/paginação, painel de funcionários, dias da semana e desfazimento de pagamentos.

Financeiro, Funcionários e Oficinas permanecem separados, conforme a alternativa permitida pelo usuário. A Visão Geral conserva layout e navegações globais. A coluna de data passa a representar recebimento, conforme a alteração funcional solicitada; não houve reformulação visual.

## Estrutura e versão

`src/v4/Application.tsx` é a composição ativa, selecionada por `src/App.tsx`. `src/v4/RecordForm.tsx`, `Records.tsx`, `Finance.tsx`, `Configuration.tsx`, `Registry.tsx` e `PaymentHistory.tsx` separam os novos fluxos. `src/v4/domain.ts` reúne agendamento, cadastros, reversões, ordenação e consulta por período. `src/v4/store.ts` realiza a migração e persistência da nova versão.

O núcleo operacional de `src/v3/domain.ts`, os módulos de funcionários/oficinas/produção e os componentes compartilhados são evoluídos, evitando duplicar saldos e regras. Tipos opcionais de compatibilidade preservam a regressão de estados V1–V3. A aplicação ativa utiliza estado versão 4.

## Previsão independente da NF e dos recebimentos

Cada parcela mantém ID, valor e previsão. Previsão não definida é uma string vazia, apresentada como A definir; não se usa uma data fictícia nem uma data automática. A NF é válida sem previsão na V4, e o recebível entra integralmente no saldo pendente.

Editar previsão altera somente a data dessa parcela, com auditoria antes/depois. Número/emissão/total/snapshot de itens e valores da NF, IDs das parcelas e recebimentos existentes permanecem intactos. Receber dinheiro continua uma operação distinta. Datas informadas são validadas contra a emissão.

Ordenação ocorre sobre cópias derivadas das linhas: valor da parcela/recebimento, número de NF com comparação numérica natural, data crescente/decrescente. Datas ausentes ficam no final, independentemente da direção, sem excluí-las do saldo.

## Cliente e origem únicos por romaneio

O romaneio referencia `clientId` e `execution` (Interna ou Terceirizada + ID da oficina); os nomes apresentados vêm do cadastro. Cliente/local são selecionados, sem nomes livres. Arquivar não remove vínculos, notas ou pagamentos existentes.

Novos romaneios iniciam internos. A conclusão recupera a origem e solicita preço do cliente e, apenas na terceirização, custo da oficina escolhida. O núcleo valida a correspondência entre cadastro e precificação, além da proteção da interface. Alterar origem/itens/cliente antes de vínculos invalida os preços. Com NF ou pagamento ativo, a origem e dados financeiros ficam protegidos.

Uma produção mista já existente na V3 é preservada explicitamente como Mista: seus tipos/custos por modelo não são convertidos para uma única oficina silenciosamente. Uma alteração explícita da origem num lote ainda sem vínculos financeiros exige revisar os valores.

## Recebimento, pedido e consulta

`receivedOn` é a chegada real; `clientOrder` é a numeração externa. O ID ROM interno permanece sequencial e a busca inclui ambos. O campo técnico `date` é mantido como compatibilidade de validação; formulários novos/corrigidos o sincronizam com a chegada. Não representa mais compromisso de entrega.

Dados migrados ficam com chegada não informada, em vez de converter previsão antiga em fato operacional. A interface oferece Sem data/Todas as datas e preserva a fonte V3. Os exemplos novos de avaliação têm datas de chegada fictícias conhecidas.

Consulta normal inicia no mês vigente em São Paulo. Período, situação e busca são aplicados antes da paginação; o rodapé conta todos os resultados filtrados e as peças, não somente a página. Mudanças de filtro/tamanho reiniciam na página 1; remoções limitam a página ao intervalo existente. Padrão 20, opções 10/20/50.

Links globais da Visão Geral e início de pesquisa global consultam todas as datas, para não produzir diferença entre os totais e as linhas que compõem esses totais. A listagem local mantém seus controles de período.

## Pagamentos reversíveis

Pagamentos de funcionários e oficinas recebem `reversedAt`. Somas e alocações consideram somente os pagamentos ativos. Desfazer mantém a linha e snapshots no histórico, recalcula saldo/crédito e impede segunda reversão da mesma linha. Fechamentos podem ser revertidos por linha ou em grupo numa gravação.

Reverter oficina reabre as obrigações das produções alocadas, sem alterar preço do cliente ou NF. Um romaneio continua bloqueado se houver NF ou outro pagamento ativo; uma linha desfeita não continua consumindo saldo.

## Cadastros gerais e limites

Clientes e usuários têm identificação, situação e histórico; nomes de cliente e e-mails de usuário são únicos no cadastro local. Renomear cliente mantém a identidade e os preços de seus romaneios. Notas já registradas conservam seu snapshot original. Funcionários/oficinas usam os mesmos cadastros já existentes, com modos de apresentação de cadastro ou operação.

Usuários/perfis são somente demonstrativos, sem senhas nem aplicação de permissões. Autenticação, transações e RLS são requisitos da futura integração Supabase/PostgreSQL, não promessas de segurança do protótipo local.

A nova chave `dalex-prototype-v4` preserva V1/V2/V3. Leituras inválidas não sobrescrevem automaticamente a fonte. Exportação inclui todas as entidades e histórico. Mantidos: dados fictícios, aplicação local, nenhuma contratação, publicação em produção, emissão fiscal, transação bancária ou código Apps Script.
