// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBDyR8JG77a90WDoPhWwfGkC7RTD__aUdY",
  authDomain: "carolasgreen.firebaseapp.com",
  projectId: "carolasgreen",
  storageBucket: "carolasgreen.firebasestorage.app",
  messagingSenderId: "403055823425",
  appId: "1:403055823425:web:0749d9e4b17bdf336a14c0",
  measurementId: "G-21QDPXDYBS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const realtimeDb = getDatabase(app);
