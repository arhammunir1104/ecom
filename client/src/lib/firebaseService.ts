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
    // Create the user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update the user's display name in Auth
    await updateProfile(user, {
      displayName: username
    });
    
    // Create user profile in Firestore
    await createUserProfile(user.uid, {
      uid: user.uid,
      email: email,
      username: username,
      fullName: fullName || username,
      role: "user",
      twoFactorEnabled: false,
      photoURL: user.photoURL || undefined,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp
    });
    
    console.log("User created successfully:", user.uid);
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
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error signing in:", error);
    throw error;
  }
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<FirebaseUser> => {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: "select_account"
    });
    
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Check if this is a new user (first time sign in)
    const userExists = await checkIfUserExists(user.uid);
    
    if (!userExists) {
      // Create a user profile for new Google sign-ins
      const username = user.displayName?.split(" ")[0]?.toLowerCase() || 
                       user.email?.split("@")[0] || 
                       "user" + Math.floor(Math.random() * 10000);
      
      await createUserProfile(user.uid, {
        uid: user.uid,
        email: user.email!,
        username: username,
        fullName: user.displayName || undefined,
        role: "user",
        twoFactorEnabled: false,
        photoURL: user.photoURL || undefined,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp
      });
    } else {
      // Update the last login time
      await updateUserProfile(user.uid, {
        updatedAt: serverTimestamp() as Timestamp
      });
    }
    
    return user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
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