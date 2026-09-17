import { scrapeAdobeStockResultCount } from './scraper.js';
import { supabaseAdmin } from '../config/supabase.js';

// In-memory job state store
const activeJobs = new Map();

/**
 * Helper to sleep for random duration between minMs and maxMs
 */
function randomSleep(minMs = 3000, maxMs = 5000) {
  const duration = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, duration));
}

/**
 * Start asynchronous scraping job for a list of keyword records
 * @param {string} jobId Unique Job ID
 * @param {Array<{ id: string, keyword: string, category: string, user_id: string }>} keywordRecords
 */
export async function runScrapingJob(jobId, keywordRecords) {
  console.log(`[Queue] Starting background job ${jobId} with ${keywordRecords.length} keywords.`);

  const jobState = {
    id: jobId,
    total: keywordRecords.length,
    processed: 0,
    successful: 0,
    failed: 0,
    status: 'processing', // 'processing' | 'completed' | 'paused_due_to_block' | 'failed'
    currentKeyword: '',
    results: [],
    errorMessage: null,
    startedAt: new Date().toISOString(),
    completedAt: null
  };

  activeJobs.set(jobId, jobState);

  // Run in background without blocking caller
  (async () => {
    let consecutiveErrors = 0;

    for (let i = 0; i < keywordRecords.length; i++) {
      const item = keywordRecords[i];
      jobState.currentKeyword = item.keyword;
      jobState.processed = i + 1;

      try {
        // Scrape keyword
        const scrapeResult = await scrapeAdobeStockResultCount(item.keyword, item.category);

        if (scrapeResult.success) {
          consecutiveErrors = 0;
          jobState.successful++;
          jobState.results.push(scrapeResult);

          // Update record in Supabase
          if (supabaseAdmin && item.id) {
            const { error: dbError } = await supabaseAdmin
              .from('keywords')
              .update({
                result_count: scrapeResult.resultCount,
                search_url: scrapeResult.searchUrl
              })
              .eq('id', item.id);

            if (dbError) {
              console.error(`[Queue DB Error] Failed to update keyword ${item.id}:`, dbError.message);
            }
          }
        } else {
          consecutiveErrors++;
          jobState.failed++;
          jobState.results.push(scrapeResult);

          // Check if error is related to captcha or block
          const errStr = (scrapeResult.error || '').toLowerCase();
          if (errStr.includes('blocked') || errStr.includes('captcha') || errStr.includes('rate_limited')) {
            console.error(`[Queue] ABORTING job ${jobId}: Scraper block/captcha detected.`);
            jobState.status = 'paused_due_to_block';
            jobState.errorMessage = 'Pencarian dihentikan otomatis karena terdeteksi verifikasi/pembatasan dari Adobe Stock.';
            break;
          }

          if (consecutiveErrors >= 5) {
            console.error(`[Queue] ABORTING job ${jobId}: 5 consecutive scrape failures.`);
            jobState.status = 'failed';
            jobState.errorMessage = 'Terjadi 5 kegagalan berturut-turut saat scraping. Proses dihentikan untuk keamanan.';
            break;
          }
        }
      } catch (err) {
        console.error(`[Queue] Unexpected exception while processing ${item.keyword}:`, err);
        jobState.failed++;
        jobState.results.push({
          success: false,
          keyword: item.keyword,
          category: item.category,
          error: err.message
        });
      }

      // Respect rate limit: 3-5s random delay between requests (if more items remain)
      if (i < keywordRecords.length - 1 && jobState.status === 'processing') {
        console.log(`[Queue] Rate limiting pause (3-5s) before next keyword...`);
        await randomSleep(3000, 5000);
      }
    }

    if (jobState.status === 'processing') {
      jobState.status = 'completed';
    }

    jobState.completedAt = new Date().toISOString();
    console.log(`[Queue] Job ${jobId} finished with status: ${jobState.status}. Processed: ${jobState.processed}/${jobState.total}`);
  })();

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
    if (job.completedAt && new Date(job.completedAt).getTime() < oneHourAgo) {
      activeJobs.delete(jobId);
    }
  }
}
