// Server-side helpers: database access, who is calling, and access rules.
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { adminEmails, LIMITS } from './config';
import { SUPABASE_URL } from './supabase-public';

let admin: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase is not configured (SUPABASE_SERVICE_ROLE_KEY is missing in Vercel).');
  }
  admin ??= createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface Caller {
  user: User;
  isAdmin: boolean;
  profile: Profile;
}
export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  view: 'basic' | 'peacock';
  default_language: string;
  default_level: string;
  default_mode: string;
  plan: 'free' | 'subscriber';
  subscribed_until: string | null;
  notifications_seen_at: string;
}

/** Reads the Supabase access token sent by the app and returns the learner. */
export async function getCaller(req: Request): Promise<Caller> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Please sign in.');
  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Please sign in again.');
  const user = data.user;
  let { data: profile } = await db().from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) {
    const name = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || null;
    const { data: created } = await db()
      .from('profiles')
      .upsert({ id: user.id, email: user.email, name })
      .select('*')
      .single();
    profile = created;
  }
  const isAdmin = !!user.email && adminEmails().includes(user.email.toLowerCase());
  return { user, isAdmin, profile: profile as Profile };
}

export function isSubscriber(p: Profile): boolean {
  if (p.plan !== 'subscriber') return false;
  return !p.subscribed_until || new Date(p.subscribed_until) > new Date();
}

export function bookIsFreeNow(book: { free_until: string | null }): boolean {
  return !!book.free_until && new Date(book.free_until) > new Date();
}

/** Wraps a route handler: JSON errors with friendly messages. */
export function handle(fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
  };
}

export async function logUsage(kind: string, u: { input_tokens: number; output_tokens: number; cache_read_tokens: number }) {
  await db().from('usage_log').insert({ kind, input_tokens: u.input_tokens, output_tokens: u.output_tokens, cache_read_tokens: u.cache_read_tokens });
}

export interface BookRow {
  id: string;
  slug: string | null;
  title: string;
  author: string | null;
  edition: string | null;
  subject: string | null;
  kind: 'text' | 'readalong';
  is_library: boolean;
  published: boolean;
  needs_own_copy: boolean;
  buy_url: string | null;
  status: string;
  status_note: string | null;
  free_until: string | null;
  page_count: number | null;
  word_count: number | null;
  created_by: string | null;
  language: string;
  source_type: string | null;
  fingerprint: string | null;
}

/** Can this learner see this book at all? */
export async function canSeeBook(c: Caller, book: BookRow): Promise<boolean> {
  if (c.isAdmin) return true;
  if (book.is_library && book.published) return true;
  const { data } = await db().from('user_books').select('book_id').eq('user_id', c.user.id).eq('book_id', book.id).maybeSingle();
  return !!data;
}

export type ChapterAccess = 'full' | 'free_part' | 'locked' | 'preview_needed';

/**
 * What a learner may open:
 * - admin, subscribers, books made free for now, chapters already completed: full
 * - chapter 1 of any book: the free part, using one of 5 lifetime previews
 */
export async function chapterAccess(c: Caller, book: BookRow, chapter: { id: string; idx: number }): Promise<{ access: ChapterAccess; previewsLeft: number }> {
  const previews = await db().from('free_previews').select('book_id').eq('user_id', c.user.id);
  const used = previews.data?.map((p) => p.book_id) ?? [];
  const previewsLeft = Math.max(0, LIMITS.freePreviewBooks - used.length);
  if (c.isAdmin || isSubscriber(c.profile) || bookIsFreeNow(book)) return { access: 'full', previewsLeft };
  const { data: prog } = await db().from('progress').select('completed').eq('user_id', c.user.id).eq('chapter_id', chapter.id).maybeSingle();
  if (prog?.completed) return { access: 'full', previewsLeft };
  if (chapter.idx !== 1) return { access: 'locked', previewsLeft };
  if (used.includes(book.id)) return { access: 'free_part', previewsLeft };
  return { access: previewsLeft > 0 ? 'preview_needed' : 'locked', previewsLeft };
}

export async function usePreview(c: Caller, bookId: string): Promise<boolean> {
  const { data } = await db().from('free_previews').select('book_id').eq('user_id', c.user.id);
  const used = data?.map((p) => p.book_id) ?? [];
  if (used.includes(bookId)) return true;
  if (used.length >= LIMITS.freePreviewBooks) return false;
  await db().from('free_previews').insert({ user_id: c.user.id, book_id: bookId });
  return true;
}

export async function getBook(id: string): Promise<BookRow> {
  const { data } = await db().from('books').select('*').eq('id', id).maybeSingle();
  if (!data) throw new HttpError(404, 'Book not found.');
  return data as BookRow;
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Bad request.');
  }
}
