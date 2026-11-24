# Registro histórico de verificação — V1 — 28/10/2026

Este documento registra o protótipo V1. A versão atual está verificada em [VALIDACAO_V4.md](VALIDACAO_V4.md); os registros V2/V3 preservam as etapas intermediárias. Use `browser-v4.cjs` para a versão ativa.

## Executado e aprovado

- TypeScript em modo estrito: sem erros.
- Compilação Vite: pacote `dist/` gerado com sucesso, sem publicação.
- Vitest: 8 testes aprovados. Cobrem soma de variantes, registro válido sem anexo, ausência de cabeçalho/itens, quantidades zero/negativa/fracionária/NaN e variante incompleta.
- Teste automatizado de navegador com Microsoft Edge local: 14 verificações de fluxo. Relatório em `test-results/browser-report.json`.
- Verificação visual das capturas de desktop e formulário móvel.

## Fluxos percorridos no navegador

1. Abrir Visão Geral em 1440 × 1024.
2. Tentar avançar sem cabeçalho e verificar a mensagem.
3. Cadastrar referência, cor e tamanho e verificar bloqueio de quantidade zero.
4. Adicionar segunda variante, simular seleção de foto e conferir total de 20 peças na revisão.
5. Voltar, verificar preservação do cliente e confirmar o cadastro.
6. Pesquisar e recarregar para verificar persistência local.
7. Abrir o lote, enviar para conferência e simular sua conclusão.
8. Navegar pelas sete telas.
9. Alternar tema e verificar persistência após recarga.
10. Recolher menu.
11. Usar viewport de 390 × 844, verificar ausência de rolagem horizontal na página e abrir formulário móvel. Fechar pelo Escape com confirmação de descarte.
12. Exportar JSON e verificar os quatro romaneios, incluindo o cadastrado no teste.
13. Restaurar os exemplos com confirmação e verificar os três registros iniciais.
14. Verificar ausência de erros JavaScript durante o percurso.

Capturas: `test-results/desktop.png`, `dark.png`, `mobile.png`, `mobile-form.png`. A sessão automatizada usa um perfil temporário; seus lotes não são inseridos no navegador pessoal do usuário.

## Limites

Teste móvel foi feito por tamanho de janela, não em aparelho físico. Não houve teste de banco, autenticação, NF, upload real, pagamento ou regras operacionais não recuperadas, porque não foram implementados. O runner de testes reportou aviso de encerramento lento no Windows após a aprovação dos testes e saiu com código zero.

## Reproduzir a verificação de navegador

`browser-check.cjs` usa Playwright e o Edge instalado. No ambiente de entrega, o Playwright vem do runtime do desktop, indicado pela variável `DALEX_PLAYWRIGHT`. Fora dele, instale Playwright em um ambiente de desenvolvimento e execute com o protótipo ativo. A variável `DALEX_URL` define o endereço (usado nesta entrega: http://127.0.0.1:5180).

Essa ferramenta de verificação não faz parte da aplicação entregue ao navegador.
