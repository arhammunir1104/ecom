import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

// Check if we have the required Firebase environment variables
if (!projectId || !import.meta.env.VITE_FIREBASE_API_KEY || !import.meta.env.VITE_FIREBASE_APP_ID) {
  console.warn("Missing required Firebase configuration environment variables!");
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // Generate authDomain from projectId if not provided
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId: projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

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
