import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { firebaseConfig } from "./firebase-config";

export interface FB {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let pending: Promise<FB> | null = null;

/** Initializes Firebase once (browser only) and reuses the instances. */
export function getFirebase(): Promise<FB> {
  if (!pending) {
    pending = (async () => {
      const app = getApps()[0] ?? initializeApp(firebaseConfig);
      let db: Firestore;
      try {
        db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
      } catch {
        db = getFirestore(app); // already initialized or IndexedDB unavailable
      }
      return { app, auth: getAuth(app), db };
    })();
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}
