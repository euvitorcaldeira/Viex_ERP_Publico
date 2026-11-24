# D’ALEX ERP — mapa técnico para desenvolvimento

Referência: protótipo V4 final e planejamento já produzido. Data: 29/10/2026.

## Como interpretar o material

O protótipo contém lógica de negócio executável em TypeScript e persistência local. Ele permite validar fluxos e suas regras com dados fictícios. A camada de servidor e o banco compartilhado estão propostos, ainda não implementados. O seletor de perfis é demonstrativo e não autentica usuários.

`DALEX-ARQUITETURA.svg`/`.png` distinguem as duas situações. Os arquivos Mermaid são editáveis: arquitetura, relações de dados propostas e sequência de uma operação financeira no futuro servidor. O desenho de dados é conceitual, não uma migração SQL pronta.

## O que já pode ser examinado no código

| Responsabilidade existente | Fonte no projeto |
|---|---|
| Navegação e composição das telas | `src/v4/Application.tsx` |
| Cadastro, grades e revisão de quantidades/totais | `src/v4/RecordForm.tsx`, `src/v4/PriceReview.tsx`, `src/components/ItemsEditor.tsx` |
| Regras de produção, NF, parcelas, recebimentos, diárias e oficinas | `src/v3/domain.ts` |
| Previsões editáveis, reversões e filtros | `src/v4/domain.ts` |
| Persistência local e migração entre protótipos | `src/v4/store.ts` |
| Matriz de acesso, validação de transições e responsável demonstrativo | `src/security/policy.ts`, `src/security/context.tsx` |
| Histórico com anterior/novo, quantidades, unitários e totais | `src/v3/common.tsx` e funções de auditoria do domínio |
| Testes de regras, persistência e política | arquivos `*.test.ts` em `src/` |

O registro da entrega inclui 74 testes automatizados, regressão de fluxos no navegador, HTML independente e verificação do link público. Esses testes são evidência do protótipo; não testam um banco/servidor que ainda não existe.

## Regras que a implementação definitiva deve preservar

1. Produção: Em fila → Em produção → Concluído. Chegada, entrega, faturamento e recebimento são informações distintas.
2. Código do modelo é separado da descrição. Grade e cor determinam quantidades; modelos podem ter múltiplas cores e também existir sem grade.
3. Cliente e local são escolhidos em cadastros. Produção interna não tem custo externo por peça; terceirizada exige oficina e custo, separados do preço do cliente.
4. Alterar somente quantidades, sem vínculo financeiro, preserva unitários dos códigos mantidos quando cliente/local continuam iguais e recalcula totais. A revisão ocorre antes de confirmar.
5. NF pode consolidar romaneios do mesmo cliente com autorização. Os romaneios são vinculados à nota; parcelas e totais não são duplicados por romaneio. Não há faturamento parcial nesta versão.
6. Itens e preços de NF registrada são um snapshot e não devem ser recalculados por edições posteriores. O protótipo bloqueia alterações financeiras/exclusões em lotes com NF ou pagamento ativo.
7. Previsão de pagamento pode estar vazia e ser editada depois. Isso não altera o valor da nota, a parcela ou os recebimentos já registrados.
8. Recebimento pode ser parcial. Valor ativo recebido não pode ultrapassar o saldo. Desfazer é um registro rastreável, sem apagar o lançamento original.
9. Diária histórica é preservada por funcionário/data. Pagamentos, adiantamentos e correções alteram saldos, não apagam o histórico.
10. Custos/pagamentos de oficinas têm alocações por produção; receita do cliente e custo da oficina não são a mesma informação.
11. Valores são tratados em centavos inteiros. Auditoria mantém usuário, horário e valores anteriores/novos, inclusive quando há reversão.

## O que muda ao criar o back-end

| No protótipo | Na aplicação definitiva proposta |
|---|---|
| Estado e JSON do navegador | Tabelas relacionadas no PostgreSQL; repositórios assíncronos |
| Perfil escolhido pelo avaliador | Sessão autenticada e permissões verificadas pelo servidor/banco |
| Validações do cliente | Validação na interface para usabilidade e novamente no servidor para autoridade |
| Gravação local de todo o estado | Comandos específicos, transações, restrições e controle de concorrência |
| Histórico com ator/relógio demonstrativos | Usuário da sessão e horário de servidor; restrição de edição da auditoria |
| Nomes de anexos | Arquivos privados, metadados, limites e URLs temporárias autorizadas |
| Exportação manual JSON | Backups automáticos de banco e arquivos, monitoramento e teste de restauração |

Não enviar o estado completo do navegador como verdade financeira. O servidor deve buscar os preços e saldos persistidos e validar cada comando. Reutilizar os componentes e testes, mas implementar as garantias transacionais no servidor.

## Contratos sugeridos — ainda inexistentes

- `concluir_producao(romaneio, precos, versao)`: validar origem e unitários, calcular receita/custo e registrar auditoria.
- `registrar_nf(romaneios, dados_nf, parcelas, idempotencia)`: verificar cliente/autorizações, recalcular a partir de preços persistidos, criar NF e parcelas na mesma transação.
- `registrar_recebimento(parcela, valor, data, idempotencia)`: validar saldo, impedir duplicidade e gravar recebimento/auditoria atomicamente.
- `desfazer_recebimento(recebimento, idempotencia)`: preservar o original, registrar reversão e recompor saldo.
- `pagar_oficina(oficina, producoes, valor, idempotencia)`: validar saldos e alocar pagamento sem exceder obrigações.
- `registrar_frequencia(funcionario, data, situacao, versao)`: chave única funcionário/data e diária histórica.

Os nomes são exemplos de comandos/RPCs, não endpoints disponíveis. Não é necessário acrescentar microserviços: RPCs no PostgreSQL e funções de servidor podem atender ao porte inicial.

## Segurança e banco propostos

Supabase Auth para identidade; PostgreSQL para dados e transações; Storage privado para arquivos. RLS limita as linhas acessíveis e privilégios/projeções de tabelas/colunas impedem que perfis sem autorização recebam valores financeiros. A política atual é conservadora: Administrador financeiro, Operação operacional e Consulta somente leitura operacional. Validar a matriz real com o responsável antes da implantação.

Aplicar idempotência, restrições únicas e bloqueio/versão de saldos para cliques repetidos e acessos simultâneos. Uma transação financeira deve terminar integralmente ou não produzir efeitos parciais. Backups dos arquivos são separados dos backups de banco; realizar ensaio de recuperação.

## Decisões ainda para homologar

Matriz real de permissões; séries/identificação fiscal; cancelamento/substituição de NF; ajustes após documentos emitidos; políticas de recuperação; volume e origem dos dados reais. O banco definitivo e os serviços reais não foram contratados ou implementados.

## Como apresentar à equipe

“Este protótipo valida os fluxos, os cálculos e as regras de negócio em TypeScript, usando dados fictícios e armazenamento local. A proposta é reaproveitar essa experiência e levar a autoridade das permissões e operações financeiras para um back-end transacional com PostgreSQL. O diagrama separa as partes implementadas das partes planejadas.”

Material complementar: `RELATORIO_FINAL_DALEX_ERP_V4.md`, `VALIDACAO_FINAL_V4.md` e o protótipo público https://dalex-erp-v4-demonstracao.spicyclove20.chatgpt.site.
