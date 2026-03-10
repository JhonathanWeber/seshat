/**
 * System Routes
 *
 * GET /api/v1/system/info         - Informações do sistema
 * GET /api/v1/system/status       - Status dos serviços
 * GET /api/v1/system/metrics      - Métricas gerais
 * GET /api/v1/system/health/local - Health check local-first (Ollama, DBs, etc.)
 * GET /api/v1/system/ollama       - Status do Ollama e modelos disponíveis
 */

import { Elysia, t } from "elysia";
import { Stream } from "@elysiajs/stream";
import { config } from "@seshat/shared";
import { getHealthChecker } from "@seshat/core";
import path from "path";
import fs from "fs";
import os from "os";
import { EventEmitter } from "events";

// Global log emitter for the dashboard SSE
export const logEmitter = new EventEmitter();
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

let isLogging = false;

console.log = function (...args) {
  if (isLogging) return originalLog.apply(console, args);
  isLogging = true;
  try {
    logEmitter.emit('log', { level: 'info', message: args.join(' ') });
    originalLog.apply(console, args);
  } finally {
    isLogging = false;
  }
};
console.info = function (...args) {
  if (isLogging) return originalInfo.apply(console, args);
  isLogging = true;
  try {
    logEmitter.emit('log', { level: 'info', message: args.join(' ') });
    originalInfo.apply(console, args);
  } finally {
    isLogging = false;
  }
};
console.warn = function (...args) {
  if (isLogging) return originalWarn.apply(console, args);
  isLogging = true;
  try {
    logEmitter.emit('log', { level: 'warn', message: args.join(' ') });
    originalWarn.apply(console, args);
  } finally {
    isLogging = false;
  }
};
console.error = function (...args) {
  if (isLogging) return originalError.apply(console, args);
  isLogging = true;
  try {
    logEmitter.emit('log', { level: 'error', message: args.join(' ') });
    originalError.apply(console, args);
  } finally {
    isLogging = false;
  }
};

function getDatabaseSizes() {
  const dataDir = config.get("dataDir");
  const databases = [
    "memories.db",
    "vector-store.db",
    "search-cache.db",
    "search-analytics.db",
    "keyword-search.db",
    "embedding-cache.db",
  ];

  const sizes: Record<string, number> = {};
  let totalSize = 0;

  for (const db of databases) {
    const dbPath = path.join(dataDir, db);
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      sizes[db] = stats.size;
      totalSize += stats.size;
    } else {
      sizes[db] = 0;
    }
  }

  return { sizes, totalSize };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

export const systemRoutes = new Elysia({ prefix: "/api/v1/system" })
  .get(
    "/info",
    () => {
      const { sizes, totalSize } = getDatabaseSizes();

      return {
        version: "1.0.0",
        service: "seshat-tools-api",
        node: process.version,
        platform: os.platform(),
        arch: os.arch(),
        uptime: process.uptime(),
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          process: process.memoryUsage(),
        },
        dataDir: config.get("dataDir"),
        databases: {
          sizes: Object.fromEntries(
            Object.entries(sizes).map(([k, v]) => [k, formatBytes(v)])
          ),
          total: formatBytes(totalSize),
          totalBytes: totalSize,
        },
        timestamp: new Date().toISOString(),
      };
    },
    {
      detail: {
        tags: ["system"],
        summary: "Get system information",
        description: "Get detailed system and environment information",
      },
    },
  )
  .get(
    "/status",
    () => {
      const dataDir = config.get("dataDir");

      // Check if critical databases exist
      const services = {
        memories: fs.existsSync(path.join(dataDir, "memories.db")),
        vectorStore: fs.existsSync(path.join(dataDir, "vector-store.db")),
        searchCache: fs.existsSync(path.join(dataDir, "search-cache.db")),
        analytics: fs.existsSync(path.join(dataDir, "search-analytics.db")),
        keywordSearch: fs.existsSync(path.join(dataDir, "keyword-search.db")),
        embeddingCache: fs.existsSync(path.join(dataDir, "embedding-cache.db")),
      };

      const allHealthy = Object.values(services).every((s) => s);

      return {
        status: allHealthy ? "healthy" : "degraded",
        services,
        timestamp: new Date().toISOString(),
      };
    },
    {
      detail: {
        tags: ["system"],
        summary: "Get system status",
        description: "Check health status of all services",
      },
    },
  )
  .get(
    "/metrics",
    () => {
      const dataDir = config.get("dataDir");
      const metricsPath = path.join(process.cwd(), "data", "metrics.json");

      let metrics = {};
      if (fs.existsSync(metricsPath)) {
        try {
          const data = fs.readFileSync(metricsPath, "utf-8");
          metrics = JSON.parse(data);
        } catch (error) {
          // Metrics file might be empty or corrupted
        }
      }

      const { totalSize } = getDatabaseSizes();

      return {
        ...metrics,
        system: {
          dataSize: formatBytes(totalSize),
          dataSizeBytes: totalSize,
          uptime: process.uptime(),
          memory: {
            heapUsed: formatBytes(process.memoryUsage().heapUsed),
            heapTotal: formatBytes(process.memoryUsage().heapTotal),
            rss: formatBytes(process.memoryUsage().rss),
          },
        },
        timestamp: new Date().toISOString(),
      };
    },
    {
      detail: {
        tags: ["system"],
        summary: "Get system metrics",
        description: "Get aggregated metrics and performance data",
      },
    },
  )
  .get(
    "/health/local",
    async () => {
      const checker = getHealthChecker();
      return await checker.checkAll();
    },
    {
      detail: {
        tags: ["system"],
        summary: "Local-first health check",
        description:
          "Comprehensive health check of all local services: Ollama, SQLite databases, data directory. " +
          "Returns status, latency, and recommendations for local-first operation.",
      },
    },
  )
  .get(
    "/ollama",
    async () => {
      const checker = getHealthChecker();
      const ollamaStatus = await checker.checkOllama();
      const models = await checker.getOllamaModels();

      return {
        ...ollamaStatus,
        models,
        configuredModel:
          process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text:latest",
        baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      };
    },
    {
      detail: {
        tags: ["system"],
        summary: "Ollama status",
        description:
          "Check Ollama availability, list installed models, and verify embedding model configuration.",
      },
    },
  )
  .post(
    "/ollama/model",
    ({ body }) => {
      if (!body?.model) throw new Error("Model name is required");

      process.env.OLLAMA_EMBEDDING_MODEL = body.model;

      try {
        // Attempt to dynamically update the shared loaded config
        const { embeddingProviders } = require("@seshat/core/dist/services/embeddings/config.js");
        if (embeddingProviders && embeddingProviders.ollama) {
          embeddingProviders.ollama.model = body.model;
        }
      } catch (e) { }

      return {
        success: true,
        model: body.model,
        message: `Model switched to ${body.model}`
      };
    },
    {
      body: t.Object({
        model: t.String({
          description: "Ollama model name (e.g. nomic-embed-text:latest)",
        }),
      }),
      detail: {
        tags: ["system"],
        summary: "Switch Ollama Model",
        description: "Switch the active local embedding model at runtime.",
      },
    }
  )
  .get(
    "/logs/stream",
    ({ set }) => {
      set.headers["Content-Type"] = "text/event-stream";
      set.headers["Cache-Control"] = "no-cache";
      set.headers["Connection"] = "keep-alive";

      return new Stream((stream: any) => {
        const listener = (data: any) => {
          try {
            stream.send(data);
          } catch (e) {
            logEmitter.off("log", listener);
          }
        };
        logEmitter.on("log", listener);

        // Keep connection alive and detect disconnect
        const pingInterval = setInterval(() => {
          try {
            stream.send({ level: 'system', message: 'ping' });
          } catch (e) {
            logEmitter.off("log", listener);
            clearInterval(pingInterval);
          }
        }, 5000);

        stream.event = "message";
      });
    },
    {
      detail: {
        tags: ["system"],
        summary: "Stream backend logs",
        description: "SSE Endpoint to stream real-time logs to the dashboard.",
      },
    }
  );
