import { createClient } from '@supabase/supabase-js';

// NOTE: These environment variables must be set in your project build pipeline
// If not available, the app falls back to IndexedDB/Local logic.
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;
