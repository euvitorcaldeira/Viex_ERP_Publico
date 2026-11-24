# D’ALEX Simple ERP — protótipo 0.2

Aplicação nova em React + TypeScript. Não utiliza código, design ou banco do Apps Script. Não conecta Supabase, emite NF ou transmite dados para serviços externos.

## Como abrir neste computador

O protótipo foi deixado em execução em **http://127.0.0.1:5180**. Abra esse endereço no navegador.

Para iniciar novamente depois de fechar, abra esta pasta no Explorador de Arquivos e dê dois cliques em **INICIAR.cmd**. Mantenha a janela aberta e acesse o mesmo endereço. Se a porta já estiver em uso pelo protótipo, basta abrir o endereço existente.

## Instalação em outro computador

Com Node.js 20.19+ ou 22.12+ instalado, abra um terminal nesta pasta:

```text
npm install
npm run dev
```

Abra o endereço mostrado no terminal (normalmente http://127.0.0.1:5173). Mantenha o terminal aberto enquanto testa. Para encerrar, pressione Ctrl+C. O iniciador usa a porta 5180; endereços/portas diferentes possuem demonstrações locais independentes. Neste computador as dependências já foram instaladas com pnpm.

## Roteiro de validação

1. Clique em **Novo romaneio** na Visão Geral.
2. Tente revisar sem preencher: deve aparecer orientação de preenchimento.
3. Preencha cliente, oficina e data prevista. Cadastre código e descrição do modelo; família e cor são opcionais.
4. Escolha uma grade e preencha as quantidades. Teste outra cor do mesmo modelo, outro modelo, grade personalizada e produto sem grade. Tamanhos não utilizados podem ficar vazios; cada modelo/cor precisa ter ao menos uma peça.
5. Opcionalmente selecione foto/PDF. São guardados apenas os nomes; não há upload nem armazenamento do conteúdo dos arquivos.
6. Revise, volte para corrigir e confirme. O lote deve aparecer na listagem.
7. Pesquise por código, descrição, família, cor, cliente, oficina ou número. Teste os filtros Em fila, Em produção e Concluído.
8. Abra os detalhes, inicie a produção e conclua. Não há conferência sistêmica obrigatória. Pode salvar divergências e data de entrega opcionalmente, sem alterar NF ou recebimento.
9. Em Faturamento, abra o lote concluído, informe os valores unitários por código e registre os dados da NF emitida no portal externo. Escolha de 1 a 12 parcelas e preencha cada vencimento.
10. Confira as parcelas geradas automaticamente no Financeiro. Registre um recebimento simulado e verifique a redução do indicador Total a receber.
11. Atualize a página: romaneios, NFs, entrega e recebimentos devem permanecer neste navegador.
12. Clique nos quatro indicadores da Visão Geral e confira os registros correspondentes. Teste temas, menu retrátil e telas menores. Configurações permite exportar tudo em JSON e restaurar quatro exemplos V2 com confirmação.

Não insira dados reais. O armazenamento local não é backup seguro e pode ser apagado pelo navegador. Use o mesmo endereço/porta para manter a mesma demonstração. Funcionários e Oficinas continuam ilustrativos; Faturamento e Financeiro funcionam como simulações locais, sem emissão de NF, banco ou serviços externos.

A V2 preserva o armazenamento da V1 e copia seus romaneios para o formato novo. Os códigos que não existiam recebem identificação explícita DEMO-V1. As antigas situações “A conferir” e “Conferido” passam a “Concluído”, sem gerar NF ou recebimento automaticamente. Para uma demonstração nova, use Restaurar exemplos em Configurações (somente quando quiser descartar seus testes da V2).

## Verificação técnica

```text
npm test
npm run build
```

O arquivo `VALIDACAO_V2.md` registra o que foi efetivamente executado nesta entrega. `VALIDACAO.md` permanece como histórico da V1. A compilação gera `dist/`; isso não publica o produto.

## Referência funcional

Fontes: `../DALEX_ERP_Backup_Parcial.md` e avaliação V1 enviada pelo usuário nesta conversa, com autorização de implementação em lote. A avaliação mais recente substitui o fluxo demonstrativo de conferência por Em fila → Em produção → Concluído, Faturamento e Contas a Receber. Veja `AVALIACAO_V1.md` e `ARQUITETURA.md` para a consolidação e os limites.

Próximo passo: validar este percurso integrado antes do banco real. Continuam pendentes regras completas de Degaia e das oficinas, diárias, permissões, exceções fiscais/financeiras e refinamentos de parcelamento. Nenhuma regra ausente foi tratada como recuperada da conversa original.
