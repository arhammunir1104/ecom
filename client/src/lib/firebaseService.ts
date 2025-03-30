import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser
} from "firebase/auth";
import { 
  collection,
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp, 
  Timestamp 
} from "firebase/firestore";
import { auth, db } from "./firebase";

// Constants
const USERS_COLLECTION = "users";

// Types
export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  fullName?: string;
  role: string;
  twoFactorEnabled?: boolean;
  phoneNumber?: string;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Helper function to get user document reference
const getUserDocRef = (uid: string) => doc(db, USERS_COLLECTION, uid);

/**
 * Register a new user with email and password
 */
export const registerWithEmailAndPassword = async (
  email: string,
  password: string,
  username: string,
  fullName?: string
): Promise<FirebaseUser> => {
  try {
    console.log("Creating new user in Firebase Authentication:", email);
    // Create the user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log("Firebase Auth user created successfully:", user.uid);
    
    // Update the user's display name in Auth
    await updateProfile(user, {
      displayName: username
    });
    
    console.log("Creating user profile in Firestore...");
    
    // Create user profile document structure
    const userData = {
      uid: user.uid,
      email: email,
      username: username,
      fullName: fullName || username,
      role: "user",
      twoFactorEnabled: false,
      photoURL: user.photoURL || undefined,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp
    };
    
    // Create user profile in Firestore with explicit document ID
    const userDocRef = getUserDocRef(user.uid);
    await setDoc(userDocRef, userData);
    
    console.log("User profile created in Firestore:", user.uid);
    return user;
  } catch (error) {
    console.error("Error registering user:", error);
    throw error;
  }
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<FirebaseUser> => {
  try {
    console.log("Attempting to sign in with email/password:", email);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("Sign in successful:", userCredential.user.uid);
    
    // Create a user profile in Firestore if it doesn't exist already
    // This ensures we always have a Firestore profile for the user
    const userExists = await checkIfUserExists(userCredential.user.uid);
    if (!userExists) {
      console.log("Creating missing Firestore profile for existing auth user");
      // Get display name from Firebase Auth
      const displayName = userCredential.user.displayName || email.split('@')[0];
      
      // Create a new user profile
      await createUserProfile(userCredential.user.uid, {
        uid: userCredential.user.uid,
        email: email,
        username: displayName,
        fullName: displayName,
        role: "user",
        twoFactorEnabled: false,
        photoURL: userCredential.user.photoURL || undefined,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp
      });
      console.log("Created missing Firestore profile for user:", userCredential.user.uid);
    } else {
      // Update last login time
      await updateUserProfile(userCredential.user.uid, {
        updatedAt: serverTimestamp() as Timestamp
      });
    }
    
    return userCredential.user;
  } catch (error: any) {
    console.error("Error signing in:", error);
    
    // Provide user-friendly error messages
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      console.error("Invalid credentials provided");
    } else if (error.code === 'auth/too-many-requests') {
      console.error("Too many login attempts. Account temporarily disabled");
    } else if (error.code === 'auth/invalid-credential') {
      console.error("Invalid login credentials");
    } else if (error.code === 'auth/operation-not-allowed') {
      console.error("Email/password sign-in is not enabled in Firebase console");
    }
    
    throw error;
  }
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<FirebaseUser> => {
  try {
    console.log("Starting Google sign-in process...");
    const provider = new GoogleAuthProvider();
    
    // Add scopes for additional information
    provider.addScope('email');
    provider.addScope('profile');
    
    provider.setCustomParameters({
      prompt: "select_account"
    });
    
    console.log("Opening Google sign-in popup...");
    // Get current domain for debugging
    console.log("Current domain:", window.location.origin);
    
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    console.log("Google sign-in successful:", user.email);
    
    // Check if this is a new user (first time sign in)
    console.log("Checking if user exists in Firestore:", user.uid);
    const userExists = await checkIfUserExists(user.uid);
    
    if (!userExists) {
      console.log("New Google user, creating Firestore profile");
      // Create a user profile for new Google sign-ins
      const username = user.displayName?.split(" ")[0]?.toLowerCase() || 
                       user.email?.split("@")[0] || 
                       "user" + Math.floor(Math.random() * 10000);
      
      // Create user profile document structure 
      const userData = {
        uid: user.uid,
        email: user.email!,
        username: username,
        fullName: user.displayName || undefined,
        role: "user",
        twoFactorEnabled: false,
        photoURL: user.photoURL || undefined,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp
      };
      
      // Create user profile in Firestore with explicit document ID
      const userDocRef = getUserDocRef(user.uid);
      await setDoc(userDocRef, userData);
      
      console.log("User profile created in Firestore for Google user:", user.uid);
    } else {
      console.log("Existing Google user, updating login timestamp");
      // Update the last login time
      await updateUserProfile(user.uid, {
        updatedAt: serverTimestamp() as Timestamp
      });
    }
    
    return user;
  } catch (error: any) {
    console.error("Error signing in with Google:", error);
    
    // Provide specific error messages and troubleshooting steps
    if (error.code === 'auth/popup-blocked') {
      console.error("Google sign-in popup was blocked by your browser. Please allow popups for this site.");
    } else if (error.code === 'auth/popup-closed-by-user') {
      console.error("Google sign-in was cancelled. Please try again.");
    } else if (error.code === 'auth/cancelled-popup-request') {
      console.error("Google sign-in request was cancelled. Please try again.");
    } else if (error.code === 'auth/unauthorized-domain') {
      console.error("This domain is not authorized for Google authentication.");
      console.error("IMPORTANT: Add this exact domain to Firebase console authorized domains: " + window.location.origin);
    }
    
    throw error;
  }
};

/**
 * Sign out the current user
 */
export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

/**
 * Reset password for a user
 */
export const resetPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Error resetting password:", error);
    throw error;
  }
};

/**
 * Create a user profile in Firestore
 */
export const createUserProfile = async (
  uid: string,
  userData: Partial<UserProfile>
): Promise<void> => {
  try {
    const userDocRef = getUserDocRef(uid);
    await setDoc(userDocRef, userData);
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error;
  }
};

/**
 * Update a user profile in Firestore
 */
export const updateUserProfile = async (
  uid: string,
  userData: Partial<UserProfile>
): Promise<void> => {
  try {
    const userDocRef = getUserDocRef(uid);
    await updateDoc(userDocRef, {
      ...userData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
};

/**
 * Get a user profile from Firestore
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDocRef = getUserDocRef(uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
};

/**
 * Check if a user exists in Firestore
 */
export const checkIfUserExists = async (uid: string): Promise<boolean> => {
  try {
    const userDocRef = getUserDocRef(uid);
    const userDoc = await getDoc(userDocRef);
    return userDoc.exists();
  } catch (error) {
    console.error("Error checking if user exists:", error);
    return false;
  }
};

/**
 * Enable or disable two-factor authentication for a user
 */
export const setTwoFactorAuthentication = async (
  uid: string,
  enabled: boolean
): Promise<void> => {
  try {
    await updateUserProfile(uid, {
      twoFactorEnabled: enabled
    });
  } catch (error) {
    console.error("Error setting two-factor authentication:", error);
    throw error;
  }
};