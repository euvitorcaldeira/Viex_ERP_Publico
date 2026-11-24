# D’ALEX ERP local — relatório de verificação

**Data:** 4 de novembro de 2026  
**Versão:** conversão local em Python para validação; executável ainda não gerado.

## Resultado

| Verificação | Resultado |
|---|---:|
| Testes Python de banco, serviço local, permissões, arquivos, backup e Excel | 16 aprovados |
| Testes React/TypeScript | 77 aprovados em 7 arquivos |
| Compilação TypeScript e geração da interface | Aprovada |
| Verificação de sintaxe dos arquivos Python | Aprovada |
| Fluxo automatizado no navegador | Aprovado, sem erros JavaScript |

O fluxo no navegador da versão anterior cobriu primeiro acesso, login, clientes, funcionários, oficinas, romaneio terceirizado, preço unitário, faturamento, cópia de resumo de NF, parcela sem previsão inicial, previsão editável, recebimento parcial e estorno, pagamentos e estornos, histórico, persistência após reiniciar o serviço, anexo PDF, exportação Excel, backup e restauração, cópia da pasta para outro caminho, temas e janela móvel de 390 px.

Na atualização atual, testes adicionais verificam a mensagem selecionável para WhatsApp e o cálculo da alíquota separado do total da NF, incluindo registro e estorno da baixa do imposto. A compilação TypeScript e Vite passou após essas alterações.

Foram acrescentados testes específicos para permitir corrigir uma frequência que já teve pagamento registrado, mantendo o crédito e o histórico, e para editar a produção depois de estornar um pagamento de oficina sem apagar o lançamento antigo.

## Limites da verificação

- A cópia portátil foi aberta em outro caminho no mesmo computador Windows; ainda não foi validada numa segunda máquina limpa.
- Não foi simulada uma atualização de banco de uma versão distribuída anterior. A cópia ainda não deve receber dados reais da empresa.
- A instalação completa das dependências num Windows limpo não foi executada neste ambiente.
- A revisão visual cobriu a navegação e a disposição em tela móvel, mas não constitui comparação manual pixel a pixel de todas as telas com a demonstração V4.
- Não foram usados dados reais. O arquivo SQLite presente na pasta de trabalho está vazio.

## Próximos passos antes de dados reais

1. Revisar os fluxos com dados fictícios e aprovar o comportamento e as permissões.
2. Implementar e testar migrações reais do esquema antes de distribuir futuras versões.
3. Validar instalação, cópia e recuperação em outro Windows, com uma cópia externa de backup.
4. Só gerar o pacote executável após autorização separada.

## Segurança e operação

O servidor aceita conexões apenas de `127.0.0.1`. A senha é armazenada com hash scrypt e há controle de perfil no servidor. O SQLite não é criptografado em repouso; proteja a conta do Windows e mantenha cópias de backup fora do computador. A cópia automática é diária enquanto o aplicativo permanece aberto.
