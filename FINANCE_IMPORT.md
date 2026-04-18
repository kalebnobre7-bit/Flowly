# Flowly Finance Import

Nova camada de finanças do Flowly:

- entradas
- saídas
- saldo
- meta mensal
- gráficos
- vínculo de receita com tarefas
- imports feitos pela Sexta a partir de extratos/prints

## Estrutura no Supabase
Migration:
- `supabase/migrations/20260319125000_finance_layer.sql`

Tabelas:
- `finance_settings`
- `finance_transactions`
- `finance_imports`

## Fluxo pensado para a Sexta
1. Kaleb envia print do extrato no chat
2. A Sexta extrai as movimentações
3. A Sexta monta um payload JSON padronizado
4. O host grava no Supabase
5. A view de finanças do Flowly reflete tudo automaticamente

## Payload esperado
```json
{
  "settings": {
    "monthly_goal": 10000
  },
  "import": {
    "source": "sexta",
    "status": "processed",
    "summary": "Extrato importado",
    "transaction_count": 2,
    "metadata": {
      "bank": "Nubank",
      "mode": "screenshot"
    }
  },
  "transactions": [
    {
      "type": "income",
      "amount": 650,
      "description": "Projeto Shopify",
      "category": "Cliente",
      "date": "2026-03-19",
      "source": "sexta-import",
      "task_text": "Entrega loja Shopify"
    },
    {
      "type": "expense",
      "amount": 49.9,
      "description": "Assinatura ferramenta",
      "category": "Ferramenta",
      "date": "2026-03-19",
      "source": "sexta-import"
    }
  ]
}
```
