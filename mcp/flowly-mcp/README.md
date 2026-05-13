# Flowly MCP

MCP local para orientar agentes no projeto Flowly.

Ele expõe o sistema de ownership definido em `AGENTS.md` e `.agents/` como ferramentas MCP, além de atalhos de validação seguros.

## Rodar localmente

```bash
cd /Users/kalebnobre/Projetos/Flowly/mcp/flowly-mcp
npm install
node src/server.js
```

## Configuração MCP

Use este server em um cliente MCP apontando para:

```json
{
  "mcpServers": {
    "flowly": {
      "command": "node",
      "args": [
        "/Users/kalebnobre/Projetos/Flowly/mcp/flowly-mcp/src/server.js"
      ],
      "env": {
        "FLOWLY_PROJECT_ROOT": "/Users/kalebnobre/Projetos/Flowly"
      }
    }
  }
}
```

## Ferramentas

- `flowly_agents`: lista agentes, ownership e briefs.
- `flowly_route_change`: classifica arquivos ou uma descrição de mudança por ownership.
- `flowly_validation_plan`: sugere validações para o tipo de mudança.
- `flowly_run_checks`: roda validações locais permitidas (`check`, `test`, `lint`, `smoke`).
- `flowly_project_context`: retorna contexto curto do projeto para orientar outro agente.
