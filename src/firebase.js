/**
 * Fast B Agent Portal — Firebase Configuration
 * Uses a separate Firebase Web App registration for the agent portal,
 * but connects to the SAME Firebase project and Realtime Database.
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyANUjZ7E4a-Y1pTIPTA8jMjPvObu-8O1pI",
  authDomain: "winlbus.firebaseapp.com",
  databaseURL: "https://winlbus-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "winlbus",
  storageBucket: "winlbus.firebasestorage.app",
  messagingSenderId: "1000861693767",
  appId: "1:1000861693767:web:abbb57abb0f9e6cb1e3e62",
  measurementId: "G-WHXQWHWTMD",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;
