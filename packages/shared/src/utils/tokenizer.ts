/**
 * Token Estimator
 * 
 * Estimates token count for text (rough approximation)
 * For production, consider using tiktoken or similar
 */

/**
 * Estimate tokens in text
 * Rule of thumb: ~4 characters per token for code, ~5 for natural language
 */
export function estimateTokens(text: string, type: 'code' | 'text' = 'code'): number {
  const charsPerToken = type === 'code' ? 4 : 5;
  return Math.ceil(text.length / charsPerToken);
}

/**
 * Estimate tokens for multiple strings
 */
export function estimateTokensBatch(texts: string[], type: 'code' | 'text' = 'code'): number {
  return texts.reduce((total, text) => total + estimateTokens(text, type), 0);
}

/**
 * Check if text exceeds token limit
 */
export function exceedsTokenLimit(text: string, limit: number, type: 'code' | 'text' = 'code'): boolean {
  return estimateTokens(text, type) > limit;
}

/**
 * Truncate text to fit token limit
 */
export function truncateToTokenLimit(
  text: string, 
  limit: number, 
  type: 'code' | 'text' = 'code'
): string {
  const charsPerToken = type === 'code' ? 4 : 5;
  const maxChars = limit * charsPerToken;
  
  if (text.length <= maxChars) {
    return text;
  }
  
  return text.slice(0, maxChars) + '\n... (truncated)';
}
