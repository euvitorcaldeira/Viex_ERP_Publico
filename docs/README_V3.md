# D’ALEX Simple ERP — Protótipo V3

Aplicação nova em React + TypeScript, local, sem Apps Script, banco externo, emissão fiscal ou transações bancárias. Utilize somente dados fictícios.

## Abrir para testar

Abra **http://127.0.0.1:5180/** e atualize a página se ainda aparecer V2. O rodapé deve mostrar **Protótipo · v0.3**.

Para iniciar novamente, dê dois cliques em **INICIAR.cmd** nesta pasta e mantenha a janela aberta. Se o endereço já estiver em execução, use a janela existente. Não é necessário instalar nada novamente neste computador.

Em outro computador com Node.js 20.19+ ou 22.12+, abra um terminal nesta pasta e execute `npm install` e `npm run dev`. Use o endereço mostrado no terminal. A porta e o navegador definem onde seus dados locais ficam guardados.

## Percurso recomendado

1. **Visão Geral:** seus indicadores, filtros, links e layout foram preservados.
2. **Romaneios e Produção:** cadastre código/descrição, família opcional, cor opcional e grade. O local de produção inicia como “Produção interna”; a oficina externa é definida com os valores na conclusão, quando aplicável. Revise e confirme.
3. Abra os detalhes para **editar** ou **excluir com confirmação** um lote sem vínculos financeiros. A troca de grade preenchida pede confirmação. Itens alterados exigem nova precificação antes de faturar.
4. **Inicie a produção** e escolha **Concluir produção**. Informe o preço do cliente por modelo e escolha Interna ou Terceirizada. Interna não solicita custo de oficina; terceirizada exige oficina ativa cadastrada e custo unitário. Confira receita e custo calculados.
5. **Faturamento:** os lotes concluídos com preço aparecem automaticamente. Use o botão de um romaneio para a NF individual ou selecione vários do mesmo cliente. A consolidação exige marcar a autorização do cliente.
6. Confira o **Resumo para NF** e use **Copiar texto** para o portal externo. Quantidades e preços vêm da produção; não são redigitados. Cores/tamanhos são agrupados por modelo e preço.
7. Depois de emitir no portal externo, informe número, emissão, previsão de pagamento ou parcelas/vencimentos. O protótipo somente registra os dados e cria as contas a receber.
8. **Financeiro:** registre recebimento total ou parcial da parcela. Em Recebidas, use **Desfazer recebimento**, com confirmação. A correção permanece no histórico e reabre o saldo. Selecione mês/ano: o card Recebido considera a data efetiva, excluindo baixas desfeitas. Em aberto mantém os saldos de todos os meses para corresponder ao painel.
9. **Funcionários:** cadastre nome, função, diária e Pix fictício. Em Frequência, escolha uma data e registre presença/falta/não trabalhado, ou marque todos como presentes. Calendários semanal e mensal permitem corrigir os mesmos dados.
10. Nos cadastros, use **Pagar** para pagamento total/parcial ou **Adiantamento**. Selecione funcionários com saldo e use **Fechar pagamentos em grupo**. Consulte Pagamentos e histórico; não há periodicidade fixa. Alterar a diária não altera os dias já registrados. Corrigir uma presença já paga pode gerar crédito, preservando o pagamento original.
11. **Oficinas:** cadastre a oficina antes de concluir uma produção terceirizada. Em Produções e histórico, confira peça, unitário, custo, pago e saldo. Use **Pagar produção** para uma produção ou **Pagamento acumulado** para os saldos abertos daquela oficina; valores parciais são permitidos.
12. **Configurações:** exporte o JSON completo ou restaure os exemplos V3 mediante confirmação. O armazenamento original da V1/V2 permanece preservado.

## Proteções e limites desta etapa

- NF ou pagamento de oficina impede exclusão e alteração de cliente, itens e preços do romaneio vinculado. Datas/observações podem ser corrigidas com histórico. Não há recálculo de NF emitida.
- Uma NF pode reunir romaneios do mesmo cliente e com autorização. Cada romaneio é faturado integralmente uma única vez; não há faturamento parcial, cancelamento ou substituição de NF nesta versão.
- De 1 a 12 parcelas iguais, com ajuste exato de centavos; vencimentos são informados manualmente. Recebimentos parciais e seu desfazimento são suportados.
- Presenças geram diária integral. Pagamentos de funcionários e oficinas não efetuam Pix ou movimentação bancária. Crédito/adiantamento de funcionário é compensado por próximas diárias.
- Sem transporte, recolhimento ou logística. Entrega representa o lote inteiro e fica separada da NF e dos pagamentos.
- Anexos continuam simulados pelo nome. Login, banco real, permissões por usuário e anexos reais permanecem para uma etapa posterior.
- Ao migrar V2, NFs e recebimentos são preservados como registros únicos. Lotes antigos concluídos sem preços precisam de **Revisar preços** para aparecer em A faturar. Custos de oficinas não são inventados para notas históricas da V2.
- Os dados permanecem no navegador e podem ser apagados por ele. Exportar JSON preserva uma cópia; a importação ainda não está disponível. Esta versão se destina a uma sessão de avaliação local, sem concorrência entre usuários.

## Documentação e testes

- `REQUISITOS_V3.md`: texto original da solicitação V3.
- `ARQUITETURA_V3.md`: decisões, estrutura e integridade dos dados.
- `VALIDACAO_V3.md`: cenários efetivamente verificados.
- `npm test`: testes de regras e persistência.
- `npm run build`: verificação TypeScript e compilação local em `dist/`, sem publicação.
- `browser-v3.cjs`: verificação de interface com Playwright e Edge; detalhes de execução no registro de validação.

Próximo passo recomendado: avaliar os fluxos completos com exemplos fictícios da rotina e validar critérios de edição, diárias, consolidação e pagamentos antes do banco real.
