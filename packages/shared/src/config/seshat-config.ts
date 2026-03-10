export interface SeshatConfig {
  embedding: {
    provider: "ollama" | "mistral" | "openai" | "google" | "cohere";
    model: string;
    baseURL?: string;
    apiKey?: string;
    dimensions?: number;
  };
  compression: {
    enabled: boolean;
    strategy: "code_structure" | "conversation_summary" | "semantic_dedup" | "hierarchical";
    targetRatio: number;
    llm?: {
      provider: "ollama" | "mistral" | "openai";
      model: string;
      baseURL?: string;
      apiKey?: string;
    };
  };
  cache: {
    enabled: boolean;
    l1MaxSizeMB: number;
    l2MaxSizeMB: number;
    defaultTTLSeconds: number;
  };
  dataDir: string;
  logging: {
    level: "debug" | "info" | "warn" | "error";
    enableMetrics: boolean;
  };
}

export const defaultSeshatConfig: SeshatConfig = {
  embedding: {
    provider: "ollama",
    model: "nomic-embed-text:latest",
    baseURL: "http://localhost:11434",
    dimensions: 768,
  },
  compression: {
    enabled: true,
    strategy: "code_structure",
    targetRatio: 0.7,
  },
  cache: {
    enabled: true,
    l1MaxSizeMB: 100,
    l2MaxSizeMB: 500,
    defaultTTLSeconds: 3600,
  },
  dataDir: "~/.rlm",
  logging: {
    level: "info",
    enableMetrics: false,
  },
};

export const configExamples = {
  ollama: {
    embedding: {
      provider: "ollama" as const,
      model: "nomic-embed-text:latest",
      baseURL: "http://localhost:11434",
    },
  },
  mistral: {
    embedding: {
      provider: "mistral" as const,
      model: "mistral-embed",
      apiKey: "YOUR_MISTRAL_API_KEY",
    },
  },
  openai: {
    embedding: {
      provider: "openai" as const,
      model: "text-embedding-3-small",
      apiKey: "YOUR_OPENAI_API_KEY",
    },
  },
};
