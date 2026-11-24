# Decisões arquiteturais — 0.2

Documento histórico da V2. A arquitetura ativa está em [ARQUITETURA_V3.md](ARQUITETURA_V3.md).

## React + TypeScript + Vite

Aplicação cliente simples, sem servidor próprio nesta fase. Tipagem estrita e compilação antes da geração do pacote. Não há justificativa nesta etapa para microserviços ou infraestrutura paga.

## Separação de responsabilidades

- `src/domain.ts`: tipos de romaneio e item, validação, cálculo de total e contrato de repositório.
- `src/data/seed.ts` e `src/data/repository.ts`: dados fictícios e adaptador de armazenamento local.
- `src/main.tsx`: ponto de entrada; `src/App.tsx` e `src/Application.tsx`: composição e navegação. Não há rotas públicas ou links profundos nesta fase.
- `src/components/`: formulário de romaneio, editor de grades, detalhes, formulário de faturamento, Financeiro, tabelas e diálogo acessível, separados por responsabilidade.
- `src/format.ts`: apresentação de datas e moeda, conversão exata de valores digitados para centavos.
- `src/style.css`: temas por variáveis e adaptação a telas menores.
- `src/domain.test.ts` e `src/data/repository.test.ts`: invariantes, integração dos registros e compatibilidade entre versões.

A persistência é síncrona e local por simplicidade. Antes de integrar Supabase, substituir o contrato por métodos assíncronos e implementar estados de carregamento/erro, autenticação e políticas RLS. Nunca colocar credenciais privilegiadas no cliente. A etapa de banco deverá incluir migrações versionadas, chaves próprias para entidades, transações nas operações críticas e testes das permissões; isso ainda não está implementado.

## Dados fictícios e escopo

Os quatro exemplos iniciais são demonstrativos e não são base de implantação. Reset depende de confirmação e afeta somente a chave V2. Os valores financeiros agora derivam das NFs e parcelas dos romaneios, substituindo os antigos indicadores independentes. Não há etapa de conferência; observações de divergência são opcionais.

## Consistência do fluxo V2

Produção (Em fila → Em produção → Concluído), entrega, NF e recebimento são informações distintas. A fila de faturamento é calculada a partir de produção concluída e ausência de NF; não há cópia de cadastro entre módulos. O registro local de NF e suas parcelas é salvo numa única atualização do romaneio, impedindo gerar recebíveis sem a correspondente nota.

Preços são informados por código de modelo; cores e tamanhos são agrupados pelo código no faturamento. O mesmo código deve ter descrição coerente. Cor e família são opcionais nesta etapa. Valores são inteiros em centavos, com verificação de soma; a divisão igual das parcelas distribui centavos restantes nas primeiras parcelas. Vencimentos são explicitamente informados pelo usuário, sem presumir prazo comercial.

Decisões proporcionais ao protótipo, ainda sujeitas à validação: uma NF por romaneio; 1 a 12 parcelas iguais com ajuste de centavos; unicidade do número da NF na demonstração, sem séries fiscais; recebimento integral de cada parcela; entrega simples do lote inteiro; modelos de grades Infantil/Calçados como exemplos personalizáveis. Não há cancelamento de NF, agrupamento de romaneios em uma NF, faturamento parcial, pagamento parcial ou estorno. Nenhuma dessas limitações define a política futura da empresa.

## Evolução dos dados de avaliação

`dalex-prototype-v1` permanece intacta. Sem dados V2, o adaptador cria uma cópia em `dalex-prototype-v2`. Preserva quantidades, descrição, cor, tamanho, observações e nomes de anexos. Códigos antes inexistentes recebem identificadores DEMO-V1, sem inventar códigos comerciais. As etapas A conferir/Conferido são convertidas para Concluído (a produção já estava terminada no fluxo demonstrativo anterior), mantendo NF nula. A conversão não acessa nem reaproveita o Apps Script. A exportação V2 inclui versão, romaneios, itens, entrega, NFs e parcelas.

Os arquivos anexados não são lidos nem enviados: o protótipo guarda nomes. Upload real exigirá armazenamento privado, limites de tipo/tamanho e controle de acesso. Foto/PDF opcional é regra confirmada; os demais detalhes aguardam validação.

## Acessibilidade e manutenção

Controles possuem rótulos, foco visível, diálogo com foco contido, fechamento por Escape e confirmação de descarte dos formulários de cadastro/faturamento. Tabelas têm rolagem horizontal em telas estreitas. A navegação móvel usa ícones com títulos. Introduzir rotas quando houver necessidade de links diretos. Não acrescentar backend antes da aprovação do fluxo.

## Limite documental

O histórico original recuperado é parcial. A avaliação V1 e a autorização posterior são a referência adicional para esta entrega. As antigas regras demonstrativas foram substituídas apenas nos pontos explicitamente revisados pelo usuário. O documento de backup original permanece preservado sem alterações.
