# seshat — Watchdog de Auto-Reinício

> **Implementado em:** 2026-03-05 | **Status:** ✅ Ativo

## Problema

A API seshat caía silenciosamente devido a um bug do `@elysiajs/stream@1.1.0` com Bun v1.3.5:

```
TypeError: undefined is not an object (evaluating 'controller.close')
    at cancel (@elysiajs/stream/dist/index.mjs:23:13)
```

O crash ocorria quando uma conexão SSE era encerrada antes de o controller ser inicializado (condição de corrida).

---

## Solução: Watchdog em Background

Um processo PowerShell separado (`watchdog-seshat.ps1`) monitora a API continuamente:

```
start-seshat.ps1
    └→ lança watchdog-seshat.ps1 (background, oculto)
           └→ Start-Api (bun src/index.ts)
           └→ loop: Test-ApiHealth a cada 10s
                  ↓ falha 2x consecutivas?
                 SIM → Stop-Process + reinicia (cooldown 5s)
                  ↓ >10 reinícios?
                 SIM → watchdog encerra (evita loop infinito)
```

---

## Arquivos

| Arquivo | Função |
|---|---|
| [`watchdog-seshat.ps1`](../watchdog-seshat.ps1) | **[NOVO]** Loop de monitoramento e reinício |
| [`start-seshat.ps1`](../start-seshat.ps1) | Atualizado para lançar o watchdog em vez da API diretamente |

---

## Parâmetros do Watchdog

| Parâmetro | Default | Descrição |
|---|---|---|
| `MaxRestarts` | 10 | Máximo de reinícios antes de desistir |
| `CooldownSec` | 5 | Espera entre tentativas (s) |
| `HealthInterval` | 10 | Intervalo do health check (s) |

---

## Logs

- **API stdout/stderr:** `startup.log` / `startup.err.log`
- **Watchdog:** `watchdog.log`

Exemplo de entrada no `watchdog.log`:
```
[2026-03-05T06:21:00Z] [INFO] Watchdog iniciado. MaxRestarts=10, CooldownSec=5
[2026-03-05T06:21:00Z] [INFO] Iniciando API... (tentativa 1)
[2026-03-05T06:21:08Z] [INFO] API pronta (PID=12345). Monitorando...
[2026-03-05T06:32:44Z] [WARN] Health check falhou. Verificando processo...
[2026-03-05T06:32:49Z] [ERROR] API nao responde. Forcando reinicio...
[2026-03-05T06:32:54Z] [INFO] Iniciando API... (tentativa 2)
[2026-03-05T06:33:02Z] [INFO] API pronta (PID=13210). Monitorando...
```

---

## Referências

- [`watchdog-seshat.ps1`](../watchdog-seshat.ps1)
- [`start-seshat.ps1`](../start-seshat.ps1)
- [MCP Test Validation](./MCP_TEST_VALIDATION.md)
