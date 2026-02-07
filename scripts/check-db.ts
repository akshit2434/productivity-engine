import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log('Checking background_jobs...');
  const { data: jobs, error: jobsErr } = await supabase.from('background_jobs').select('*').limit(5);
  console.log('Jobs:', jobs || jobsErr);

  console.log('\nChecking memories table definition (via sample)...');
  const { data: memories, error: memErr } = await supabase.from('memories').select('*').limit(1);
  console.log('Memories Sample:', memories || memErr);
  
  if (memories && memories[0]?.embedding) {
    console.log('Existing embedding dimension:', memories[0].embedding.length);
  }
}

debug();
