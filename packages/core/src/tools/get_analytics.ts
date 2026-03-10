/**
 * Get Analytics Tool
 *
 * Retrieves search analytics and performance metrics
 */

import { IToolHandler } from "@seshat/shared";
import { ToolResponse } from "@seshat/shared";
import { ContextualSearchRLM } from "../services/search/contextual-search-rlm.js";
import { logger } from "@seshat/shared";
import { encode as toTOON } from "@toon-format/toon";

interface GetAnalyticsParams {
  type: "summary" | "project" | "query" | "cache" | "recent";
  projectId?: string;
  query?: string;
  limit?: number;
  format?: "json" | "toon";
}

export class GetAnalyticsTool implements IToolHandler {
  name = "get_analytics";
  description =
    "Get search analytics and performance metrics (usage patterns, cache performance, etc)";
  inputSchema = {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["summary", "project", "query", "cache", "recent"],
        description:
          "Type of analytics: 'summary' (overall), 'project' (specific project), 'query' (specific query), 'cache' (cache performance), 'recent' (recent searches)",
      },
      projectId: {
        type: "string",
        description: "Project ID (required for type='project' or 'cache')",
      },
      query: {
        type: "string",
        description: "Search query (required for type='query')",
      },
      limit: {
        type: "number",
        description: "Limit for results (default: 10 for most, 50 for recent)",
        default: 10,
      },
    },
    required: ["type"],
  };

  private contextualSearch: ContextualSearchRLM;

  constructor() {
    this.contextualSearch = new ContextualSearchRLM();
  }

  async handle(params: unknown): Promise<ToolResponse> {
    const { type, projectId, query, limit = 10, format = "toon" } = params as GetAnalyticsParams;

    try {
      const analytics = this.contextualSearch.getAnalytics();

      logger.info("Getting analytics", { type, projectId, query });

      let data: any;

      switch (type) {
        case "summary":
          data = analytics.getSummary(limit);
          break;

        case "project":
          if (!projectId) {
            return {
              success: false,
              error: "projectId is required for type='project'",
            };
          }
          data = analytics.getProjectStats(projectId, limit);
          if (!data) {
            return {
              success: false,
              error: `No analytics found for project: ${projectId}`,
            };
          }
          break;

        case "query":
          if (!query) {
            return {
              success: false,
              error: "query is required for type='query'",
            };
          }
          data = analytics.getQueryStats(query, projectId);
          if (!data) {
            return {
              success: false,
              error: `No analytics found for query: ${query}`,
            };
          }
          break;

        case "cache":
          data = analytics.getCachePerformance(projectId);
          break;

        case "recent":
          const recentLimit = limit || 50;
          data = analytics.getRecentSearches(recentLimit, projectId);
          break;

        default:
          return {
            success: false,
            error: `Invalid analytics type: ${type}`,
          };
      }

      logger.info("Analytics retrieved", {
        type,
        dataSize: JSON.stringify(data).length,
      });

      const responseData = {
        type,
        ...(projectId && { projectId }),
        ...(query && { query }),
        result: data,
      };

      return {
        success: true,
        data: format === "toon" ? toTOON(responseData) : responseData,
      };
    } catch (error) {
      logger.error("Failed to get analytics", error as Error, {
        type,
        projectId,
        query,
      });

      return {
        success: false,
        error: `Failed to get analytics: ${(error as Error).message}`,
      };
    }
  }
}
