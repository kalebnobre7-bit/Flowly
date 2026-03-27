# Flowly (repositório consolidado)

Este repositório foi consolidado para manter **uma única versão principal** do app:

- Fonte oficial: [`_review_flowly/`](./_review_flowly)
- Entrada na raiz: [`index.html`](./index.html) redireciona para a versão principal.

## Por que esta organização?

Antes existiam duas árvores de código com sobreposição (`Flowly-main/` e `_review_flowly/`), o que aumentava risco de drift e manutenção duplicada.

Agora a manutenção fica centralizada na pasta `_review_flowly/`, que já contém:

- arquitetura modular (`js/core`, `js/views`, `js/components`)
- scripts de qualidade (`npm run check`, `npm test`, `npm run lint`)
- documentação técnica e migrações Supabase

## Desenvolvimento

```bash
cd _review_flowly
npm install
npm run check
npm test
npm run lint
```

## Deploy local simples

Abra `index.html` na raiz (redireciona automaticamente para `_review_flowly/index.html`).
