# Flowly Data MCP

Dá ao Claude acesso direto às suas tarefas, hábitos e projetos do Flowly via Supabase REST API.

## Ferramentas disponíveis

| Tool | O que faz |
|------|-----------|
| `flowly_today` | Todas as tarefas de hoje agrupadas por período |
| `flowly_week` | Tarefas da semana atual agrupadas por dia |
| `flowly_pending` | Tarefas incompletas da semana |
| `flowly_create_task` | Cria nova tarefa (texto, dia, período, prioridade, tipo) |
| `flowly_complete_task` | Conclui ou reabre tarefa pelo ID |
| `flowly_search_tasks` | Busca tarefas por texto |
| `flowly_stats` | Estatísticas de conclusão (hoje e semana) |
| `flowly_projects` | Lista projetos ativos |

## Instalação

### 1. Instalar dependências

```bash
cd mcp/flowly-data-mcp
npm install
```

### 2. Registrar no Claude Code

Adicione em `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "flowly": {
      "command": "node",
      "args": ["/caminho/para/flowly/mcp/flowly-data-mcp/src/server.js"],
      "env": {
        "FLOWLY_EMAIL": "seu@email.com",
        "FLOWLY_PASSWORD": "sua_senha"
      }
    }
  }
}
```

Substitua o caminho pelo caminho real do projeto Flowly na sua máquina.

### 3. Reiniciar Claude Code

Feche e abra novamente para carregar o servidor MCP.

## Auth alternativa (token direto)

Se preferir não salvar senha, pegue seu token JWT do navegador:

1. Abra o Flowly no Chrome
2. DevTools → Application → Local Storage
3. Encontre a chave `sb-cgrosyjtujakkbjjnmml-auth-token`
4. Copie o campo `access_token`

E use no settings.json:

```json
"env": {
  "FLOWLY_USER_TOKEN": "eyJhbGci..."
}
```

## Exemplo de uso no Claude

> "Quais são minhas tarefas de hoje?"
> "Cria uma tarefa 'Ligar pro cliente' para amanhã de manhã com prioridade urgente"
> "Qual foi minha taxa de conclusão essa semana?"
> "Marca como concluída a tarefa X"
