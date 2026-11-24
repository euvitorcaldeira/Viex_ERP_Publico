# Avaliação V1 — lote autorizado e implementado

Fonte: observação por voz e documento “D’ALEX ERP — Avaliação do Protótipo V1” enviado pelo usuário em 28/10/2026. Autorização posterior: “FINALIZEI e pode implementar”.

## Prioridades do lote

1. Corrigir o modelo operacional: código e descrição distintos, família, cor opcional, múltiplas cores e grades predefinidas/personalizáveis/sem grade. Adotar Em fila → Em produção → Concluído. Eliminar a conferência obrigatória.
2. Integrar o fluxo: Faturamento substitui Conferência; concluídos sem NF aparecem automaticamente. Valores unitários por modelo, totais e registro de NF emitida externamente geram as parcelas de Contas a Receber sem recadastro. Produção, entrega, NF e pagamento ficam separados.
3. Ajustar navegação: os quatro indicadores abrem os dados que compõem seus totais; o indicador anterior de conferência passa a A faturar.
4. Preservar e verificar: Ritmo da Produção, Romaneios Recentes e detalhes clicáveis, menu híbrido, identidade visual, temas e responsividade. Testar o percurso inteiro e documentar decisões e limites.

## Detalhes registrados

- Alex é o principal responsável pelo acompanhamento da produção; não há login/atribuição de usuários nesta etapa.
- Conferência física permanece manual, sem comentário ou recontagem obrigatórios. Há campo opcional de divergências.
- A entrega pode ser registrada antes da NF/pagamento, sem módulo de transporte. Implementada como data opcional para o lote inteiro.
- Grades iniciais: numérico adulto, letras, infantil e calçados. Os tamanhos sugeridos são exemplos; a personalizada permite adicionar/remover tamanhos.
- Os valores dos cards financeiros e suas linhas vêm dos mesmos registros de NF/parcelas.

## Mantido

Interface aprovada e navegações existentes foram preservadas. Funcionários e Oficinas permanecem demonstrativos. Sem conexão de dados reais, banco externo, contratação ou publicação.

## Fora deste lote

Banco/autenticação, anexos reais, regras de oficinas/diárias, agrupamento ou fracionamento de NF, pagamento parcial e estornos. As decisões simplificadas desta versão estão em ARQUITETURA.md e devem ser validadas antes de evoluir para uso real.
