#!/usr/bin/env bun
/**
 * seshat Tools API
 *
 * API REST com ElysiaJS que expõe todas as ferramentas do seshat.
 * Separada do protocolo MCP para permitir múltiplos clientes.
 *
 * Local-First: Funciona 100% offline com Ollama + SQLite.
 */

import "@seshat/shared/config";

import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { searchRoutes } from "./routes/search.js";
import { memoryRoutes } from "./routes/memory.js";
import { projectRoutes } from "./routes/project.js";
import { contextRoutes } from "./routes/context.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { systemRoutes } from "./routes/system.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { getHealthChecker } from "@seshat/core";

const PORT = process.env.SESHAT_API_PORT || 3344;

export const app = new Elysia({ adapter: node() })
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: "seshat Tools API",
          version: "1.0.0",
          description:
            "API de ferramentas de contexto semântico, memória e busca de código. Consumida pelo MCP Client e outros clientes.",
        },
        tags: [
          { name: "search", description: "Busca semântica e por keywords" },
          { name: "memory", description: "Armazenamento e busca de memórias" },
          { name: "project", description: "Indexação de projetos" },
          {
            name: "context",
            description: "Compressão e otimização de contexto",
          },
          { name: "analytics", description: "Métricas e analytics" },
          { name: "system", description: "Sistema, health checks e métricas" },
        ],
      },
    }),
  )
  .use(errorHandler)
  .use(authMiddleware)
  .use(searchRoutes)
  .use(memoryRoutes)
  .use(projectRoutes)
  .use(contextRoutes)
  .use(analyticsRoutes)
  .use(systemRoutes)
  .get("/health", () => {
    const memUsage = process.memoryUsage();
    return {
      status: "ok",
      service: "seshat-tools-api",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      system: {
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024)
        },
        uptime: Math.round(process.uptime()),
        model: process.env.OLLAMA_EMBEDDING_MODEL || "bge-m3:latest"
      }
    };
  })
  .listen(PORT);

console.log(`seshat Tools API running at http://localhost:${PORT}`);
console.log(`Swagger docs at http://localhost:${PORT}/swagger`);

// Run local health check on startup (non-blocking)
(async () => {
  try {
    const checker = getHealthChecker();
    const report = await checker.checkAll();

    if (report.status === "healthy") {
      console.log(`Local-first health: ALL SERVICES HEALTHY`);
    } else {
      console.log(`Local-first health: ${report.status.toUpperCase()}`);
      for (const rec of report.recommendations) {
        console.log(`  -> ${rec}`);
      }
    }
  } catch (error) {
    console.error(
      "Health check failed:",
      error instanceof Error ? error.message : error,
    );
  }
})();

export type App = typeof app;
