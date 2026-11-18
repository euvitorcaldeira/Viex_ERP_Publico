# VIEX ERP

Sistema ERP local para controle de romaneios, produção, faturamento, recebimentos, equipe, oficinas e balanço.

Aplicativo desenvolvido com React + TypeScript, serviço Python e banco SQLite. O serviço escuta somente no computador local. A marca do produto é **VIEX ERP**; o nome da empresa aparece como configuração do sistema.

## Executar no Windows

1. Instale Python 3.11 ou mais recente e Node.js LTS.
2. Execute `INSTALAR_DEPENDENCIAS.bat` para instalar pacotes e compilar a interface.
3. Abra `VIEX.py` e mantenha a janela aberta durante o uso.

Para desenvolver a interface: `pnpm install --frozen-lockfile`, `pnpm dev`, `pnpm test` e `pnpm build`.

## Dados e privacidade

O banco SQLite, anexos, configurações locais e cópias de segurança **não fazem parte deste repositório**. As pastas `Dados/`, `Anexos/`, `Configuracoes/` e `Backups/` são ignoradas pelo Git. Não adicione dados reais, senhas, backups ou chaves ao repositório.

O sistema local não publica dados nem permite acesso remoto por padrão. Faça uma cópia de segurança pelo próprio aplicativo antes de atualizar ou mover a pasta.

## Estrutura principal

- `src/` — interface e regras de domínio TypeScript.
- `backend/` — serviço local, SQLite, autenticação, auditoria, importação e backups.
- `public/brand/` — logomarcas SVG, PNG e ícone ICO.
- `scripts/` — geração da marca e ferramentas de desenvolvimento.
- `README_LOCAL.md` e `ARQUITETURA_LOCAL.md` — instruções e decisões técnicas.