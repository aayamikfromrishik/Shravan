// The Supabase project address and public (publishable) key. Both are public by design:
// every visitor's browser receives them. Data stays protected by the database rules and the
// secret key, which lives only in Vercel. A Vercel value, if set, is used instead.
const PROJECT_URL = 'https://iqqqmnoypcqwoqrqsrcb.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_aSClA0tXJI4Wn1wqhKJeOw_-CiVLaB6';

function cleanUrl(v: string | undefined): string | null {
  const m = v?.trim().match(/^https:\/\/[a-z0-9-]+\.supabase\.co/i);
  return m ? m[0] : null;
}

export const SUPABASE_URL = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) || PROJECT_URL;
export const SUPABASE_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || PUBLISHABLE_KEY;
