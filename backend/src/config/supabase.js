import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Warning: SUPABASE_URL or SUPABASE_SERVICE_KEY is missing in backend environment.');
}

// Supabase Admin Client using Service Role Key
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Helper function to create client with user JWT if needed for RLS validation
export const createSupabaseUserClient = (token) => {
  return createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    process.env.SUPABASE_ANON_KEY || supabaseServiceKey || 'placeholder-key',
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  );
};
