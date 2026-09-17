import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { runScrapingJob, getJobState } from '../services/queue.js';
import { generateKeywordVariants } from '../services/gemini.js';
import { buildAdobeStockUrl } from '../services/scraper.js';

const router = express.Router();

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Data2Pro Backend API',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/keywords/process
 * Accepts keywords list (max 50) and starts asynchronous background scraping job
 */
router.post('/keywords/process', async (req, res) => {
  try {
    const { keywords, category = 'image', userId } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized: userId is required.'
      });
    }

    // Support string (separated by newline/comma) or array of strings
    let rawKeywordsList = [];
    if (Array.isArray(keywords)) {
      rawKeywordsList = keywords;
    } else if (typeof keywords === 'string') {
      rawKeywordsList = keywords
        .split(/[\n,]+/)
        .map((k) => k.trim())
        .filter(Boolean);
    }

    // Clean & deduplicate keywords
    const cleanedKeywords = Array.from(
      new Set(
        rawKeywordsList
          .map((k) => (typeof k === 'string' ? k.trim() : ''))
          .filter((k) => k.length > 0)
      )
    );

    if (cleanedKeywords.length === 0) {
      return res.status(400).json({
        error: 'Harap masukkan setidaknya satu kata kunci yang valid.'
      });
    }

    // Max 50 keywords per request for safety
    if (cleanedKeywords.length > 50) {
      return res.status(400).json({
        error: 'Maksimal 50 keyword per sesi request untuk menghindari pemblokiran.'
      });
    }

    // Validate category
    const validCategories = ['video', 'vector', 'image'];
    const safeCategory = validCategories.includes(category) ? category : 'image';

    // 1. Prepare records for Supabase
    const recordsToInsert = cleanedKeywords.map((kw) => ({
      keyword: kw,
      category: safeCategory,
      search_url: buildAdobeStockUrl(kw, safeCategory),
      result_count: null,
      is_used: false,
      user_id: userId
    }));

    // 2. Insert into Supabase
    const { data: insertedRecords, error: dbError } = await supabaseAdmin
      .from('keywords')
      .insert(recordsToInsert)
      .select();

    if (dbError) {
      console.error('[API Error] Failed to insert keywords into Supabase:', dbError);
      return res.status(500).json({
        error: `Database error: ${dbError.message}`
      });
    }

    // 3. Start background job
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const jobState = await runScrapingJob(jobId, insertedRecords);

    return res.status(202).json({
      success: true,
      jobId,
      totalKeywords: insertedRecords.length,
      status: jobState.status,
      message: 'Permintaan berhasil didaftarkan. Proses scraping sedang berjalan di latar belakang.',
      items: insertedRecords
    });
  } catch (error) {
    console.error('[API Error /keywords/process]:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * GET /api/jobs/:jobId
 * Check progress of an asynchronous scraping job
 */
router.get('/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;
  const jobState = getJobState(jobId);

  if (!jobState) {
    return res.status(404).json({
      error: 'Job tidak ditemukan atau telah kedaluwarsa.'
    });
  }

  res.json({
    success: true,
    job: jobState
  });
});

/**
 * POST /api/keywords/:id/generate-variants
 * Generate 10 AI variations with Gemini 2.5 Flash for a specific keyword
 */
router.post('/keywords/:id/generate-variants', async (req, res) => {
  try {
    const { id } = req.params;
    let { keyword, category } = req.body;

    // If keyword/category not provided in body, fetch from database
    if (!keyword || !category) {
      const { data: kwRecord, error: kwError } = await supabaseAdmin
        .from('keywords')
        .select('*')
        .eq('id', id)
        .single();

      if (kwError || !kwRecord) {
        return res.status(404).json({ error: 'Keyword tidak ditemukan di database.' });
      }

      keyword = kwRecord.keyword;
      category = kwRecord.category;
    }

    const result = await generateKeywordVariants(keyword, category, id);
    res.json(result);
  } catch (error) {
    console.error('[API Error /generate-variants]:', error);
    res.status(500).json({
      error: error.message || 'Gagal menghasilkan variasi kata kunci.'
    });
  }
});

/**
 * GET /api/keywords/:id/variants
 * Fetch saved variants for a keyword
 */
router.get('/keywords/:id/variants', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: variants, error } = await supabaseAdmin
      .from('keyword_variants')
      .select('*')
      .eq('keyword_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      keywordId: id,
      variants: variants || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
