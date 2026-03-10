#!/usr/bin/env bun

import fs from "fs/promises";
import path from "path";

interface QueryCase {
  id: string;
  text: string;
  relevantFiles: string[];
}

interface CorpusEntry {
  _id: string;
  title: string;
  text: string;
}

function parseArgs(argv: string[]): { sourceRepo: string; outputDir: string } {
  const args = new Map<string, string>();
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args.set(key.slice(2), "true");
      continue;
    }
    args.set(key.slice(2), next);
    i += 1;
  }

  return {
    sourceRepo:
      args.get("sourceRepo") || "/home/joaov/projetos/Sicad-Backend",
    outputDir: args.get("outputDir") || "/tmp/beir/sicad-backend",
  };
}

async function walkFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const dir = stack.pop()!;
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === "dist" ||
          entry.name === ".git" ||
          entry.name === "coverage"
        ) {
          continue;
        }
        stack.push(full);
      } else {
        out.push(full);
      }
    }
  }

  return out;
}

function keepFile(file: string): boolean {
  const ext = path.extname(file).toLowerCase();
  return [".ts", ".tsx", ".js", ".json", ".md"].includes(ext);
}

function benchmarkQueries(): QueryCase[] {
  return [
    {
      id: "q_auth_jwt",
      text: "como funciona autenticacao jwt, sessao e middleware de auth",
      relevantFiles: [
        "src/services/auth/auth.service.ts",
        "src/routes/auth/auth.route.ts",
        "src/middleware/auth.ts",
        "src/lib/auth.ts",
      ],
    },
    {
      id: "q_calc_core",
      text: "onde esta a logica principal de calculo judicial e correcao monetaria",
      relevantFiles: [
        "src/services/calculation/calculation.service.ts",
        "src/services/calculation/calculation.monetary-correction.service.ts",
        "src/controllers/calculation/calculation.controller.ts",
      ],
    },
    {
      id: "q_pix",
      text: "geracao de pix qr code e rota de pix",
      relevantFiles: [
        "src/services/pix/pix-qr.service.ts",
        "src/controllers/pix/pix.controller.ts",
        "src/routes/pix/pix.route.ts",
      ],
    },
    {
      id: "q_abusive_interest",
      text: "calculo de juros abusivos e credit series",
      relevantFiles: [
        "src/services/abusive-interest/abusive-interest.service.ts",
        "src/controllers/abusive-interest/abusive-interest.controller.ts",
        "src/routes/abusive-interest/abusive-interest.route.ts",
      ],
    },
    {
      id: "q_metrics_ga4",
      text: "coleta e metricas ga4 analytics",
      relevantFiles: [
        "src/services/metrics/ga4-metrics.service.ts",
        "src/controllers/metrics/ga4-metrics.controller.ts",
        "src/routes/metrics/ga4-metrics.route.ts",
      ],
    },
    {
      id: "q_rate_limit",
      text: "rate limiting e protecao das rotas",
      relevantFiles: [
        "src/middleware/rate-limit.ts",
        "src/middleware/calculation-rate-limit.ts",
        "src/middleware/ga4-rate-limit.ts",
      ],
    },
    {
      id: "q_bacen",
      text: "integracao de indices bacen e endpoints de indices",
      relevantFiles: [
        "src/controllers/bacen/bacen.controller.ts",
        "src/routes/indexes/indexes.route.ts",
        "src/types/bacen.types.ts",
      ],
    },
    {
      id: "q_permissions",
      text: "roles permissoes e isolamento de organizacao",
      relevantFiles: [
        "src/lib/permissions.ts",
        "src/lib/auth-schemas.ts",
        "src/tests/auth/roles-permissions.test.ts",
      ],
    },
    {
      id: "q_feedback",
      text: "fluxo de feedback schema controller e rota",
      relevantFiles: [
        "src/schemas/feedback.schema.ts",
        "src/controllers/feedback/feedback.controller.ts",
        "src/routes/feedback/feedback.route.ts",
      ],
    },
    {
      id: "q_prisma",
      text: "conexao prisma e scripts de seed",
      relevantFiles: [
        "src/lib/prisma.ts",
        "prisma/seed.ts",
        "prisma/clean.ts",
      ],
    },
  ];
}

async function main(): Promise<void> {
  const { sourceRepo, outputDir } = parseArgs(process.argv);
  const absSource = path.resolve(sourceRepo);
  const absOutput = path.resolve(outputDir);

  const allFiles = await walkFiles(absSource);
  const files = allFiles.filter(keepFile);

  const corpus: CorpusEntry[] = [];
  for (const file of files) {
    const rel = path.relative(absSource, file).replaceAll(path.sep, "/");
    const text = await fs.readFile(file, "utf-8");
    corpus.push({
      _id: rel,
      title: path.basename(rel),
      text,
    });
  }

  const cases = benchmarkQueries();
  const corpusIds = new Set(corpus.map((c) => c._id));

  const missing: string[] = [];
  for (const c of cases) {
    for (const f of c.relevantFiles) {
      if (!corpusIds.has(f)) {
        missing.push(`${c.id}: ${f}`);
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing files in corpus for qrels:\n${missing.join("\n")}`);
  }

  await fs.rm(absOutput, { recursive: true, force: true });
  await fs.mkdir(path.join(absOutput, "qrels"), { recursive: true });

  const corpusJsonl = corpus.map((c) => JSON.stringify(c)).join("\n") + "\n";
  await fs.writeFile(path.join(absOutput, "corpus.jsonl"), corpusJsonl, "utf-8");

  const queriesJsonl =
    cases.map((c) => JSON.stringify({ _id: c.id, text: c.text })).join("\n") +
    "\n";
  await fs.writeFile(path.join(absOutput, "queries.jsonl"), queriesJsonl, "utf-8");

  const qrelsLines = ["query-id\tcorpus-id\tscore"];
  for (const c of cases) {
    for (const relFile of c.relevantFiles) {
      qrelsLines.push(`${c.id}\t${relFile}\t1`);
    }
  }
  await fs.writeFile(
    path.join(absOutput, "qrels", "test.tsv"),
    `${qrelsLines.join("\n")}\n`,
    "utf-8",
  );

  console.log("Sicad BEIR fixture created");
  console.log(`Source repo: ${absSource}`);
  console.log(`Output dir: ${absOutput}`);
  console.log(`Corpus docs: ${corpus.length}`);
  console.log(`Queries: ${cases.length}`);
  console.log(`Qrels rows: ${cases.reduce((acc, c) => acc + c.relevantFiles.length, 0)}`);
}

main().catch((error) => {
  console.error("Failed to create Sicad BEIR fixture:", error);
  process.exit(1);
});
