import { GoogleGenAI } from '@google/genai';
import { supabaseAdmin } from '../config/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

// Initialize Google Gen AI client
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Clean markdown code fences (e.g. ```json ... ```) from string
 */
export function cleanJsonFence(text) {
  if (!text) return '';
  let cleaned = text.trim();
  // Remove starting ```json or ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  // Remove ending ```
  cleaned = cleaned.replace(/\s*```$/i, '');
  return cleaned.trim();
}

/**
 * Generate 10 keyword variations using Gemini 2.5 Flash
 * @param {string} keyword Target seed keyword
 * @param {string} category 'video' | 'vector' | 'image'
 * @param {string} keywordId Optional ID to auto-save to keyword_variants table
 */
export async function generateKeywordVariants(keyword, category, keywordId = null) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in backend environment variables.');
  }

  const prompt = `Berikan 10 variasi kata kunci pencarian untuk stock ${category} dari kata kunci: ${keyword}. Fokus pada sinonim dan frasa terkait. Balas hanya dalam format JSON array of strings, tanpa penjelasan tambahan.`;

  try {
    console.log(`[Gemini AI] Generating variations for keyword: "${keyword}" (category: ${category})`);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
        responseMimeType: 'application/json'
      }
    });

    const rawText = response.text;
    const cleanedText = cleanJsonFence(rawText);
    
    let variants = [];
    try {
      variants = JSON.parse(cleanedText);
    } catch (parseError) {
      console.warn(`[Gemini AI] JSON parse failed on cleaned text: "${cleanedText}". Trying regex fallback.`);
      const matches = cleanedText.match(/"([^"]+)"/g);
      if (matches) {
        variants = matches.map((m) => m.replace(/^"|"$/g, ''));
      } else {
        throw new Error(`Failed to parse AI response into JSON array: ${cleanedText}`);
      }
    }

    if (!Array.isArray(variants)) {
      throw new Error('Gemini response is not an array of strings.');
    }

    // Filter and sanitize string array
    const sanitizedVariants = variants
      .filter((v) => typeof v === 'string' && v.trim().length > 0)
      .map((v) => v.trim())
      .slice(0, 10);

    // If keywordId is provided, save to database
    if (keywordId && supabaseAdmin && sanitizedVariants.length > 0) {
      const recordsToInsert = sanitizedVariants.map((variantText) => ({
        keyword_id: keywordId,
        variant_text: variantText
      }));

      const { error: insertError } = await supabaseAdmin
        .from('keyword_variants')
        .insert(recordsToInsert);

      if (insertError) {
        console.error('[Gemini AI DB Error] Failed to save variants:', insertError.message);
      } else {
        console.log(`[Gemini AI] Successfully saved ${sanitizedVariants.length} variants to database.`);
      }
    }

    return {
      success: true,
      keyword,
      category,
      keywordId,
      variants: sanitizedVariants
    };
  } catch (error) {
    console.error('[Gemini AI Error]:', error.message);
    throw error;
  }
}
