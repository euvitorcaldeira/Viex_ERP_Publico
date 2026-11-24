# D’ALEX ERP — V4 final

## Testar neste computador

Abra **http://127.0.0.1:5180/** e atualize a página. O rodapé mostra **v0.4 final**. Se o serviço estiver fechado, execute `INICIAR.cmd` e mantenha a janela aberta.

## Compartilhar sem instalação

Envie o link público **https://dalex-erp-v4-demonstracao.spicyclove20.chatgpt.site**, ou somente **`release/DALEX-ERP-V4-DEMONSTRACAO.html`**. Quem recebe abre no navegador, sem Node.js, terminal ou várias pastas. Todos os exemplos são fictícios e cada navegador mantém seus próprios testes. Para celular, prefira o link HTTPS, pois visualizadores de arquivos podem não executar JavaScript.

## Conferir os últimos ajustes

1. Use o botão ao lado do logotipo para recolher/expandir. Os ícones continuam disponíveis e, no celular, o menu inicia recolhido.
2. Tente receber acima do saldo. A validação continua bloqueando. Corrija o valor, feche o formulário ou navegue: a mensagem deve desaparecer.
3. Num lote com preços e sem NF/pagamento, edite a quantidade. A revisão mostra quantidade e totais anteriores/novos, preservando unitários dos códigos mantidos se cliente/local continuarem iguais. Códigos novos precisam de preço; trocar cliente/local continua exigindo revisão financeira.
4. Confira o histórico: responsável/perfil de teste, data/hora, quantidades, unitários e totais. Uma nova correção ou desfazimento mantém as entradas anteriores.
5. Em Perfil, alterne Administrador, Operação e Consulta para testar a matriz conservadora. Operação/Consulta não exibem valores; Consulta não grava. **É uma simulação, não login real.** Não use dados reais.

Os demais fluxos aprovados permanecem: cadastros gerais, numeração ROM/pedido do cliente, chegada, grades, período/paginação, conclusão interna/externa, NF consolidada e resumo copiável, previsão opcional/editável, recebimentos parciais e reversões, frequência, diárias/adiantamentos/grupos e custos/pagamentos de oficinas.

## Documentação

- `RELATORIO_FINAL_DALEX_ERP_V4.md`: proposta de arquitetura, Google/Apps Script/Drive, autenticação, custos, backup, integridade, reaproveitamento e migração.
- `VALIDACAO_FINAL_V4.md`: testes executados e limites.
- `GUIA_COMPARTILHAMENTO_V4.md`: arquivo único, publicação estática e cuidados de distribuição.
- `release/LEIA-ME.txt`: instrução curta para quem recebe o HTML.
- `GUIA_V4.md` e demais documentos anteriores: registro das etapas, com a regra de preços desta finalização substituindo o descarte de preços em alterações apenas de quantidade.

## Desenvolver e regenerar

`npm install`, `npm run dev`, `npm test`, `npm run build`.

Para a cópia fictícia: `npm run build:demo`. A chave de armazenamento é separada da versão de desenvolvimento e nenhuma exportação do navegador do autor entra no pacote. `release/SHA256.txt` identifica o arquivo gerado. Publicar em host estático utiliza os arquivos de `release/static` ou o ZIP correspondente.

Não foi iniciada a implementação real nem contratado serviço pago. Autenticação de servidor, permissões de banco, anexos reais, concorrência multiusuário e backups operacionais continuam como próxima etapa, após avaliar e autorizar o plano.
