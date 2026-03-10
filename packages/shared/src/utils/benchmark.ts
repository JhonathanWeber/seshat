/**
 * Benchmarking Utility
 * 
 * Performance measurement and analysis
 */

export interface BenchmarkResult {
  name: string;
  iterations: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  totalTime: number;
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedValues: number[], p: number): number {
  const index = Math.ceil((sortedValues.length * p) / 100) - 1;
  return sortedValues[Math.max(0, index)];
}

/**
 * Benchmark utility class
 */
export class Benchmark {
  /**
   * Measure async function performance
   */
  static async measure<T>(
    name: string,
    fn: () => Promise<T>,
    iterations: number = 100
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    let totalTime = 0;

    // Warm-up run (not counted)
    await fn();

    // Actual measurements
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const elapsed = performance.now() - start;
      times.push(elapsed);
      totalTime += elapsed;
    }

    // Sort for percentile calculation
    times.sort((a, b) => a - b);

    return {
      name,
      iterations,
      avg: totalTime / iterations,
      min: times[0],
      max: times[times.length - 1],
      p50: percentile(times, 50),
      p95: percentile(times, 95),
      p99: percentile(times, 99),
      totalTime
    };
  }

  /**
   * Measure sync function performance
   */
  static measureSync<T>(
    name: string,
    fn: () => T,
    iterations: number = 100
  ): BenchmarkResult {
    const times: number[] = [];
    let totalTime = 0;

    // Warm-up run
    fn();

    // Actual measurements
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn();
      const elapsed = performance.now() - start;
      times.push(elapsed);
      totalTime += elapsed;
    }

    times.sort((a, b) => a - b);

    return {
      name,
      iterations,
      avg: totalTime / iterations,
      min: times[0],
      max: times[times.length - 1],
      p50: percentile(times, 50),
      p95: percentile(times, 95),
      p99: percentile(times, 99),
      totalTime
    };
  }

  /**
   * Compare two benchmark results
   */
  static compare(baseline: BenchmarkResult, optimized: BenchmarkResult): {
    improvement: number;
    faster: boolean;
    summary: string;
  } {
    const improvement = ((baseline.avg - optimized.avg) / baseline.avg) * 100;
    const faster = improvement > 0;

    const summary = faster
      ? `${improvement.toFixed(1)}% faster (${baseline.avg.toFixed(2)}ms → ${optimized.avg.toFixed(2)}ms)`
      : `${Math.abs(improvement).toFixed(1)}% slower (${baseline.avg.toFixed(2)}ms → ${optimized.avg.toFixed(2)}ms)`;

    return { improvement, faster, summary };
  }

  /**
   * Format benchmark result as string
   */
  static format(result: BenchmarkResult): string {
    return `
Benchmark: ${result.name}
Iterations: ${result.iterations}
Average: ${result.avg.toFixed(2)}ms
Min: ${result.min.toFixed(2)}ms
Max: ${result.max.toFixed(2)}ms
P50: ${result.p50.toFixed(2)}ms
P95: ${result.p95.toFixed(2)}ms
P99: ${result.p99.toFixed(2)}ms
Total: ${result.totalTime.toFixed(2)}ms
`.trim();
  }
}
