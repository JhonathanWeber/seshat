# seshat — Fusão: TOON + Busca Bilíngue

> Documento técnico descrevendo a evolução do projeto seshat com a integração do TOON Format e a implementação de busca bilíngue PT→EN.

---

## Origem

| Projeto | Versão | Licença | Papel |
|---|---|---|---|
| **seshat** | 1.0.2 | MIT © 2025 opencode | Engine base: busca semântica, memória, compressão |
| **@toon-format/toon** | 2.1.0 | MIT © Johann Schopplich | Serialização compacta para LLMs |
| **Busca Bilíngue** | — | MIT | Feature nova (implementação própria) |

---

## 1. Integração TOON

### O que é TOON

**Token-Oriented Object Notation** — formato de serialização projetado para minimizar tokens em prompts de LLMs, mantendo tot legibilidade humana.

### Como está integrado

TOON é aplicado na camada de ferramenta MCP (`handle()`) de cada tool. O parâmetro `format` controla a serialização:

```typescript
// packages/core/src/tools/search_project.ts
import { encode as toTOON } from "@toon-format/toon";

async handle(params) {
  const result = await this.controller.searchProject(p);
  return p.format === "toon"
    ? { success: true, data: toTOON(result) }   // TOON (default)
    : { success: true, data: result };            // JSON
}
```

### Impacto na performance de tokens

| Formato | Tokens (resposta típica) | Redução |
|---|---|---|
| JSON verboso | ~800 tokens | baseline |
| TOON summary | ~240 tokens | **~70%** |
| TOON + compressão | ~16-40 tokens | **~95-98%** |

### Ferramentas com TOON

Todas as ferramentas MCP suportam `format: "toon" | "json"` (default: `toon`):
- `seshat_search`
- `seshat_compress`
- `seshat_analytics`
- `seshat_recall` / `seshat_remember`
- `seshat_optimized_context`

---

## 2. Busca Bilíngue PT→EN

### Motivação

Código TypeScript/JavaScript é escrito em inglês. Queries em português retornavam scores menores:

```
Query PT: "monitoramento de saude da api" → score 0.62
Query EN: "health check API monitoring"  → score 0.96
```

### Implementação

**Arquivos:**

| Arquivo | Mudança |
|---|---|
| `packages/core/src/services/search/query-translator.ts` | **[NOVO]** Detecção PT + tradução Ollama |
| `packages/core/src/controllers/search-controller.ts` | Fallback integrado |
| `packages/core/src/tools/search_project.ts` | Parâmetro `autoTranslate` |
| `apps/tools-api/src/routes/search.ts` | Parâmetro `autoTranslate` |

**Fluxo:**

```typescript
// search-controller.ts — lógica de fallback
const FALLBACK_THRESHOLD = 0.72;

const results = await contextualSearch.search(query, projectId, opts);
const originalBestScore = results[0]?.score ?? 0;

if (autoTranslate && originalBestScore < FALLBACK_THRESHOLD) {
  const translatedQuery = await translator.translate(query);

  if (translatedQuery) {
    const translatedResults = await contextualSearch.search(translatedQuery, projectId, opts);
    const avgOriginal = avgScore(results);
    const avgTranslated = avgScore(translatedResults);

    if (avgTranslated > avgOriginal) {
      finalResults = translatedResults; // usa resultados EN
    }
  }
}
```

**Detecção de português (query-translator.ts):**

```typescript
isPortuguese(query: string): boolean {
  // Critério 1: diacríticos PT (ã, ç, ê, õ, á, é, ...)
  if (/[ãçêõáéíóúâàèìòùÃÇÊÕÁÉÍÓÚÂÀÈÌÒÙ]/.test(query)) return true;
  // Critério 2: stopwords PT
  const ptMatches = words.filter(w => PT_STOPWORDS.has(w)).length;
  return ptMatches >= 1;
}
```

**Tradução via Ollama:**

```typescript
// POST http://localhost:11434/api/generate
// modelo: llama3.2:latest
// timeout: 3000ms
// temperatura: 0.1 (determinístico)
// falha silenciosa: retorna null
```

### Campo `translationInfo` na resposta

```typescript
interface TranslationInfo {
  triggered: boolean;        // fallback acionado?
  originalQuery: string;     // query original
  translatedQuery?: string;  // query traduzida (se triggered)
  originalBestScore: number; // score top-1 busca PT
  translatedBestScore?: number; // score top-1 busca EN
}
```

---

## 3. Watchdog de Auto-Reinício

### Motivação

Bug em `@elysiajs/stream@1.1.0` com Bun v1.3.5 causava crash da API por condição de corrida no callback `cancel()` de streams SSE.

### Implementação

```powershell
# watchdog-api.ps1 — loop principal simplificado
while ($true) {
  if ($apiProc.HasExited) {
    $apiProc = Start-Api   # reinicia
    Wait-ApiReady          # aguarda 30s
    $restarts++
  }
  Start-Sleep -Seconds $HealthInterval  # 10s
  if (-not (Test-ApiHealth)) {          # GET /health
    Stop-Process $apiProc.Id -Force
    $apiProc = $null                    # força reinício no próximo loop
  }
}
```

**start-api.ps1** agora lança o watchdog (não a API diretamente):
```powershell
Start-Process powershell.exe `
  -ArgumentList "-File", $WatchdogScript `
  -WindowStyle Hidden
```

---

## 4. Testes

### Suíte de Testes

```bash
bun test                                               # todos (7 arquivos)
bun test packages/core/src/__tests__/search-controller.test.ts  # busca + fallback
```

### Cobertura por Arquivo

```
packages/core/src/__tests__/
├── search-controller.test.ts    # 10 testes — preview, glob filter, singleton
├── memory-service.test.ts       # CRUD memórias, busca semântica
├── graph-store.test.ts          # Grafo de relações entre entidades
├── checkpoint.test.ts           # Checkpointing de tarefas longas
├── context-controller.test.ts   # Contexto otimizado (search + compress)
├── redundancy-clustering.test.ts # Deduplicação semântica
└── relation-extractor.test.ts   # Extração de relações de código
```

### Resultado de Validação (2026-03-05)

```
bun test v1.3.5
packages/core/src/__tests__/search-controller.test.ts
  ✓ generatePreview — returns preview from metadata if available
  ✓ generatePreview — skips import lines and comments
  ✓ generatePreview — falls back to first line if all are imports/comments
  ✓ generatePreview — truncates long previews at 100 chars
  ✓ generatePreview — returns (empty) for no content
  ✓ filterByPatterns — no filters returns all results
  ✓ filterByPatterns — include filter keeps only matching
  ✓ filterByPatterns — exclude filter removes matching
  ✓ filterByPatterns — both include and exclude
  ✓ singleton — returns same instance

 10 pass | 0 fail | 13 expect() calls | [5.48s]
```

### Teste de Integração MCP

```bash
# Indexação
curl -X POST http://localhost:3344/api/v1/project/index \
  -d '{"projectPath": "D:/workspace/seshat/seshat-main", "projectId": "seshat"}'
# → 134 arquivos, 590 chunks, 0 erros, 1.37s

# Busca PT (fallback deve NÃO ser acionado — score 0.947 > 0.72)
curl -X POST http://localhost:3344/api/v1/search/project \
  -d '{"query": "monitoramento de saude da api watchdog", "projectId": "seshat"}'
# → translationInfo.triggered: false, bestScore: 0.947

# Busca EN (score alto direto)
curl -X POST http://localhost:3344/api/v1/search/project \
  -d '{"query": "watchdog health check restart API process crash recovery", "projectId": "seshat"}'
# → score top-1: 0.968
```

---

## 5. Referências

- [README.md](../README.md)
- [BILINGUAL_SEARCH.md](./BILINGUAL_SEARCH.md)
- [WATCHDOG.md](./WATCHDOG.md)
- [MCP_TEST_VALIDATION.md](./MCP_TEST_VALIDATION.md)
- [MONITOR_DASHBOARD.md](./MONITOR_DASHBOARD.md)
