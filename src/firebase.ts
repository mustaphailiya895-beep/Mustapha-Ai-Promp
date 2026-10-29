import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  deleteUser,
  User
} from 'firebase/auth';
import {
  getFirestore,
  setLogLevel,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { sanitizeStringField } from './utils/promptEngine';

// Silence verbose internal @firebase/firestore console.error logs when offline or when Token Service API is propagating
setLogLevel('silent');

// Clear any stale cached Firebase Auth tokens from IndexedDB / localStorage that would fail against disabled securetoken.googleapis.com
if (typeof window !== 'undefined') {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith('firebase:authUser:') || k.startsWith('firebase:previous_websocket_failure'))) {
        window.localStorage.removeItem(k);
      }
    }
    if (window.indexedDB && typeof window.indexedDB.deleteDatabase === 'function') {
      window.indexedDB.deleteDatabase('firebaseLocalStorageDb');
    }
  } catch {
    // Ignore storage cleanup errors in restricted iframes
  }
}

const app = initializeApp(firebaseConfig);

// Use inMemoryPersistence so stale refresh tokens are never persisted or auto-refreshed against securetoken.googleapis.com on page load
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: inMemoryPersistence,
      popupRedirectResolver: browserPopupRedirectResolver
    });
  } catch {
    return getAuth(app);
  }
})();

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isTokenServiceError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || '');
  return (
    msg.includes('token-service-api-has-not-been-used') ||
    msg.includes('securetoken.googleapis.com') ||
    msg.includes('Fetching auth token failed') ||
    msg.includes('the client is offline')
  );
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  if (isTokenServiceError(error)) {
    // Gracefully sign out broken token so Firestore operates cleanly without spamming errors
    firebaseSignOut(auth).catch(() => {});
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore operation fallback (local state active):', errInfo.operationType, errInfo.path);
}

// Non-noisy connection check on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch {
    // Connection check completed (permission-denied or offline mode handled silently)
  }
}
testConnection();

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // Verify token service is reachable before keeping auth user attached to Firestore
    try {
      await result.user.getIdToken();
      await ensureUserProfile(result.user);
      return result.user;
    } catch (tokenErr) {
      if (isTokenServiceError(tokenErr)) {
        await firebaseSignOut(auth).catch(() => {});
        return null;
      }
      throw tokenErr;
    }
  } catch (err) {
    if (isTokenServiceError(err)) {
      await firebaseSignOut(auth).catch(() => {});
      return null;
    }
    throw err;
  }
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth).catch(() => {});
}

export async function ensureUserProfile(user: User): Promise<void> {
  const userPath = `users/${user.uid}`;
  const privatePath = `users/${user.uid}/private/info`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: sanitizeStringField(user.displayName || 'Workspace User', 100, 'Workspace User'),
        photoURL: sanitizeStringField(user.photoURL || '', 500, ''),
        theme: 'dark',
        language: 'en',
        defaultModel: 'gemini-3.1-flash-lite',
        customInstructions: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (user.email) {
        const privRef = doc(db, 'users', user.uid, 'private', 'info');
        await setDoc(privRef, {
          uid: user.uid,
          email: sanitizeStringField(user.email, 254, 'user@example.com'),
          authProvider: 'google.com',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${userPath} | ${privatePath}`);
  }
}

export async function updateUserProfileSettings(
  uid: string,
  updates: {
    displayName?: string;
    theme?: 'dark' | 'light';
    language?: 'en' | 'ha';
    defaultModel?: string;
    customInstructions?: string;
  }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const payload: Record<string, any> = {
      updatedAt: serverTimestamp()
    };
    if (updates.displayName !== undefined) {
      payload.displayName = sanitizeStringField(updates.displayName, 100, 'Workspace User');
    }
    if (updates.theme !== undefined) {
      payload.theme = updates.theme === 'light' ? 'light' : 'dark';
    }
    if (updates.language !== undefined) {
      payload.language = updates.language === 'ha' ? 'ha' : 'en';
    }
    if (updates.defaultModel !== undefined) {
      payload.defaultModel = sanitizeStringField(updates.defaultModel, 80, 'gemini-3.1-flash-lite');
    }
    if (updates.customInstructions !== undefined) {
      payload.customInstructions = sanitizeStringField(updates.customInstructions, 2000, '');
    }
    await updateDoc(userRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteUserAccountAndData(user: User): Promise<void> {
  const uid = user.uid;
  try {
    const promptsQ = query(collection(db, 'prompts'), where('userId', '==', uid));
    const promptSnaps = await getDocs(promptsQ);
    for (const d of promptSnaps.docs) {
      await deleteDoc(doc(db, 'prompts', d.id));
    }

    const convQ = query(collection(db, 'conversations'), where('userId', '==', uid));
    const convSnaps = await getDocs(convQ);
    for (const c of convSnaps.docs) {
      const msgSnaps = await getDocs(
        query(collection(db, 'conversations', c.id, 'messages'), where('userId', '==', uid))
      );
      for (const m of msgSnaps.docs) {
        await deleteDoc(doc(db, 'conversations', c.id, 'messages', m.id));
      }
      await deleteDoc(doc(db, 'conversations', c.id));
    }

    try {
      await deleteDoc(doc(db, 'users', uid, 'private', 'info'));
    } catch {
      // Ignore if not present
    }
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch {
      // Ignore if not present
    }

    await deleteUser(user);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
  }
}
