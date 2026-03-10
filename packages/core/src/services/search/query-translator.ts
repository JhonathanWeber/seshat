/**
 * Query Translator
 *
 * Detecta queries em português e as traduz para inglês via Ollama HTTP.
 * Usado pelo SearchController para fallback bilíngue automático.
 *
 * - Timeout de 3s para não bloquear buscas
 * - Falha silenciosa: retorna null se Ollama não responder
 * - Singleton para reutilizar a mesma instância
 */

import { logger } from "@seshat/shared";

// Stopwords e padrões que indicam texto em português
const PT_STOPWORDS = new Set([
    "como", "funciona", "qual", "quais", "onde", "quando", "porque", "para",
    "uma", "um", "não", "que", "com", "por", "são", "ser", "tem", "ter",
    "fazer", "busca", "pesquisa", "sistema", "serviço", "processo", "arquivo",
    "implementa", "retorna", "verifica", "inicializa", "executa", "cria",
]);

// Diacríticos PT: ã, ç, ê, õ, á, é, í, ó, ú etc.
const PT_DIACRITICS_REGEX = /[ãçêõáéíóúâàèìòùÃÇÊÕÁÉÍÓÚÂÀÈÌÒÙ]/;

const OLLAMA_URL = "http://localhost:11434/api/generate";
const TRANSLATE_MODEL = "llama3.2:latest"; // modelo local rápido
const TIMEOUT_MS = 3000;

export class QueryTranslator {
    private static instance: QueryTranslator | null = null;

    static getInstance(): QueryTranslator {
        if (!QueryTranslator.instance) {
            QueryTranslator.instance = new QueryTranslator();
        }
        return QueryTranslator.instance;
    }

    /**
     * Detecta se a query está em português.
     */
    isPortuguese(query: string): boolean {
        if (PT_DIACRITICS_REGEX.test(query)) return true;

        const words = query.toLowerCase().split(/\s+/);
        const ptMatches = words.filter((w) => PT_STOPWORDS.has(w)).length;
        return ptMatches >= 1 && words.length <= 8
            ? ptMatches >= 1
            : ptMatches >= 2;
    }

    /**
     * Traduz a query PT→EN via Ollama.
     * Retorna a query traduzida ou null em caso de falha/timeout.
     */
    async translate(query: string): Promise<string | null> {
        if (!this.isPortuguese(query)) {
            return null; // já é inglês, sem necessidade de tradução
        }

        const prompt =
            `Translate this search query from Portuguese to English. ` +
            `Return ONLY the translated query, nothing else, no explanation.\n` +
            `Query: "${query}"\n` +
            `Translation:`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

            const response = await fetch(OLLAMA_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: TRANSLATE_MODEL,
                    prompt,
                    stream: false,
                    options: { temperature: 0.1, num_predict: 60 },
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                logger.warn("QueryTranslator: Ollama returned non-OK status", {
                    status: response.status,
                });
                return null;
            }

            const json = (await response.json()) as { response?: string };
            const translated = json.response?.trim();

            if (!translated) return null;

            // Remove aspas extras que o LLM às vezes inclui
            const clean = translated.replace(/^["']|["']$/g, "").trim();

            logger.info("QueryTranslator: query translated", {
                original: query,
                translated: clean,
            });

            return clean;
        } catch (err: any) {
            if (err?.name === "AbortError") {
                logger.warn("QueryTranslator: translation timed out, skipping fallback");
            } else {
                logger.warn("QueryTranslator: translation failed, skipping fallback", {
                    error: err?.message,
                });
            }
            return null;
        }
    }
}
