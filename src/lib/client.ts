'use client';
// Browser-side helpers: sign-in session and calls to the SHRAVAN server.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from './supabase-public';

let sb: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  sb ??= createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  return sb;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok && res.status !== 202) {
    const msg = (json as { error?: string })?.error || 'Something went wrong. Please try again.';
    throw new ApiError(res.status, msg, json);
  }
  return json as T;
}

export async function uploadBook(file: File): Promise<{ path: string }> {
  const { path, token } = await api<{ path: string; token: string }>('/api/uploads/sign', { body: { fileName: file.name, size: file.size } });
  const { error } = await supabase().storage.from('uploads').uploadToSignedUrl(path, token, file, { contentType: file.type || 'application/octet-stream' });
  if (error) throw new ApiError(500, 'Upload failed. Please check your connection and try again.');
  return { path };
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

/** Ask the phone for notification permission and register it with the server. */
export async function enablePush(): Promise<'ok' | 'denied' | 'unsupported'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (key.length % 4)) % 4));
  const appKey = Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey }));
  await api('/api/push', { body: { subscription: sub.toJSON() } });
  return 'ok';
}
