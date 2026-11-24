# Verificação do lote V2 — 28/10/2026

## Verificações de código

- TypeScript estrito: sem erros.
- Vite: compilação local concluída, sem publicação.
- Vitest: 23 testes em dois arquivos. Cadastro com código/descrição, cor/família opcionais, grades, datas e quantidades válidas, agrupamento por código, cálculos em centavos, divisão de parcelas, restrições de faturamento, prevenção de duplicidade de NF, recebíveis e compatibilidade/preservação da V1.

## Percurso no navegador

Automação com Edge local, em perfil temporário sem interferir nos registros pessoais do usuário. Relatório: `test-results/v2/browser-report.json`.

1. Os quatro indicadores abrem os registros correspondentes; a soma das parcelas coincide com Total a receber.
2. Ritmo da Produção continua abrindo romaneios filtrados por etapa.
3. Cadastro exige código e quantidade válida, aceita cor vazia, outra cor do modelo, produto sem grade e grade personalizada com adição/remoção de tamanho. Revisão soma 30 peças e permite voltar sem perder o código. Foto/PDF permanece simulado pelo nome.
4. Busca por código localiza o lote; Em fila → Em produção → Concluído coloca o lote automaticamente em A faturar, sem conferência obrigatória.
5. Registra entrega antes de faturar; valores por código agrupam cores. A NF de R$ 311,80 gera parcelas de R$ 103,94, R$ 103,93 e R$ 103,93. Vencimento anterior à emissão é bloqueado.
6. A NF permanece após recarga e seu romaneio sai de A faturar; não há botão para faturá-lo novamente.
7. Recebimento de uma parcela reduz somente seu saldo: o painel e o filtro de contas pendentes passam a R$ 2.007,86 no cenário testado. Produção concluída e entrega permanecem preservadas.
8. Exportação JSON inclui versão, itens, NF e recebimentos; Funcionários, Oficinas e Configurações continuam acessíveis.
9. Tema escuro persiste; menu retrátil continua funcionando.
10. Viewport móvel de 390 × 844 não apresenta extrapolação horizontal da página; formulário e grade podem ser percorridos; teclado permanece no diálogo e Escape permite descartar.
11. Restauração confirmada recupera os quatro exemplos V2.
12. Os registros de teste da V1 migram para V2 sem apagar a versão anterior e sem gerar notas automaticamente.
13. Ausência de erros JavaScript durante o percurso.

Capturas em `test-results/v2/`: desktop, formulário de cadastro, faturamento, tema escuro, página móvel, formulário móvel e grade móvel. As capturas de desktop, faturamento e formulário móvel foram inspecionadas visualmente.

## Reproduzir

Com as dependências instaladas: `npm test` e `npm run build`. Para o navegador, executar `browser-v2.cjs` com Playwright disponível, Edge instalado e a aplicação local ativa; `DALEX_PLAYWRIGHT` permite indicar o módulo do runtime do desktop e `DALEX_URL` permite alterar o endereço. Endereço de entrega: http://127.0.0.1:5180/.

## Limites de validação

Celular foi simulado por tamanho de janela, sem aparelho físico. Não há teste de emissão fiscal, banco, autenticação, upload real, movimentação bancária, pagamento parcial ou estorno: essas funções não fazem parte desta entrega. O histórico original de regras continua parcial; as decisões operacionais implementadas são as da avaliação autorizada. Nenhum serviço pago, dado real ou publicação foi utilizado.
