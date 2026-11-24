# D’ALEX ERP — Registro de validação V3

Data: 28/10/2026. Ambiente local, Microsoft Edge, dados e perfil de navegador fictícios/temporários. Nenhum teste alterou dados pessoais do navegador do usuário, emitiu NF ou efetuou pagamentos reais.

## Verificações de código

- TypeScript estrito: compilação verificada.
- Vite: pacote local `dist/` gerado; sem publicação.
- Vitest: 49 testes em quatro arquivos (inclui regressão V1/V2).
- V3: 23 testes operacionais e 3 de armazenamento, cobrindo integridade, snapshots, parcelas, frequência, pagamentos, migração e falhas de gravação.

## Doze cenários obrigatórios

| Solicitação | Verificação realizada |
|---|---|
| 1. Cadastrar, editar e excluir romaneios | Criado e excluído um lote com confirmação; número não reutilizado. Outro lote teve código, descrição, família, grade e quantidade corrigidos. Lote faturado bloqueou exclusão e edição financeira, mas aceitou observação com histórico. |
| 2. Concluir produção interna com preço | Conclusão sem preço bloqueada. Preço de R$ 85,00 salvo; custo de oficina não aparece para interna. |
| 3. Concluir produção terceirizada | Cadastro de oficina, preço de R$ 100,00 e custo de R$ 20,00 por peça. Ausência de oficina/custo bloqueada. |
| 4. NF consolidada com dois romaneios | Dois lotes do mesmo cliente vinculados à NF AVAL-V3. Ausência de autorização bloqueada. Uma única NF no export, sem duplicação de contas a receber. |
| 5. Gerar e copiar resumo | Código, descrição, quantidade, preço e total conferidos. Grades/cores ausentes. Botão copiou o mesmo conteúdo para a área de transferência (normalizadas somente as quebras CRLF do Windows na comparação). |
| 6. NF parcelada e saldo | NF de R$ 2.200,00 dividida em duas parcelas. Dois vínculos de romaneio não duplicaram as parcelas. |
| 7. Registrar e desfazer recebimento | Baixa parcial de R$ 100,00, status Parcialmente recebido, reversão confirmada e reabertura do saldo. Registro original mantido como Desfeito; nova reversão indisponível. |
| 8. Filtrar recebimentos por período | Novo recebimento efetivo de R$ 50,00 em setembro: filtro 09/2026 mostra R$ 50,00; 10/2026 mostra zero após a reversão. |
| 9. Funcionário e frequência diária | Joana e Lucas cadastrados, com função, diária e Pix fictício. Marcar todos como presentes aplicado em data definida. |
| 10. Corrigir calendário | Correção mensal de Presente para Falta refletiu na lista diária. Registro seguinte pelo calendário semanal alimentou o mesmo saldo. |
| 11. Individual e grupo | Joana recebeu R$ 50,00 parcialmente e adiantamento de R$ 200,00; uma nova presença compensou crédito. Fechamento dos saldos de Joana e Lucas em grupo gerou histórico comum e zerou os saldos. Cadastro editado/desativado preservou registros. |
| 12. Oficinas e pagamentos por peça | Custo gerado pela produção concluída; pagamento parcial de R$ 40,00. Segunda produção gerou R$ 40,00 adicionais; pagamento acumulado de R$ 100,00 quitou os saldos de duas produções. Edição/desativação preservou histórico. |

## Regressão da experiência

- Visão Geral com quatro indicadores, Ritmo da Produção e Romaneios Recentes preservados. Links continuam operacionais.
- Exportação JSON e recarga preservam dados integrados e correções.
- Tema escuro persiste; menu retrátil funciona.
- Visão Geral, Funcionários, Oficinas e Financeiro verificados em viewport 390 × 844 sem extrapolação horizontal da página. As tabelas têm rolagem própria.
- Nenhum erro JavaScript durante o percurso automatizado.
- Capturas de Visão Geral, calendário, oficinas e Financeiro móvel inspecionadas visualmente.

O teste de navegador agrupa essas verificações em 14 resultados, disponíveis em `test-results/v3/browser-report.json`. Capturas e exportação do cenário ficam na mesma pasta.

## Reproduzir

`npm test` e `npm run build` executam as verificações de regras e compilação. `browser-v3.cjs` requer Playwright, Edge e aplicação local ativa. `DALEX_PLAYWRIGHT` indica o pacote do runtime do desktop quando necessário; `DALEX_URL` permite trocar o endereço (padrão: http://127.0.0.1:5180/). O navegador usa perfil novo a cada execução.

## Limites

Viewport móvel não equivale a teste em aparelho físico. Não foram testados banco, login real, permissões de produção, emissão fiscal, serviços bancários ou anexos reais, pois estão fora deste protótipo. O histórico local não é auditoria inviolável nem substitui controles transacionais do futuro banco. Importação do JSON, cancelamento/substituição de NF, faturamento parcial e meias diárias permanecem fora do escopo desta versão.
