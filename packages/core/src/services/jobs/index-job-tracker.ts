/**
 * Job Tracker for Async Indexing Operations
 * 
 * Tracks long-running indexing jobs with progress updates
 * and status polling support.
 */

import { randomUUID } from "crypto";

export interface IndexJob {
  jobId: string;
  projectId: string;
  projectPath: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  result?: {
    filesIndexed: number;
    chunksIndexed: number;
    errors: number;
    duration: number;
  };
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * In-memory job tracker singleton
 */
export class IndexJobTracker {
  private static instance: IndexJobTracker;
  private jobs: Map<string, IndexJob> = new Map();
  private readonly MAX_JOBS = 100; // Keep last 100 jobs

  private constructor() {}

  static getInstance(): IndexJobTracker {
    if (!IndexJobTracker.instance) {
      IndexJobTracker.instance = new IndexJobTracker();
    }
    return IndexJobTracker.instance;
  }

  /**
   * Create a new indexing job
   */
  createJob(projectId: string, projectPath: string): IndexJob {
    const jobId = randomUUID();
    
    const job: IndexJob = {
      jobId,
      projectId,
      projectPath,
      status: "pending",
      progress: {
        current: 0,
        total: 0,
        percentage: 0,
      },
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.cleanupOldJobs();
    
    return job;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): IndexJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Update job status
   */
  updateStatus(jobId: string, status: IndexJob["status"]): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = status;

    if (status === "running" && !job.startedAt) {
      job.startedAt = new Date();
    }

    if (status === "completed" || status === "failed") {
      job.completedAt = new Date();
    }
  }

  /**
   * Update job progress
   */
  updateProgress(jobId: string, current: number, total: number): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.progress = {
      current,
      total,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
    };
  }

  /**
   * Set job result on completion
   */
  setResult(
    jobId: string,
    result: IndexJob["result"],
    error?: string
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    if (error) {
      job.status = "failed";
      job.error = error;
    } else {
      job.status = "completed";
      job.result = result;
    }

    job.completedAt = new Date();
  }

  /**
   * List all jobs (for debugging/monitoring)
   */
  listJobs(): IndexJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * List jobs by project
   */
  listJobsByProject(projectId: string): IndexJob[] {
    return this.listJobs().filter((job) => job.projectId === projectId);
  }

  /**
   * Clean up old completed jobs (keep last MAX_JOBS)
   */
  private cleanupOldJobs(): void {
    const jobs = this.listJobs();
    
    if (jobs.length > this.MAX_JOBS) {
      const toRemove = jobs.slice(this.MAX_JOBS);
      toRemove.forEach((job) => this.jobs.delete(job.jobId));
    }
  }

  /**
   * Clear all jobs (for testing)
   */
  clear(): void {
    this.jobs.clear();
  }
}

// Export singleton instance
export const indexJobTracker = IndexJobTracker.getInstance();
