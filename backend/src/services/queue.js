/**
 * queue.js - Background job manager (Extension Mode)
 *
 * Dalam mode Chrome Extension, server tidak lagi melakukan scraping sendiri.
 * Job hanya dibuat sebagai marker status; scraping dilakukan oleh ekstensi.
 */
import { supabaseAdmin } from '../config/supabase.js';

// In-memory job state store
const activeJobs = new Map();

/**
 * Register keyword records as a "pending" job.
 * The Chrome Extension will pick up the keywords and report results.
 *
 * @param {string} jobId Unique Job ID
 * @param {Array<{ id: string, keyword: string, category: string }>} keywordRecords
 * @returns {object} jobState
 */
export async function runScrapingJob(jobId, keywordRecords) {
  console.log(`[Queue] Registering job ${jobId} with ${keywordRecords.length} keywords (Extension mode - no server-side scraping).`);

  const jobState = {
    id: jobId,
    total: keywordRecords.length,
    processed: 0,
    successful: 0,
    failed: 0,
    status: 'pending_extension', // Waiting for Chrome Extension to process
    currentKeyword: '',
    results: [],
    errorMessage: null,
    startedAt: new Date().toISOString(),
    completedAt: null
  };

  activeJobs.set(jobId, jobState);

  // Mark Supabase records as pending (result_count = null already)
  // The Chrome Extension will poll /api/keywords/pending and update them
  console.log(`[Queue] Job ${jobId} registered. Keywords are available at /api/keywords/pending for the Chrome Extension.`);

  return jobState;
}

/**
 * Get current state of a background job
 */
export function getJobState(jobId) {
  return activeJobs.get(jobId) || null;
}

/**
 * Clear old jobs from memory (keeps memory bounded)
 */
export function cleanOldJobs() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [jobId, job] of activeJobs.entries()) {
    if (job.startedAt && new Date(job.startedAt).getTime() < oneHourAgo) {
      activeJobs.delete(jobId);
    }
  }
}
