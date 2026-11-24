# D’ALEX Simple ERP — Protótipo V4

Abra **http://127.0.0.1:5180/** e atualize a página. O rodapé deve mostrar **v0.4**. Para iniciar novamente neste computador, dê dois cliques em `INICIAR.cmd` e mantenha a janela aberta. Não é necessário instalar dependências novamente.

Em outro computador com Node.js 20.19+ ou 22.12+, execute `npm install` e `npm run dev` nesta pasta e use o endereço mostrado. Os dados são separados por navegador e endereço/porta.

## O que mudou nesta avaliação

### Faturamento e previsão

Registre a NF com número e data de emissão, deixando a previsão em branco quando ainda aguarda a programação do cliente. As parcelas e os valores continuam em Contas a Receber, com previsão **A definir**.

No Financeiro, use **Editar previsão** em cada parcela para preencher, corrigir ou remover a data depois, inclusive quando já houve recebimento parcial. Isso não altera valores da NF, nem registra ou desfaz recebimentos. Datas informadas devem ser válidas e a partir da emissão.

Use **Ordenar por** para maior/menor valor, número da NF (ordem numérica natural) ou previsão próxima/distante. Parcelas sem previsão ficam no final das ordenações por data. Na lista de recebimentos, a ordenação por data considera a data efetiva recebida. Os valores de referência são os de cada parcela/recebimento, não a soma de uma NF com várias parcelas.

### Cadastros gerais

Em **Configurações → Cadastros gerais** estão **Clientes, Funcionários, Oficinas e Usuários**. Permitem cadastrar, editar, desativar e reativar, preservando vínculos e histórico.

Os usuários são demonstrativos: nome, e-mail e perfil, sem senha, autenticação ou permissão real. Não use dados pessoais reais. Funcionários e Oficinas permanecem separados no menu para frequência, pagamentos e acompanhamento; o cadastramento fica no console geral.

Em **Configurações → Ambiente** continuam tema, exportação JSON completa e restauração de exemplos com confirmação.

### Romaneios

- Cliente é uma lista dos clientes cadastrados. Local de produção é uma lista com **Produção interna · D’ALEX** como padrão e as oficinas ativas cadastradas. Não é necessário redigitar nomes.
- O local escolhido define o tipo e a oficina na conclusão. Ali são solicitados somente os valores negociados que faltam; os dados de origem aparecem preenchidos e protegidos de redigitação. Para mudar a origem, use **Editar romaneio** antes de haver NF/pagamento.
- A grade padrão dos novos modelos é **Numérico adulto**, mantendo todas as outras opções e as grades dos registros já cadastrados.
- **Data de recebimento** substitui a previsão de término da produção e inicia com hoje. Não se exige uma previsão de quando a equipe terminará o lote.
- **Pedido / romaneio do cliente** guarda o número externo, sem alterar a sequência ROM interna. A busca também encontra esse número.
- Alterar cliente, itens ou local de um lote ainda sem vínculos financeiros exige revisar os preços. Uma correção de nome no mesmo cadastro de cliente não altera valores negociados.
- O filtro de período inicia no mês atual, pela chegada. Há **Todas as datas**, **Sem data**, mês/ano e paginação de 10, 20 ou 50 por página (padrão 20). Os filtros de etapa continuam disponíveis.
- Indicadores globais e links da Visão Geral abrem todas as datas para que os registros correspondam ao total clicado. A navegação normal pelo menu inicia no mês atual.

### Funcionários e desfazimento

Funcionários abre em **Painel**, com ativos, total a pagar, créditos/adiantamentos e presentes hoje. Lista diária e calendários permanecem integrados; os calendários semanal/mensal mostram o dia da semana sobre cada data.

Em **Pagamentos e histórico**, selecione um funcionário e use **Desfazer pagamento** mediante confirmação. Para um fechamento, é possível desfazer uma linha ou usar **Desfazer fechamento** para todo o grupo. Saldos e créditos são recalculados, e as linhas antigas ficam como Desfeito.

Oficinas mantém o acompanhamento aprovado e também permite desfazer pagamentos no histórico, restaurando os saldos das produções que compõem o lançamento.

## Seus testes anteriores

A V4 copia a V3 para uma nova chave do navegador, preservando a chave original, NFs, valores, frequências, pagamentos e histórico. Clientes antigos são reunidos em cadastro por nome e oficinas/tipos são recuperados dos valores de produção já registrados. Produções mistas antigas são preservadas como histórico, sem sobrescrever custos.

**A antiga data prevista não é convertida em chegada automaticamente.** Esses romaneios aparecem em **Sem data**, **Todas as datas** e nos links globais da Visão Geral. Há um aviso e um botão para consultá-los na listagem. Informe a chegada real ao editá-los; a data antiga continua preservada no armazenamento original e no histórico da edição.

## Testes e limites

`npm test` executa as verificações de regras/persistência. `npm run build` verifica TypeScript e gera `dist/`, sem publicação. `browser-v4.cjs` verifica a interface com Edge/Playwright; detalhes estão em `VALIDACAO_V4.md`.

Continuam fora do escopo: banco real, login real, emissão fiscal, Pix/transações bancárias, anexos reais, importação do JSON e regras definitivas de produção. Prazo automático a partir da emissão ficou como ideia futura; nenhuma data foi inferida sem a programação do cliente.

Use apenas dados fictícios e uma sessão de avaliação por vez. O armazenamento local não substitui um banco transacional. Exportar JSON preserva uma cópia completa dos testes. Não houve contratação, publicação ou reaproveitamento do Apps Script.

Recomendação: validar agora um ciclo completo com chegada, oficina escolhida, conclusão, NF sem previsão, agendamento posterior e correção de pagamento, antes de avançar à integração com banco.
