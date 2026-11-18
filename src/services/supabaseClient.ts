import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
// VITE_SUPABASE_ANON_KEY: Supabase의 anon key 또는 신규 대시보드의 publishable key 모두 수용
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  missingKeys: string[];
  errorMessage?: string;
}

export function checkSupabaseConfig(): SupabaseConfigStatus {
  const missingKeys: string[] = [];
  if (!supabaseUrl || supabaseUrl === 'https://your-project-ref.supabase.co') {
    missingKeys.push('VITE_SUPABASE_URL');
  }
  if (!supabaseAnonKey || supabaseAnonKey === 'your-anon-public-key') {
    missingKeys.push('VITE_SUPABASE_ANON_KEY');
  }

  if (missingKeys.length > 0) {
    return {
      isConfigured: false,
      missingKeys,
      errorMessage: `Supabase 환경변수가 설정되지 않았습니다 (.env.local에 ${missingKeys.join(', ')} 필요).`,
    };
  }

  return { isConfigured: true, missingKeys: [] };
}

export const supabaseConfigStatus = checkSupabaseConfig();

export const supabase: SupabaseClient | null = supabaseConfigStatus.isConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

