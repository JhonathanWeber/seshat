# seshat — Busca Bilíngue PT→EN (Fallback Automático)

> **Implementado em:** 2026-03-05 | **Status:** ✅ Ativo

## Problema

Queries em português retornavam scores baixos para código escrito em inglês.

**Exemplo:**
- Query PT: *"monitoramento de saude api watchdog"* → score 0.62  
- Query EN: *"watchdog health check restart API process"* → score **0.96**

---

## Solução: Fallback Threshold-Based

Quando o melhor score da busca primária fica abaixo de `0.72`, o sistema automaticamente:
1. Detecta se a query está em português
2. Traduz para inglês via Ollama (timeout 3s, falha silenciosa)
3. Executa segunda busca com a query traduzida
4. Retorna o conjunto com maior score médio

```
Query PT → Busca primária
    ↓ bestScore < 0.72?
   SIM → QueryTranslator (Ollama, 3s timeout)
    ↓ tradução OK?
   SIM → Busca EN → avg(EN) > avg(PT)? → usa EN
    ↓ NÃO (timeout/falha)
   usa resultado PT original
```

---

## Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `packages/core/src/services/search/query-translator.ts` | **[NOVO]** Detecção PT + tradução via Ollama |
| `packages/core/src/controllers/search-controller.ts` | Fallback integrado em `searchProject()` |
| `packages/core/src/tools/search_project.ts` | Parâmetro `autoTranslate` no MCP tool |
| `apps/tools-api/src/routes/search.ts` | Parâmetro `autoTranslate` na rota HTTP |

---

## Detecção de Português

O `QueryTranslator` detecta PT por dois critérios (OR):
- **Diacríticos:** presença de `ã ç ê õ á é í ó ú â à...`
- **Stopwords:** ≥ 1 palavra do vocabulário PT (`como`, `funciona`, `busca`, `processo`, etc.)

---

## Parâmetro `autoTranslate`

Disponível em todas as interfaces (MCP, HTTP):

```typescript
// Desativar o fallback (ex: query deliberadamente em inglês)
seshat_search({ query: "health check", projectId: "...", autoTranslate: false })
```

**Default:** `true`

---

## Resultado no Output

Toda busca agora retorna `translationInfo`:

```json
// Fallback NÃO acionado (score >= 0.72)
"translationInfo": {
  "triggered": false,
  "originalQuery": "monitoramento de saude da api watchdog reinicio",
  "originalBestScore": 0.947
}

// Fallback ACIONADO
"translationInfo": {
  "triggered": true,
  "originalQuery": "reinicio automatico processo",
  "translatedQuery": "automatic process restart",
  "originalBestScore": 0.61,
  "translatedBestScore": 0.94
}
```

---

## Threshold

`FALLBACK_THRESHOLD = 0.72` — definido em `search-controller.ts`.  
Ajuste conforme necessário. Scores típicos:
- `> 0.80` → excelente (sem fallback necessário)
- `0.60–0.72` → bom mas pode melhorar (fallback tenta)
- `< 0.60` → fallback sempre acionado

---

## Referências

- [`query-translator.ts`](../packages/core/src/services/search/query-translator.ts)
- [`search-controller.ts`](../packages/core/src/controllers/search-controller.ts)
- [MCP Test Validation](./MCP_TEST_VALIDATION.md)
