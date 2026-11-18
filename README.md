# VIEX ERP

Sistema ERP local para controle de romaneios, produção, faturamento, recebimentos, equipe, oficinas e balanço.

O aplicativo combina interface React + TypeScript, serviço Python e banco SQLite. O serviço escuta somente no computador local. A marca do produto é **VIEX ERP**; o nome da empresa aparece como configuração do sistema.

## Executar no Windows

1. Instale Python 3.11 ou mais recente e Node.js LTS.
2. Execute `INSTALAR_DEPENDENCIAS.bat` para instalar os pacotes e compilar a interface.
3. Abra `VIEX.py` e mantenha a janela do aplicativo aberta durante o uso.

Para desenvolver a interface manualmente, instale as dependências com `pnpm install --frozen-lockfile`, rode `pnpm dev` e use `pnpm test` ou `pnpm build`.

## Dados e privacidade

O banco SQLite, anexos, configurações locais e cópias de segurança ficam na pasta do aplicativo e **não fazem parte deste repositório**. Os caminhos `Dados/`, `Anexos/`, `Configuracoes/` e `Backups/` são ignorados pelo Git. Não adicione registros reais, senhas, cópias de segurança ou chaves ao repositório.

O sistema local não publica os dados nem permite acesso remoto por padrão. Faça uma cópia de segurança pelo próprio aplicativo antes de atualizar ou mover a pasta.

## Estrutura principal

- `src/` — interface e regras de domínio TypeScript.
- `backend/` — serviço local, SQLite, autenticação, auditoria, importação e backups.
- `public/brand/` — logomarcas SVG, PNG e ícone ICO.
- `scripts/` — geração de ativos de marca e apoio ao empacotamento.
- `docs/` e arquivos Markdown — arquitetura, guias e histórico do projeto.

As instruções operacionais locais estão em [`README_LOCAL.md`](README_LOCAL.md), e as decisões técnicas em [`ARQUITETURA_LOCAL.md`](ARQUITETURA_LOCAL.md).
