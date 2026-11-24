# D’ALEX ERP — Verificação V4 — 29/10/2026

## Verificação de regras e compilação

- TypeScript estrito e compilação local Vite.
- 67 testes automatizados em cinco arquivos, incluindo regressão V1–V3 e 18 cenários V4.
- Novos cenários: NF sem previsão; agendamento/correção/remoção após pagamento parcial sem alteração de valores; datas inválidas; ordenação; grade padrão; vínculo de origem/custo; troca de cliente/oficina; cadastros padronizados/inativos; chegada/pedido/período; reversões individual/grupo/oficina; dias da semana; migração e fonte original preservada.

## Interface — 13 resultados aprovados

Automação em Edge com perfil temporário, sem alterar o navegador pessoal do usuário. O relatório está em `test-results/v4/browser-report.json`.

1. Visão Geral mantém quatro indicadores, três etapas e apresentação aprovada.
2. Cadastros gerais permite cadastrar cliente, oficina, funcionário e usuário demonstrativo, no mesmo console.
3. Cadastro de romaneio usa listas, data de recebimento, pedido externo, grade adulta padrão e produção interna inicial.
4. Correção do local é recuperada na conclusão, com tipo e oficina preenchidos/sem redigitação; produção interna não apresenta custo externo.
5. Duas NFs foram registradas sem previsão. Previsão foi preenchida, removida depois de recebimento parcial e salva sem alterar o saldo; depois novamente preenchida.
6. Ordenação por maior/menor valor, número natural da NF e previsão, com datas ausentes ao final.
7. Painel de funcionários com quatro indicadores; calendário semanal mostra os nomes dos dias junto às datas.
8. Pagamento individual e fechamento em grupo desfeitos com confirmação, recompondo saldos e mantendo histórico.
9. Pagamento de oficina desfeito, restaurando saldo por produção e preservando vínculos.
10. Exportação V4 e recarga preservam cadastros, previsões, pagamentos desfeitos e vínculos.
11. Cenário isolado de 205 romaneios, sendo 200 no mês vigente: página inicial com 20 linhas/10 páginas; segunda página; 50 linhas/4 páginas; filtro por situação; busca por pedido; card global abre os 205 registros em Todas as datas.
12. Migração real do export de testes V3 mantém o conteúdo original, não inventa datas de chegada e permite consultar antigos em Sem data.
13. Tema persiste, menu retrai e Romaneios, Financeiro, Funcionários e Configurações não excedem a largura da página em viewport 390 × 844. Sem erros JavaScript no percurso.

Capturas em `test-results/v4/`: Visão Geral, cadastros gerais, romaneios, Financeiro, calendário, painel de funcionários, paginação e versão móvel. Visão Geral, romaneios, calendário, painel e móvel foram inspecionados visualmente.

## Reproduzir

`npm test` e `npm run build`. Para a interface, usar `browser-v4.cjs`, com Playwright e Edge disponíveis e o protótipo local ativo. `DALEX_PLAYWRIGHT` pode indicar o módulo do runtime do desktop; `DALEX_URL` troca o endereço (padrão http://127.0.0.1:5180/). O cenário de migração utiliza o export fictício V3 em `test-results/v3/export.json`.

## Limites

Testes móveis usaram dimensões de janela, sem aparelho físico. Não foram implementados/testados banco remoto, login efetivo, permissões reais, anexos reais, Pix, emissão fiscal ou uso simultâneo por vários usuários. Prazo automático calculado da emissão segue como sugestão futura, sem regra comercial presumida.
