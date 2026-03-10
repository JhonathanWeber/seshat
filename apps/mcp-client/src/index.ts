#!/usr/bin/env node
/**
 * seshat MCP Client
 *
 * Cliente MCP que se conecta ao OpenCode via stdio
 * e faz proxy das tool calls para a Tools API via HTTP.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ApiClient } from "./api-client.js";
import { TOOL_DEFINITIONS, getToolDefinition } from "./tool-definitions.js";
import { configExists, initConfig } from "@seshat/shared/config";

// Auto-configure on first run
if (!configExists()) {
  initConfig();
  console.error(`
[seshat] Initialized with default configuration
[seshat] Config: ~/.config/seshat/config.json
[seshat] Provider: Ollama (local, free)
[seshat] To change: npx seshat-config use mistral --api-key YOUR_KEY
`);
}

class McpProxyServer {
  private server: Server;
  private transport: StdioServerTransport;
  private apiClient: ApiClient;

  constructor() {
    this.server = new Server(
      {
        name: "seshat",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.transport = new StdioServerTransport();
    this.apiClient = new ApiClient();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List tools - return all tool definitions
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: TOOL_DEFINITIONS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // Handle tool calls - proxy to Tools API
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const toolDef = getToolDefinition(name);
        if (!toolDef) {
          throw new Error(`Unknown tool: ${name}`);
        }

        // Proxy to API
        let response;
        if (toolDef.apiMethod === "GET") {
          // For GET requests, construct URL with path parameters
          let endpoint = toolDef.apiEndpoint;
          const params = args as Record<string, any>;

          // Replace :param with actual values
          Object.keys(params).forEach((key) => {
            endpoint = endpoint.replace(`:${key}`, encodeURIComponent(params[key]));
          });

          response = await this.apiClient.get(endpoint);
        } else {
          // POST request with body
          response = await this.apiClient.post(toolDef.apiEndpoint, args);
        }

        // Format response for MCP
        const responseData = response as any;

        // If response has TOON format string in data, return directly
        if (responseData?.success && typeof responseData?.data === "string") {
          return {
            content: [
              {
                type: "text" as const,
                text: responseData.data,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    });
  }

  async start(): Promise<void> {
    // Check API health before starting
    const healthy = await this.apiClient.healthCheck();
    if (!healthy) {
      console.error(
        "[seshat-mcp] Warning: Tools API is not reachable. Requests will fail until API is available.",
      );
    }

    await this.server.connect(this.transport);
    console.error("[seshat-mcp] MCP Client running on stdio");
    console.error(
      `[seshat-mcp] Proxying to: ${process.env.SESHAT_API_URL || "http://localhost:3344"}`,
    );
  }

  async close(): Promise<void> {
    await this.server.close();
  }
}

// Main
const client = new McpProxyServer();

client.start().catch((error) => {
  console.error("Failed to start MCP client:", error);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await client.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await client.close();
  process.exit(0);
});
