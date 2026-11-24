# D’ALEX ERP — Validação final V4

Data: 29/10/2026. Dados fictícios e perfis de navegador temporários.

## Resultado

- TypeScript estrito: sem erros.
- 74 testes automatizados em seis arquivos: regras/persistência V1–V4, preços preservados, totais em centavos, trilha de auditoria e matriz de permissões.
- 13 verificações de regressão V4 aprovadas, cobrindo os fluxos completos anteriores e paginação com 200 romaneios no mês.
- 8 verificações finais aprovadas no Edge, descritas abaixo.
- Builds local e de demonstração gerados. HTML único verificado por abertura direta, sem servidor ou dependências externas.
- Publicação Sites confirmada e verificação anônima por HTTPS aprovada: exemplos de fábrica, restrições dos perfis e menu móvel. No teste de medidas, aguardou-se o fim da animação de expansão antes da avaliação geométrica.

## Oito cenários finais

1. Recolher/expandir no topo em um clique; sete ícones mantidos quando recolhido.
2. Recebimento acima do saldo bloqueado. Erros removidos ao corrigir o valor, cancelar o formulário e navegar, preservando a regra financeira.
3. Modelo de 10 peças com preço de R$ 10,00 editado para 25 peças: revisão de R$ 100,00 → R$ 250,00, unitário mantido e histórico com responsável. O custo de oficina e as reversões de quantidade/preço também são cobertos nos testes de regras.
4. Operação/Consulta não exibem valores financeiros, módulos restritos ficam indisponíveis; Consulta não possui gravações operacionais. Proteção de transição de estado testada além da interface.
5. Exportação conserva responsável, perfil demonstrativo, timestamp, snapshots e diferenças de quantidade/preço/total.
6. Menu móvel inicia recolhido, expande e mantém a largura da página em viewport 390 × 844.
7. `DALEX-ERP-V4-DEMONSTRACAO.html` aberto por `file://`: cadastro salvo, recarga realizada, cadastro recuperado e nenhuma requisição HTTP externa.
8. Nenhum erro JavaScript no percurso final nem no HTML independente.

Relatórios: `test-results/v4/browser-report.json` (13) e `test-results/final/browser-report.json` (8). Capturas: revisão, histórico e menu móvel em `test-results/final/`.

Acesso público: https://dalex-erp-v4-demonstracao.spicyclove20.chatgpt.site. Resultado anônimo em `test-results/final/public-report.json`, com capturas `public.png` e `public-mobile.png`. A versão hospedada contém apenas a cópia de demonstração; não foi iniciado o ERP definitivo.

## Distribuição e isolamento

O modo de build `demo` começa com exemplos de fábrica e usa `dalex-public-demo-v4-final`, separado das chaves locais V1–V4. Não copia o armazenamento do autor nem as exportações dos testes. O ZIP estático e o HTML são produzidos somente a partir do build de demonstração. O arquivo `release/SHA256.txt` identifica o HTML distribuído.

Se o navegador bloquear armazenamento na demonstração, a aplicação pode usar memória e perder alterações ao fechar a sessão. Esse comportamento não altera a proteção de dados inválidos da versão local de desenvolvimento.

## Reproduzir

1. `npm test`.
2. `npm run build`.
3. Com a aplicação local ativa: `browser-v4.cjs` e `browser-final.cjs`, usando Playwright/Edge. `DALEX_PLAYWRIGHT` indica o módulo do runtime do desktop quando necessário.
4. Para regenerar o pacote: build Vite em modo `demo` para `release/static`, depois executar `scripts/package-demo.cjs`.
5. `scripts/verify-public.cjs` verifica o link publicado com sessão anônima; `scripts/test-html.cjs` verifica especificamente abertura e persistência do arquivo independente.

## Limites

Os perfis são simulados e podem ser escolhidos por qualquer avaliador; não há autenticação real nem sigilo contra inspeção do JavaScript/armazenamento. O histórico usa uma identidade demonstrativa, não comprovada. Não incluir dados reais no pacote nem no link público.

Não foram implementados/testados servidor, banco transacional, RLS real, concorrência de múltiplos usuários, emissão fiscal, Pix, documentos reais, jobs de backup ou restauração de desastre. Testes móveis verificam viewport de navegador, não todos os aplicativos de arquivos de celulares. Para celulares, a distribuição por HTTPS é preferível ao arquivo local.
