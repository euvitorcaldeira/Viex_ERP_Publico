# Implantação do VIEX ERP na nuvem

## Validar localmente

1. Clone o repositório privado. Instale Python 3.11 ou superior, Node.js LTS e pnpm.
2. Na pasta clonada, rode `python -m pip install -r requirements.txt`, `pnpm install --frozen-lockfile` e `pnpm build`.
3. Execute `python VIEX.py --console` e abra http://127.0.0.1:8765.
4. Crie um administrador em uma base de teste. Valide romaneio, faturamento, recebimento e anexos.

## Validar em um VPS Linux

1. Prepare o servidor com um usuário de serviço e disco persistente. Clone o código, instale as dependências e compile a interface como acima. Configure `DALEX_DATA_DIR` com um caminho gravável no volume persistente.
2. Inicie o ERP em modo console. Para acessar o ambiente de teste pelo navegador, rode `ssh -L 8765:127.0.0.1:8765 usuario@servidor` na sua máquina e abra http://127.0.0.1:8765 com a sessão SSH ativa.
3. Configure systemd para iniciar o ERP automaticamente com o usuário de serviço, a pasta do projeto como diretório de trabalho e o comando `VIEX.py --console` executado pelo Python do ambiente virtual.
4. Para acesso dos usuários pelo domínio, revise primeiro a validação de Host e Origin em `backend/http_server.py`, o cadastro inicial de administrador e os cookies de sessão. Configure um proxy reverso HTTPS e teste login, logout, proteção CSRF e perfis de acesso.
5. Configure backup do SQLite e dos anexos em armazenamento separado. Valide a restauração e os fluxos com dados fictícios antes de agendar a transferência da base real.

Para um piloto com poucos usuários, avalie uma única instância com SQLite em disco persistente. PostgreSQL ou Supabase exigem adaptar e testar a camada de dados. O material em `docs/historico` e `docs/arquitetura` documenta as fases do protótipo.
