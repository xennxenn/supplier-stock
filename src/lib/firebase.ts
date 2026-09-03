import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc, getDocs, updateDoc, setLogLevel } from "firebase/firestore";

// Suppress internal Firestore BloomFilter fallback warnings from cluttering console/logs
if (typeof window !== "undefined") {
  const filterBloomFilter = (fn: (...args: any[]) => void) => {
    return (...args: any[]) => {
      if (
        args.some(
          (a) =>
            (typeof a === "string" && (a.includes("BloomFilter") || a.includes("bloom filter"))) ||
            (a && typeof a.message === "string" && (a.message.includes("BloomFilter") || a.message.includes("bloom filter")))
        )
      ) {
        return;
      }
      fn.apply(console, args);
    };
  };

  console.warn = filterBloomFilter(console.warn);
  console.error = filterBloomFilter(console.error);
}

try {
  setLogLevel("error");
} catch {
  // Ignore in environments where setLogLevel is not supported
}

const firebaseConfig = {
  projectId: "gen-lang-client-0654376496",
  appId: "1:959237168719:web:728bb043a779a43a8c943a",
  apiKey: "AIzaSyB7emkY7yQjWf7rWt_vblXe_VcHCHskNmc",
  authDomain: "gen-lang-client-0654376496.firebaseapp.com",
  storageBucket: "gen-lang-client-0654376496.firebasestorage.app",
  messagingSenderId: "959237168719"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-supplieraccessor-a00a7d4e-7cb1-4ba9-aa1f-4df7ed9106f0");

export const orderStatusCol = collection(db, "orderStatuses");
export const employeesCol = collection(db, "employees");
export const customTxCol = collection(db, "customTransactions");

