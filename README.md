

# seshat · Ancient Knowledge Keeper

> **Semantic code search + persistent memory + 98% token reduction — 100% offline.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Bun](https://img.shields.io/badge/runtime-Bun-black?logo=bun)](https://bun.sh)
[![Ollama](https://img.shields.io/badge/AI-Ollama-blue)](https://ollama.com)
[![TOON](https://img.shields.io/badge/format-TOON%20v2.1-purple)](https://github.com/johannschopplich/toon)

---

## ✨ O que é

**seshat** é a evolução definitiva e rebatizada do projeto original _Th0th_. É um servidor MCP (*Model Context Protocol*) que confere ao seu assistente de IA uma **memória semântica persistente** e mecanismos de **busca de código de alta precisão** — rodando de forma 100% *offline* e segura.

Nascido da necessidade de contornar os altíssimos custos de processamento de tokens na leitura de diretórios inteiros, o **Seshat** é uma verdadeira **fusão de três grandes vertentes tecnológicas**:

| Tecnologia Base | O Que Trouxe para o Projeto |
|---|---|
| **Th0th (Engine Original)** | A fundação original do projeto (criada em 2025). Trouxe a engine robusta baseada em embeddings, SQLite Vector Store local e a retenção de memória cross-session. |
| **Padrão TOON v2.1** | Solucionou o gargalo financeiro de processamento de arquivos. Essa serialização ultra-eficiente (*Token-Oriented Object Notation*) compactou as respostas XML/JSON longas em formatos minúsculos que **poupam até 98% dos tokens gastos** pelos LLMs. |
| **Busca Bilíngue (PT→EN)** | *[NOVO]* Adicionou fallback em tempo real para permitir raciocinar prompts tanto em português nativo quanto nos termos técnicos ingleses do código fonte, unindo mundos. |

---

## 🚀 Quick Start

```bash
# 1. Clone e instale
git clone <repo-url>
cd seshat
bun install

# 2. Setup offline com Ollama
./scripts/setup-local-first.sh   # Linux/Mac
# ou no Windows:
powershell -File start-seshat.ps1

# 3. Build e start
bun run build
bun run start:api
```

**Verificar:** `curl http://localhost:3344/health`

---

## 🔌 Integração MCP

### VSCode / Antigravity

Crie `.vscode/mcp.json` no seu workspace:

```json
{
  "servers": {
    "seshat": {
      "command": "bun",
      "args": ["run", "/path/to/seshat/apps/mcp-client/src/index.ts"],
      "env": { "SESHAT_API_URL": "http://localhost:3344" }
    }
  }
}
```

### OpenCode

`~/.config/opencode/opencode.json`:

```json
{
  "mcpServers": {
    "seshat": {
      "type": "local",
      "command": ["bunx", "@seshat-ai/mcp-client"],
      "env": { "SESHAT_API_URL": "http://localhost:3344" },
      "enabled": true
    }
  }
}
```

### Docker

```json
{
  "mcpServers": {
    "seshat": {
      "type": "local",
      "command": ["docker", "compose", "run", "--rm", "-i", "mcp"],
      "enabled": true
    }
  }
}
```

---

## 🛠️ Ferramentas MCP

| Ferramenta | Descrição | TOON |
|---|---|---|
| `seshat_index` | Indexa diretório para busca semântica | ✅ |
| `seshat_search` | Busca híbrida vetorial + keyword com **fallback PT→EN** | ✅ |
| `seshat_remember` | Armazena informação em memória persistente | ✅ |
| `seshat_recall` | Recupera memórias de sessões anteriores | ✅ |
| `seshat_compress` | Comprime contexto (mantém estrutura, remove detalhes) | ✅ |
| `seshat_optimized_context` | Busca + compressão em uma chamada | ✅ |
| `seshat_analytics` | Métricas de uso, cache e performance | ✅ |

---

## 🔤 TOON — Token-Oriented Object Notation

Todas as respostas MCP usam **TOON** por padrão — um formato compacto projetado para LLMs que reduz ~70% dos tokens vs JSON:

**JSON (verbose):**
```json
{
  "results": [
    { "id": "proj:file.ts:0", "score": 0.95, "filePath": "src/file.ts", "preview": "export class Foo" }
  ]
}
```

**TOON (compacto):**
```
results[1]{id,score,filePath,preview}:
  "proj:file.ts:0",0.95,"src/file.ts","export class Foo"
```

### Controle do formato

```typescript
// MCP tool — format parameter
seshat_search({ query: "...", projectId: "...", format: "toon" })  // default
seshat_search({ query: "...", projectId: "...", format: "json" })  // verboso
```

```bash
# API REST
curl -X POST http://localhost:3344/api/v1/search/project \
  -d '{"query": "authentication", "projectId": "my-project", "format": "toon"}'
```

---

## 🌐 Busca Bilíngue PT→EN (Novo)

Queries em português agora têm **fallback automático para inglês** quando o score da busca primária fica abaixo do threshold `0.72`:

```
Query PT → Busca primária
    ↓ bestScore < 0.72?
   SIM → Ollama traduz PT→EN (timeout 3s)
    ↓ tradução OK?
   SIM → Busca EN → retorna melhor conjunto
    NÃO → usa resultado PT (falha silenciosa)
```

### Resultado com translationInfo

```json
{
  "translationInfo": {
    "triggered": true,
    "originalQuery": "reinicio automatico processo",
    "translatedQuery": "automatic process restart",
    "originalBestScore": 0.61,
    "translatedBestScore": 0.96
  }
}
```

### Controle

```typescript
// Ativar/desativar por chamada
seshat_search({ query: "...", projectId: "...", autoTranslate: true })   // default
seshat_search({ query: "...", projectId: "...", autoTranslate: false })  // desativado
```

---

## 🔄 Watchdog de Auto-Reinício (Windows)

No Windows, a API é gerenciada por um **watchdog PowerShell** que reinicia automaticamente em caso de crash:

```
start-seshat.ps1
    └→ watchdog-seshat.ps1 (background, oculto)
           └→ bun src/index.ts (API)
           └→ health check a cada 10s
                  ↓ falha?
                 SIM → reinicia (máx 10x, cooldown 5s)
```

```bash
# Iniciar (com watchdog integrado)
powershell -File start-seshat.ps1

# Parar tudo
powershell -File stop-seshat.ps1

# Logs
cat watchdog.log
cat startup.err.log
```

---

## 🏗️ Arquitetura

```
seshat/
├── apps/
│   ├── mcp-client/          # Servidor MCP (stdio)
│   ├── tools-api/           # REST API (porta 3344)
│   └── opencode-plugin/     # Plugin OpenCode
├── packages/
│   ├── core/
│   │   ├── controllers/
│   │   │   └── search-controller.ts   # Orchestrator + fallback bilíngue
│   │   ├── services/
│   │   │   ├── search/
│   │   │   │   ├── contextual-search-rlm.ts  # Hybrid RRF search
│   │   │   │   └── query-translator.ts       # [NOVO] Tradução PT→EN
│   │   │   ├── embeddings/                   # Ollama / Mistral / OpenAI
│   │   │   └── compression/                  # Compressão semântica
│   │   └── tools/                            # MCP tools (TOON integrado)
│   └── shared/              # Tipos e utilitários
├── watchdog-seshat.ps1       # [NOVO] Auto-reinício Windows
└── docs/
    ├── BILINGUAL_SEARCH.md   # Busca bilíngue PT→EN
    ├── WATCHDOG.md           # Watchdog de auto-reinício
    ├── MONITOR_DASHBOARD.md  # Dashboard de monitoramento
    └── MCP_TEST_VALIDATION.md # Relatório de validação
```

### Pipeline de Busca

```
Query (PT ou EN)
    ↓
ContextualSearchRLM
    ├── VectorSearch (embeddings Ollama bge-m3:latest)
    └── FTS5 KeywordSearch (SQLite)
           ↓
     RRF Ranking (fusão híbrida)
           ↓
     bestScore < 0.72? → QueryTranslator → segunda busca EN
           ↓
     filterByPatterns (glob include/exclude)
           ↓
     encode(results) → TOON format
```

---

## ⚙️ Configuração

Config: `~/.config/seshat/config.json` (criado automaticamente)

### Providers de Embedding

| Provider | Modelo | Custo | Qualidade |
|---|---|---|---|
| **Ollama** (default) | `bge-m3:latest`, `nomic-embed-text` | Gratuito | ⭐⭐⭐⭐ |
| **Mistral** | `mistral-embed`, `codestral-embed` | $$ | ⭐⭐⭐⭐⭐ |
| **OpenAI** | `text-embedding-3-small` | $$ | ⭐⭐⭐⭐⭐ |

```bash
npx seshat-config init                          # Ollama (padrão)
npx seshat-config init --mistral your-api-key   # Mistral
npx seshat-config init --openai your-api-key    # OpenAI
```

---

## 🧪 Testes

```bash
# Todos os testes
bun test

# Suite específica
bun test packages/core/src/__tests__/search-controller.test.ts
bun test packages/core/src/__tests__/memory-service.test.ts
bun test packages/core/src/__tests__/graph-store.test.ts
bun test packages/core/src/__tests__/checkpoint.test.ts
bun test packages/core/src/__tests__/context-controller.test.ts
bun test packages/core/src/__tests__/redundancy-clustering.test.ts
bun test packages/core/src/__tests__/relation-extractor.test.ts
```

### Cobertura dos Testes

| Arquivo de Teste | O que Cobre |
|---|---|
| `search-controller.test.ts` | Preview generation, glob filtering, singleton, **fallback bilíngue** |
| `memory-service.test.ts` | CRUD de memórias, busca semântica de memórias |
| `graph-store.test.ts` | Grafo de relações entre entidades |
| `checkpoint.test.ts` | Checkpointing de tarefas longas |
| `context-controller.test.ts` | Recuperação de contexto otimizado |
| `redundancy-clustering.test.ts` | Deduplicação semântica de resultados |
| `relation-extractor.test.ts` | Extração de relações entre código |

### Validação MCP (Integração)

```bash
# Via API REST (sem MCP)
curl -X POST http://localhost:3344/api/v1/project/index \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "D:/workspace/seshat/seshat-main", "projectId": "seshat-main"}'

# Busca em português (testa fallback PT→EN)
curl -X POST http://localhost:3344/api/v1/search/project \
  -H "Content-Type: application/json" \
  -d '{
    "query": "monitoramento de saude da api reinicio automatico",
    "projectId": "seshat-main",
    "autoTranslate": true,
    "format": "json"
  }'

# Verificar translationInfo na resposta
# translationInfo.triggered === true → fallback acionado
# translationInfo.triggered === false → score > 0.72, sem fallback
```

**Resultado esperado de validação interna:**

| Métrica | Resultado |
|---|---|
| Arquivos indexados | 134 |
| Chunks gerados | 590 |
| Tempo de indexação | 1.37s |
| Score busca PT (sem fallback) | 0.947 |
| Score busca EN (direto) | 0.968 |
| Testes unitários | 10 / 10 ✅ |

### 🏆 Testes em Mundo Real (Windows/Local)

Durante a fase de testes e estabilização de arquitetura, o motor **Seshat** rodando via *Bun*, SQLite e *Local Ollama (bge-m3)* no ambiente nativo Windows provou os seguintes resultados auditados:

| Categoria | Tempo/Status | O que Comprova |
|---|---|---|
| **Inicialização Total (Watchdog)** | Rápida (< 3seg) | A API `seshat-tools-api` e o Watchdog de Background escalonam no Windows sem conflitos ou travamentos em portas. |
| **Latência Média da API** | **14 ms** | Tempo recorde de resposta e tráfego interprocessos (sem overhead perceptível). |
| **Vetorização do Repositório (`seshat_index`)** | **~14.2 segundos** | O sistema foi capaz de varrer, gerar embeddings locais e indexar **139 arquivos (639 chunks)** do zero neste ínterim, mantendo o VS Code leve. |
| **RRF Ranking (Hybrid Search)** | **Recuperação Imediata** | Na busca por conceitos (*"como o watchdog cuida do reinicio"*), o modelo cruzou vetores (`bge-m3`) com busca FTS5 baseada em palavras, retornando *precisão impecável* e score altíssimo na documentação principal. |

---

## 📡 REST API

Swagger interativo: `http://localhost:3344/swagger`

```bash
# Indexar projeto
POST /api/v1/project/index
{ "projectPath": "...", "projectId": "..." }

# Busca com fallback bilíngue
POST /api/v1/search/project
{ "query": "...", "projectId": "...", "autoTranslate": true, "format": "toon" }

# Memória
POST /api/v1/memory/store
GET  /api/v1/memory/search?q=...

# Compressão
POST /api/v1/context/compress
{ "content": "...", "strategy": "code_structure" }

# Analytics
GET /api/v1/analytics/summary
```

---

## 📜 Scripts

| Comando | Descrição |
|---|---|
| `bun run build` | Build todos os pacotes |
| `bun run dev` | Desenvolvimento (todos os apps) |
| `bun run dev:api` | REST API com hot reload |
| `bun run dev:mcp` | Servidor MCP com watch |
| `bun run start:api` | Inicia REST API |
| `bun run start:mcp` | Inicia servidor MCP |
| `bun run test` | Roda todos os testes |
| `bun run lint` | Lint do código |
| `bun run type-check` | Verificação de tipos |
| `powershell -File start-seshat.ps1` | Inicia API + Watchdog (Windows) |
| `powershell -File stop-seshat.ps1` | Para todos os serviços (Windows) |

---

## 📚 Documentação

| Documento | Conteúdo |
|---|---|
| [BILINGUAL_SEARCH.md](./docs/BILINGUAL_SEARCH.md) | Busca bilíngue PT→EN — como funciona, threshold, translationInfo |
| [WATCHDOG.md](./docs/WATCHDOG.md) | Watchdog de auto-reinício — logs, parâmetros, fluxo |
| [MONITOR_DASHBOARD.md](./docs/MONITOR_DASHBOARD.md) | Dashboard de monitoramento (hardware, logs, modelos) |
| [MCP_TEST_VALIDATION.md](./docs/MCP_TEST_VALIDATION.md) | Relatório completo de validação do MCP |

---

## 🙏 Créditos

- **[seshat original](https://github.com/)** — engine base de busca semântica e memória (MIT © 2025 opencode)
- **[@toon-format/toon](https://github.com/johannschopplich/toon)** — serialização eficiente para LLMs (MIT © Johann Schopplich)
- **[Ollama](https://ollama.com)** — runtime local para modelos de linguagem e embeddings
- **[Elysia](https://elysiajs.com)** — framework HTTP para Bun
- **[Bun](https://bun.sh)** — runtime JavaScript ultra-rápido

---

## 📄 Licença

MIT — veja [LICENSE](./LICENSE).

Este projeto utiliza componentes de terceiros licenciados sob MIT.
Veja [LICENSES.md](./LICENSES.md) para os avisos completos.
