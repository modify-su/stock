import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCp-QfMXtH4PZPx-b-T2bP-qkZyJ1Q9UU4",
  authDomain: "innate-facet-klsxp.firebaseapp.com",
  projectId: "innate-facet-klsxp",
  storageBucket: "innate-facet-klsxp.firebasestorage.app",
  messagingSenderId: "302222547158",
  appId: "1:302222547158:web:174df22e64c6dc9fab9177"
};

const app = initializeApp(firebaseConfig);

const DB_ID = "ai-studio-stockmanagements-d2035f6d-8e85-41ea-9141-eedfc5e93833";

let firestoreDb;

try {
  // Try initializing with experimentalForceLongPolling and multi-tab persistent cache
  firestoreDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, DB_ID);
} catch (error) {
  console.warn("Firestore initialize with persistence failed, falling back to basic/memory cache:", error);
  try {
    // Try without multi-tab manager / custom settings
    firestoreDb = initializeFirestore(app, {
      experimentalForceLongPolling: true
    }, DB_ID);
  } catch (err2) {
    console.warn("Firestore custom initialize failed, falling back to standard getFirestore:", err2);
    // Standard fallback
    firestoreDb = getFirestore(app, DB_ID);
  }
}

export const db = firestoreDb;
export const auth = getAuth(app);

