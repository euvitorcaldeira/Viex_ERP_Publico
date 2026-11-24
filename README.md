# VIEX ERP

Sistema local para controlar romaneios, produção, faturamento, recebimentos, impostos, funcionários, frequência, oficinas e balanço. A interface abre no navegador, o serviço Python aceita conexões deste computador e o SQLite guarda os registros.

## Abrir no Windows

1. Na pasta de execução, que já vem com `dist/`, instale Python 3.11 ou mais recente. Abra o Prompt ou PowerShell nessa pasta e rode `python -m pip install -r requirements.txt`.
2. Abra `VIEX.py` ou use o atalho **VIEX ERP** neste computador. Mantenha a janela do aplicativo aberta durante o uso e feche-a para encerrar.
3. No primeiro acesso, crie o Administrador com e-mail e senha de pelo menos 12 caracteres. Em **Configurações → Cadastros gerais → Usuários**, cadastre outras contas conforme os perfis Administrador, Operação e Consulta.

A pasta compilada funciona sem Node.js e sem internet depois que as dependências Python estão instaladas. Após uma atualização, reabra o aplicativo e use **Ctrl+F5** se o navegador ainda mostrar a tela anterior.

## Uso diário

- **Romaneios e produção.** Em **Configurações → Cadastros gerais**, defina o cliente padrão, que pode ser trocado ao lançar um romaneio. Preencha os valores unitários do cliente e da oficina no cadastro e revise-os na produção. As abas são **Em fila**, **Em produção**, **Concluído** e **Todos**. As duas primeiras mostram contadores. Clique no código ou item para abrir o detalhe nas listas e no Financeiro. Perfis autorizados podem usar **Novo romaneio** no cabeçalho dos módulos. **Peças não faturadas** usa o vínculo da NF no romaneio e respeita a visibilidade financeira dos perfis.
- **Faturamento e impostos.** A data de emissão inicia no dia atual. Em Faturamento, confira os itens, filtre por mês ou por todas as datas e use a seleção em lote de romaneios. O resumo é copiado em uma linha. Em **Configurações → Nome do sistema**, personalize o nome de exibição, o nome curto da produção interna e, opcionalmente, o texto de pagamento do resumo da NF. As alterações de nome ficam na auditoria. NFs importadas pelo histórico começam como isentas para controle, com o valor original preservado. Para novas NFs, informe alíquota ou isenção em **Impostos**.
- **Financeiro e balanço.** **Exportar em aberto** copia a lista para WhatsApp ou baixa um `.txt`. Notas parciais mostram somente o saldo restante. O ícone de olho em **Total a receber** controla a exibição no painel e no Financeiro durante a sessão. Em **Balanço mensal**, o Administrador pode selecionar período e categorias, clicar no gráfico para filtrar e clicar novamente para limpar. A tela abre com os últimos seis meses no gráfico e o mês atual nos detalhes. Recebimentos e pagamentos a funcionários, oficinas e impostos entram pela data efetiva. Despesas manuais podem ser lançadas, editadas, estornadas e restauradas com auditoria.
- **Funcionários.** A presença acumula automaticamente de segunda a sexta desde o início do controle. Lance apenas exceções, como faltas, justificativas, horas extras e saídas antecipadas. O resumo de pagamentos considera funcionários ativos. O histórico e o saldo individual dos inativos continuam disponíveis.
- **Manutenção.** O Administrador pode excluir uma NF ou um romaneio sem NF em **Configurações → Manutenção**. Confira os vínculos antes de confirmar. O ERP faz uma cópia antes da exclusão e registra a operação na auditoria. Se o imposto da NF tiver sido baixado, desfaça a baixa primeiro.

## Anexos, exportação e backup

- Os anexos do romaneio aceitam PDF, PNG, JPEG, GIF e WebP, com até **5 MB por arquivo**.
- Em **Configurações → Proteção de dados**, use **Baixar planilha** para gerar `Planilhas/DALEX_Exportacao_Atual.xlsx`. O SQLite é a fonte dos registros.
- **Criar cópia agora** gera um ZIP em `Backups/`. Com o aplicativo aberto, o sistema tenta gerar uma cópia automática por dia e mantém até 14 automáticas. Guarde uma cópia fora do computador.
- A restauração salva uma cópia do estado atual antes de substituí-lo e encerra as sessões abertas.

## Mover ou atualizar a instalação

Para mover para outro Windows, feche o VIEX e copie a pasta de execução inteira para um local gravável. Inclua `Dados/` (banco e registros), `Anexos/`, `Backups/` e `Configuracoes/`. No destino, siga os passos de instalação acima, entre com a mesma conta e confira um romaneio, um saldo e um anexo.

Para atualizar, faça e confira um backup externo, feche o aplicativo e preserve as quatro pastas de dados ao substituir os arquivos de código. Valide a atualização do esquema antes de abrir uma base de trabalho em outra versão. Mantenha banco, anexos, backups, configurações, exportações e credenciais fora do GitHub.

## Desenvolvimento e implantação

O GitHub e a pasta de desenvolvimento `prototype-local` contêm as fontes React e TypeScript em `src/`, o serviço Python em `backend/`, a marca em `public/brand/` e os testes. Para preparar o projeto no Windows, instale Python 3.11 ou superior e Node.js LTS e execute `INSTALAR_DEPENDENCIAS.bat`. Para trabalhar pela linha de comando:

```powershell
python -m pip install -r requirements.txt
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

Para testar o servidor, aponte `DALEX_DATA_DIR` para uma pasta temporária vazia e rode `python -m unittest discover -s backend -v`. No modo console, execute `python VIEX.py --console` e acesse `http://127.0.0.1:8765`.

Consulte a [arquitetura local](https://github.com/euvitorcaldeira/Viex_ERP/blob/main/ARQUITETURA_LOCAL.md) e o [guia de implantação em VPS](https://github.com/euvitorcaldeira/Viex_ERP/blob/main/docs/IMPLANTACAO.md) no repositório privado.
