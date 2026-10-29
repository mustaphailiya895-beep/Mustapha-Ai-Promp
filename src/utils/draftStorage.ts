// IndexedDB + LocalStorage Fallback for Long Master Prompts (15,000+ words)
// and Reliable Clipboard Copy Utility

const DB_NAME = 'MustaphaAIPromptDB';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

export interface StudioDraftRecord {
  id: string;
  originalMasterPrompt: string;
  newIdea: string;
  fullResult: string;
  updatedAt: number;
}

export interface AnalyzerDraftRecord {
  id: string;
  title: string;
  description: string;
  contentType: string;
  fullAiPrompt: string;
  honestyDisclosure?: string;
  fileName?: string;
  updatedAt: number;
}

function openDraftDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveDraftRecord<T extends { id: string }>(record: T): Promise<void> {
  const db = await openDraftDB();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  // Also attempt lightweight localStorage backup if payload fits
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const serialized = JSON.stringify(record);
      if (serialized.length < 1_800_000) {
        window.localStorage.setItem(`mustapha_draft_${record.id}`, serialized);
      }
    }
  } catch {
    // Ignore localStorage quota errors when IndexedDB handles large 15,000-word prompts
  }
}

export async function loadDraftRecord<T extends { id: string }>(id: string): Promise<T | null> {
  const db = await openDraftDB();
  if (db) {
    const fromIdb = await new Promise<T | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve((req.result as T) || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    if (fromIdb) return fromIdb;
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(`mustapha_draft_${id}`);
      if (raw) {
        return JSON.parse(raw) as T;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export async function clearDraftRecord(id: string): Promise<void> {
  const db = await openDraftDB();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(`mustapha_draft_${id}`);
    }
  } catch {
    // Ignore
  }
}

/**
 * Fast O(n) single-pass word and character counter that avoids allocating giant arrays
 * when counting 15,000+ word Master Prompts on mobile or desktop.
 */
export function countWordsAndCharsFast(text: string): { words: number; chars: number; lines: number } {
  if (!text) return { words: 0, chars: 0, lines: 0 };
  const len = text.length;
  let words = 0;
  let lines = 1;
  let inWord = false;

  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i);
    if (code === 10) {
      lines++;
    }
    // Whitespace check: space(32), tab(9), newline(10), cr(13), formfeed(12), vtab(11), nbsp(160)
    const isSpace =
      code === 32 ||
      code === 10 ||
      code === 13 ||
      code === 9 ||
      code === 11 ||
      code === 12 ||
      code === 160;

    if (isSpace) {
      inWord = false;
    } else if (!inWord) {
      inWord = true;
      words++;
    }
  }

  return { words, chars: len, lines };
}

export interface CopyResult {
  ok: boolean;
  method: 'clipboard' | 'execCommand' | 'manual';
  charCount: number;
}

/**
 * Copies the complete text (even 100,000+ characters) reliably using the modern Clipboard API
 * with an automatic hidden textarea fallback for older mobile browsers or restricted webviews.
 */
export async function copyTextReliably(text: string): Promise<CopyResult> {
  const content = String(text ?? '');
  if (!content) {
    return { ok: false, method: 'manual', charCount: 0 };
  }

  // 1. Primary: Modern Async Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(content);
      return { ok: true, method: 'clipboard', charCount: content.length };
    } catch {
      // Fall through to execCommand fallback
    }
  }

  // 2. Fallback: Offscreen textarea selection + document.execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, content.length);
      const succeeded = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (succeeded) {
        return { ok: true, method: 'execCommand', charCount: content.length };
      }
    } catch {
      // Fall through to manual selection trigger
    }
  }

  return { ok: false, method: 'manual', charCount: content.length };
}
