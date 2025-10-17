// Supabase 클라이언트 설정
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://pislpfnstcguhziglbms.supabase.co';
export const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

