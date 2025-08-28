// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export type Post = {
  id: number;
  created_at: string;
  author: string;
  content: string;
  image_url: string | null;  // Add this line
  timestamp?: string;        // Optional timestamp for client-side formatting
};