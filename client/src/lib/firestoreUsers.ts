import { collection, query, getDocs, doc, setDoc, getDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

export const USERS_COLLECTION = "users";

export interface FirestoreUser {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
  photoURL?: string;
  role: "admin" | "user";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  twoFactorEnabled?: boolean;
  phoneNumber?: string;
  [key: string]: any;
}

/**
 * Get all users directly from Firestore
 */
export const getAllFirestoreUsers = async (): Promise<FirestoreUser[]> => {
  try {
    console.log("Fetching all users directly from Firestore");
    const usersRef = collection(db, USERS_COLLECTION);
    const usersSnapshot = await getDocs(usersRef);
    
    if (usersSnapshot.empty) {
      console.log("No users found in Firestore");
      return [];
    }
    
    const users: FirestoreUser[] = [];
    usersSnapshot.forEach((doc) => {
      const userData = doc.data() as FirestoreUser;
      users.push({
        ...userData,
        uid: doc.id, // Ensure uid is set to document ID
        role: userData.role || "user" // Default role if not set
      });
    });
    
    console.log(`Found ${users.length} users in Firestore`);
    return users;
  } catch (error) {
    console.error("Error fetching users from Firestore:", error);
    throw error;
  }
};

/**
 * Update a user's role directly in Firestore
 */
export const updateUserRole = async (uid: string, role: "admin" | "user"): Promise<void> => {
  try {
    console.log(`Directly updating user ${uid} role to ${role}`);
    
    // Get direct Firestore reference to the user document
    const userRef = doc(db, USERS_COLLECTION, uid);
    
    // Update the role field with merge option
    await setDoc(userRef, {
      role: role,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log(`User role updated successfully to ${role}`);
  } catch (error) {
    console.error("Error updating user role:", error);
    throw error;
  }
};

/**
 * Get a single user by UID
 */
export const getFirestoreUser = async (uid: string): Promise<FirestoreUser | null> => {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, uid));
    
    if (!userDoc.exists()) {
      console.log(`No user found with uid: ${uid}`);
      return null;
    }
    
    const userData = userDoc.data() as FirestoreUser;
    return {
      ...userData,
      uid: userDoc.id, // Ensure uid is set to document ID
      role: userData.role || "user" // Default role if not set
    };
  } catch (error) {
    console.error(`Error getting user with uid ${uid}:`, error);
    throw error;
  }
};