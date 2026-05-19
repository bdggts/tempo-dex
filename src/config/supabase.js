import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wsczprzbpkjcloxlvfaz.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBlcmJhc2UiLCJyZWYiOiJ3c2N6cHJ6YnBranNsb3hsdmZheiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc0MTIxNzc2LCJleHAiOjIwODk2OTc3NzZ9.FilJKUBLQ0TyL3EvLaPmD-FBc-t-4WDSLmYADgYQKs0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
