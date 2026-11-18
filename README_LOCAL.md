# VIEX ERP local

Esta é uma cópia independente da V4. A interface React foi preservada; o aplicativo local é iniciado por Python, escuta somente em `127.0.0.1` e guarda seus dados em SQLite. Não usa serviços em nuvem.

Decisões e limites técnicos estão em [ARQUITETURA_LOCAL.md](ARQUITETURA_LOCAL.md).

**Uso:** aplicativo Python local com banco SQLite neste computador. Antes de atualizar a aplicação usada com dados da empresa, faça e confira uma cópia de segurança; a evolução entre versões do banco deve ser validada antes da atualização.

## O que já funciona nesta versão

- Primeiro acesso com criação de Administrador e entrada por e-mail e senha.
- Senhas armazenadas com scrypt; perfis Administrador, Operação e Consulta; controle de acesso também verificado no serviço local.
- Romaneios, cadastros gerais, produção, faturamento, recebimentos, frequência, funcionários, oficinas e histórico usando gravação SQLite transacional.
- Anexos PDF e imagens PNG, JPEG, GIF e WebP, até 5 MB por arquivo, guardados junto ao projeto e vinculados ao romaneio.
- Planilha `.xlsx` sob demanda, com abas dos principais cadastros e controles.
- Backup ZIP manual, backup automático diário enquanto o aplicativo está aberto e restauração validada. Antes de restaurar, o estado atual é salvo em outra cópia.
- Preservação dos bloqueios de faturamento e pagamento, valores em centavos e proteção contra saldos de recebimento ou oficina acima do disponível.
- Os módulos de interface e domínio em `src/v3` e `src/v4` são mantidos como parte da aplicação local.

## Ajustes de uso desta versão

- Em **Configurações → Cadastros gerais**, marque um cliente como padrão. Ele já virá selecionado ao abrir um romaneio, e poderá ser trocado no próprio formulário.
- Em **Configurações → Nome do sistema**, personalize o nome de exibição do aplicativo e o nome curto da produção interna. As duas alterações ficam salvas no banco e registradas na auditoria.
- No cadastro inicial do romaneio, informe valores unitários do cliente e da oficina junto com os itens. A tela de produção continua permitindo revisar os valores antes da conclusão.
- Na lista de romaneios, o código e o item ficam na primeira coluna e abrem o detalhe ao clicar. A mesma identificação aparece nas tabelas do Financeiro.
- O cabeçalho reúne o nome e a descrição da tela em uma faixa compacta; **Novo romaneio** fica no cabeçalho em todos os módulos para perfis autorizados. O estado local do aplicativo e do banco aparece no rodapé. No Financeiro, a navegação entre contas e impostos fica logo após os cartões de resumo.
- Em **Faturamento**, a lista mostra a descrição dos itens, permite filtrar NFs por mês ou por todas as datas e selecionar ou desselecionar todos os romaneios disponíveis. O resumo para copiar é uma linha contínua.
- A data de emissão começa no dia atual. Em **Configurações → Nome do sistema**, defina o complemento do resumo da NF (por exemplo, uma chave PIX ou forma de pagamento); deixe o campo vazio para não incluir complemento.
- Em **Financeiro**, **Exportar em aberto** prepara um texto para WhatsApp e permite baixar um arquivo `.txt`. Notas parcialmente recebidas mostram apenas o saldo restante.
- Em **Financeiro → Balanço mensal**, o Administrador acompanha recebimentos e pagamentos efetivos, filtra várias categorias e define livremente os meses inicial e final. O gráfico permite selecionar um mês e limpar essa seleção com outro clique. Despesas manuais podem ser editadas, estornadas e restauradas com auditoria.
- O Balanço inicia com os últimos seis meses no gráfico e o mês atual selecionado nos detalhes. As categorias usam datas efetivas de recebimento/pagamento e o resultado depende dos lançamentos registrados. Funcionários, oficinas e impostos entram automaticamente quando seus pagamentos estão registrados nos respectivos módulos.
- O ícone de olho nos cartões de **Total a receber** oculta ou mostra o saldo no painel e no Financeiro. A escolha vale nas duas telas durante a sessão.
- As abas de romaneios aparecem como **Em fila**, **Em produção**, **Concluído** e **Todos**; as duas primeiras incluem a quantidade encontrada para o período e a busca atuais.
- NFs carregadas pela importação histórica começam marcadas como **isentas**. Essa marcação serve para controle e não altera o valor da NF; novas NFs continuam aceitando alíquota ou isenção no módulo **Impostos**.
- Em **Funcionários**, a presença de segunda a sexta acumula automaticamente desde a data de início do controle definida no cadastro. Registre apenas faltas, justificativas, horas extras ou saídas antecipadas.
- O resumo de pagamentos de funcionários soma somente os cadastros ativos. Desativar um funcionário o retira desse total; seu histórico e saldo individual continuam preservados para consulta.
- O cartão **Peças não faturadas** usa o vínculo da NF salvo no romaneio, por isso mostra o mesmo total para Administrador e Consulta sem revelar notas, preços ou recebimentos.
- Exclusões administrativas de NFs e romaneios ficam em **Configurações → Manutenção**, exigem confirmação, geram cópia do banco antes da gravação e deixam evento de auditoria. Uma NF com imposto pago precisa ter a baixa desfeita primeiro.

O SQLite é a fonte oficial. Para manter a V4 funcionando enquanto a conversão avança, o banco tem tabelas relacionais para vínculos e índices e conserva cópias dos registros em JSON nas linhas principais. A estrutura tem número de versão e histórico de esquema; ainda não há atualização de uma versão de banco anterior para outra, pois esta cópia ainda não foi distribuída como versão estável.

## Preparar uma vez

1. Instale Python 3.11 ou mais recente e Node.js LTS no Windows.
2. Extraia ou copie a pasta inteira para um local permanente.
3. Execute `INSTALAR_DEPENDENCIAS.bat` com conexão à internet. Ele instala o pacote gratuito de planilhas, instala as dependências das telas e compila a interface.
4. Depois que a preparação terminar, a internet e o Node.js não são necessários para abrir o aplicativo já compilado.

## Abrir e fechar

1. Dê dois cliques em `VIEX.py`.
2. Na primeira abertura, crie o Administrador com um e-mail e uma senha de pelo menos 12 caracteres.
3. O aplicativo abre no navegador local. Para outras contas, use **Configurações → Cadastros gerais → Usuários**.
4. Feche a janela preta do Python para encerrar o aplicativo. Ao abrir outra vez, entre com sua conta; os dados e usuários permanecem salvos.

O serviço local aceita conexões apenas deste computador. Esta versão não permite que outro computador ou celular acesse o banco pela rede. Um login local não substitui a proteção da conta do Windows e do próprio computador.

## Anexos, planilhas e cópias

Em **Configurações → Proteção de dados**:

- **Criar cópia agora** gera um ZIP dentro de `Backups`, com o banco e anexos.
- O aplicativo também tenta criar uma cópia automática uma vez por dia. Mantém até 14 automáticas; as cópias manuais e a cópia de segurança feita antes de restaurar são preservadas.
- **Baixar planilha** gera `Planilhas/DALEX_Exportacao_Atual.xlsx`, atualizado a partir do banco e com abas separadas.
- Uma restauração substitui o estado atual e encerra as sessões abertas. Confirme apenas depois de escolher a cópia certa.

Guarde cópias periódicas fora do computador (por exemplo, em um pendrive protegido). Backup na mesma máquina ajuda com erros de operação, mas não protege contra defeito, roubo ou perda do computador.

## Levar para outro computador

1. Feche o D’ALEX completamente.
2. Copie a pasta inteira, incluindo `Dados`, `Anexos`, `Backups` e `Configuracoes`.
3. No destino, instale Python 3.11 ou mais recente. Se `openpyxl` não estiver instalado, rode `INSTALAR_DEPENDENCIAS.bat` e conclua a preparação das telas.
4. Abra o `VIEX.py` da pasta copiada e confira os registros e arquivos.

Não mova apenas o banco: os documentos ficam em `Anexos`. A transferência completa foi coberta por uma verificação automatizada com uma cópia em outro caminho temporário; ainda é recomendável repetir a conferência no computador Windows de destino antes do uso real.

## Para que existem duas pastas D’ALEX

`prototype-local` é a área de desenvolvimento: contém fontes React, testes, documentação e dependências de compilação. Não é necessária no computador que só vai executar o sistema. `D’ALEX ERP Local` é o pacote portátil de execução: contém a interface já compilada (`dist`), o servidor Python (`backend`) e as pastas de dados e documentos. Para transportar o aplicativo, copie a pasta `D’ALEX ERP Local` inteira. Preserve separadamente `Dados`, `Anexos`, `Backups` e `Configuracoes` ao atualizar o código.

## Atualizar o código sem substituir os dados

Feche o aplicativo antes de atualizar. Preserve sempre as pastas `Dados`, `Anexos`, `Backups` e `Configuracoes`. Atualize os arquivos de código e as dependências, depois abra `VIEX.py`. Faça e confira um backup externo antes de qualquer atualização. Esta versão recusa bancos criados por código mais novo; valide a atualização do esquema antes de atualizar uma instalação com dados de trabalho.

## Verificações de desenvolvimento

Execute na pasta `prototype-local`:

```powershell
python -m unittest backend.test_database backend.test_http backend.test_data_files -v
pnpm test
pnpm build
```

O teste de navegador automatiza primeiro acesso, cadastro de cliente e romaneio, reinício do aplicativo, download de anexo, exportação Excel, criação/restauração de backup, cópia da pasta para outro caminho e consulta responsiva. Ele usa uma base temporária de teste; não usa nem altera os dados reais.

`GERAR_EXE.bat` permanece sem executar a geração do executável. A preparação e avaliação desta versão devem ocorrer via Python, como solicitado.

## Identidade VIEX ERP

O produto usa a marca VIEX ERP. O nome configurado da empresa continua identificado no espaço de trabalho. Execute VIEX.py para abrir a janela local com a marca e o ícone. DALEX.py encaminha para o mesmo programa por compatibilidade. O atalho VIEX ERP.lnk da pasta de execução foi criado para este computador. Em outro computador, abra VIEX.py.
