import { createClient } from '@supabase/supabase-js';

const getEnvVar = (key: string, fallback: string): string => {
  try {
    return (import.meta as any).env?.[key] || fallback;
  } catch {
    return fallback;
  }
};

const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL', 'https://prlncsoxwpmwcvfgnqbb.supabase.co');
const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBybG5jc294d3Btd2N2ZmducWJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NTIxMjQsImV4cCI6MjEwNDAyODEyNH0.eNQ9coC5PrvUAHq86Xbi4oPD0P43XJNxw5N0A45ayVY');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
