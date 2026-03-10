/**
 * Search Controller
 *
 * Orchestration layer for project search operations.
 * Extracts preview generation, glob filtering, auto-reindex,
 * and bilingual fallback (PT→EN) coordination.
 */

import { logger } from "@seshat/shared";
import { ContextualSearchRLM } from "../services/search/contextual-search-rlm.js";
import { QueryTranslator } from "../services/search/query-translator.js";
import { minimatch } from "minimatch";

/** Score mínimo do top-1 resultado para NÃO acionar o fallback de tradução */
const FALLBACK_THRESHOLD = 0.72;

// ── Types ────────────────────────────────────────────────────

export interface ProjectSearchInput {
  query: string;
  projectId: string;
  projectPath?: string;
  maxResults?: number;
  minScore?: number;
  responseMode?: "summary" | "full";
  autoReindex?: boolean;
  autoTranslate?: boolean;
  include?: string[];
  exclude?: string[];
  explainScores?: boolean;
}

export interface TranslationInfo {
  triggered: boolean;
  originalQuery: string;
  translatedQuery?: string;
  originalBestScore: number;
  translatedBestScore?: number;
}

export interface ProjectSearchResult {
  query: string;
  projectId: string;
  responseMode: string;
  tokenSavings: string;
  indexStatus: any;
  recommendations: string[];
  translationInfo: TranslationInfo;
  filters: {
    applied: boolean;
    include: string[];
    exclude: string[];
    totalResults: number;
    filteredResults: number;
  };
  results: FormattedResult[];
}

interface FormattedResult {
  id: string;
  score: number;
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  language?: string;
  preview: string;
  explanation?: string;
  content?: string;
}

// ── Controller ───────────────────────────────────────────────

export class SearchController {
  private static instance: SearchController | null = null;
  private contextualSearch: ContextualSearchRLM;
  private translator: QueryTranslator;

  private constructor() {
    this.contextualSearch = new ContextualSearchRLM();
    this.translator = QueryTranslator.getInstance();
  }

  static getInstance(): SearchController {
    if (!SearchController.instance) {
      SearchController.instance = new SearchController();
    }
    return SearchController.instance;
  }

  /** Expose the underlying search engine for direct use by ContextController. */
  getSearchEngine(): ContextualSearchRLM {
    return this.contextualSearch;
  }

  // ── Main search use case ───────────────────────────────────

  async searchProject(input: ProjectSearchInput): Promise<ProjectSearchResult> {
    const {
      query,
      projectId,
      projectPath,
      maxResults = 10,
      minScore = 0.3,
      responseMode = "summary",
      autoReindex = false,
      autoTranslate = true,
      include,
      exclude,
      explainScores = false,
    } = input;

    const startTime = Date.now();

    logger.info("Starting project search", {
      query,
      projectId,
      maxResults,
      autoReindex,
      autoTranslate,
      explainScores,
    });

    // Auto-reindex if requested
    let reindexInfo = null;
    if (autoReindex && projectPath) {
      reindexInfo = await this.handleAutoReindex(projectId, projectPath);
    }

    // Execute primary search
    const results = await this.contextualSearch.search(query, projectId, {
      maxResults,
      minScore,
      explainScores,
    });

    const originalBestScore = results.length > 0 ? results[0].score : 0;

    logger.info("Project search completed", {
      projectId,
      resultCount: results.length,
      bestScore: originalBestScore,
      totalLatencyMs: Date.now() - startTime,
    });

    // ── Bilingual fallback (PT→EN) ────────────────────────────
    let translationInfo: TranslationInfo = {
      triggered: false,
      originalQuery: query,
      originalBestScore,
    };

    let finalResults = results;

    if (autoTranslate && originalBestScore < FALLBACK_THRESHOLD) {
      const translatedQuery = await this.translator.translate(query);

      if (translatedQuery && translatedQuery.toLowerCase() !== query.toLowerCase()) {
        logger.info("Bilingual fallback triggered", {
          originalQuery: query,
          translatedQuery,
          originalBestScore,
          threshold: FALLBACK_THRESHOLD,
        });

        const translatedResults = await this.contextualSearch.search(
          translatedQuery,
          projectId,
          { maxResults, minScore, explainScores },
        );

        const translatedBestScore =
          translatedResults.length > 0 ? translatedResults[0].score : 0;

        translationInfo = {
          triggered: true,
          originalQuery: query,
          translatedQuery,
          originalBestScore,
          translatedBestScore,
        };

        // Usar resultados traduzidos se tiverem score médio maior
        const avgOriginal = this.avgScore(results);
        const avgTranslated = this.avgScore(translatedResults);

        if (avgTranslated > avgOriginal) {
          finalResults = translatedResults;
          logger.info("Bilingual fallback accepted translated results", {
            avgOriginal: avgOriginal.toFixed(3),
            avgTranslated: avgTranslated.toFixed(3),
          });
        } else {
          logger.info("Bilingual fallback kept original results", {
            avgOriginal: avgOriginal.toFixed(3),
            avgTranslated: avgTranslated.toFixed(3),
          });
        }
      }
    }
    // ─────────────────────────────────────────────────────────

    // Apply glob filters
    const filteredResults = this.filterByPatterns(finalResults, include, exclude);

    if (filteredResults.length < finalResults.length) {
      logger.info("Results filtered by patterns", {
        before: finalResults.length,
        after: filteredResults.length,
        include,
        exclude,
      });
    }

    // Format results
    const formattedResults = filteredResults.map((r) => {
      const base: FormattedResult = {
        id: r.id,
        score: r.score,
        filePath: r.metadata?.filePath,
        lineStart: r.metadata?.lineStart,
        lineEnd: r.metadata?.lineEnd,
        language: r.metadata?.language,
        preview: this.generatePreview(r),
        ...(r.explanation && { explanation: r.explanation }),
      };

      if (responseMode === "full") {
        base.content = r.content;
      }

      return base;
    });

    return {
      query,
      projectId,
      responseMode,
      tokenSavings: responseMode === "summary" ? "~70% vs full mode" : "none",
      indexStatus: reindexInfo || { wasStale: false, reindexed: false },
      recommendations:
        (reindexInfo as any)?.deferred
          ? [
            "Indexing deferred to keep this search responsive",
            "Run seshat_index(projectPath, projectId) and poll seshat_get_index_status(jobId)",
          ]
          : [],
      translationInfo,
      filters: {
        applied:
          (include && include.length > 0) ||
          (exclude && exclude.length > 0) ||
          false,
        include: include || [],
        exclude: exclude || [],
        totalResults: finalResults.length,
        filteredResults: filteredResults.length,
      },
      results: formattedResults,
    };
  }

  // ── Helpers ────────────────────────────────────────────────

  private avgScore(results: any[]): number {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.score, 0) / results.length;
  }

  private async handleAutoReindex(
    projectId: string,
    projectPath: string,
  ): Promise<any> {
    const freshnessStart = Date.now();
    const info = await this.contextualSearch.ensureFreshIndex(
      projectId,
      projectPath,
      { allowFullReindex: false, maxSyncFiles: 50 },
    );

    logger.info("Index freshness check completed", {
      projectId,
      latencyMs: Date.now() - freshnessStart,
      wasStale: info.wasStale,
      reindexed: info.reindexed,
      reason: info.reason,
      deferred: (info as any).deferred || false,
      filesPending: (info as any).filesPending || 0,
    });

    return info;
  }

  generatePreview(result: any): string {
    if (result.metadata?.context?.preview) {
      return result.metadata.context.preview;
    }

    const content = result.content || "";
    const lines = content
      .split("\n")
      .filter((l: string) => l.trim().length > 0);

    if (lines.length === 0) return "(empty)";

    const significantLine =
      lines.find((l: string) => {
        const t = l.trim();
        return (
          !t.startsWith("import ") &&
          !t.startsWith("//") &&
          !t.startsWith("/*") &&
          !t.startsWith("*")
        );
      }) || lines[0];

    const preview = significantLine.trim();
    return preview.length > 100
      ? preview.substring(0, 97) + "..."
      : preview;
  }

  filterByPatterns(
    results: any[],
    include?: string[],
    exclude?: string[],
  ): any[] {
    return results.filter((result) => {
      const filePath = result.metadata?.filePath || "";
      if (!filePath) return true;

      if (exclude && exclude.length > 0) {
        for (const pattern of exclude) {
          if (minimatch(filePath, pattern)) return false;
        }
      }

      if (include && include.length > 0) {
        for (const pattern of include) {
          if (minimatch(filePath, pattern)) return true;
        }
        return false;
      }

      return true;
    });
  }
}
