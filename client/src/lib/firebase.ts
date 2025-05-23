import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration using environment variables or fallback
// Safe access to environment variables with fallbacks
const getEnvVar = (key: string, fallback: string) => {
  try {
    return import.meta.env?.[key] || fallback;
  } catch (e) {
    console.warn(`Failed to access environment variable ${key}, using fallback value`);
    return fallback;
  }
};

// Your Firebase configuration
const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY', "AIzaSyC7KLf8dP_WYbr0wQdVsrHY3LCRWDaEgV0"),
  authDomain: `${getEnvVar('VITE_FIREBASE_PROJECT_ID', "burger-c0af3")}.firebaseapp.com`,
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', "burger-c0af3"),
  storageBucket: `${getEnvVar('VITE_FIREBASE_PROJECT_ID', "burger-c0af3")}.appspot.com`,
  messagingSenderId: "442391454320", // This is usually not sensitive
  appId: getEnvVar('VITE_FIREBASE_APP_ID', "1:442391454320:web:eb5e1c3c83e19ebf43ff88")
};

// Log Firebase configuration for debugging
console.log("Firebase Config - Project ID:", firebaseConfig.projectId);
console.log("Firebase Config - API Key available:", !!firebaseConfig.apiKey);
console.log("Firebase Config - App ID available:", !!firebaseConfig.appId);

// Initialize Firebase - handle hot module reloading by checking if app already exists
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Function to get the Firebase app instance (for server-side use)
export const getFirebaseApp = () => {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
};

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    // Configure additional scopes and parameters
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
    
    // Use .replit.dev domain in auth origin config to fix domain verification issues
    const currentOrigin = window.location.origin;
    
    // Log the current domain for debugging
    console.log("Current domain:", currentOrigin);
    
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Error signing in with Google: ", error);
    
    // Provide more helpful error messages with specific troubleshooting instructions
    if (error.code === 'auth/configuration-not-found') {
      console.error('Firebase Configuration Error: Make sure your domain is added to the authorized domains in Firebase console, and Google Sign-in method is enabled.');
      console.error('Add this exact domain to Firebase console authorized domains:', window.location.origin);
    } else if (error.code === 'auth/popup-blocked') {
      console.error('Popup was blocked by the browser. Please enable popups for this site.');
    }
    
    throw error;
  }
};

// Sign out
export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out: ", error);
    throw error;
  }
};

// Listen to auth state changes
export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export default app;
