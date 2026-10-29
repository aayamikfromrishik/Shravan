'use client';
// Lessons saved on this phone for listening without internet (Premium). Stored in the browser's IndexedDB.
import type { Lesson } from './lesson';

export interface OfflineLesson {
  versionId: string;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterIdx: number;
  chapterTitle: string;
  lang: 'english' | 'hindi' | 'mix';
  mode: string;
  lesson: Lesson;
  parts: { start: number; end: number; audio: Blob }[];
  bytes: number;
  savedAt: string;
}

const DB = 'shravan-offline';
const STORE = 'lessons';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'versionId' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const r = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(r.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const offlineSupported = () => typeof indexedDB !== 'undefined';
export const saveOfflineLesson = (l: OfflineLesson) => run('readwrite', (s) => s.put(l));
export const getOfflineLesson = (id: string) => run<OfflineLesson | undefined>('readonly', (s) => s.get(id));
export const listOfflineLessons = () => run<OfflineLesson[]>('readonly', (s) => s.getAll());
export const removeOfflineLesson = (id: string) => run('readwrite', (s) => s.delete(id));
export async function isSavedOffline(id: string) {
  try {
    return !!(await run('readonly', (s) => s.getKey(id)));
  } catch {
    return false;
  }
}
