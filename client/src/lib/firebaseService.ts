import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser,
  signInWithCustomToken
} from "firebase/auth";
import axios from "axios";
import { 
  collection,
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  query,
  where,
  updateDoc, 
  addDoc,
  deleteDoc,
  serverTimestamp, 
  Timestamp,
  orderBy,
  limit,
  startAfter
} from "firebase/firestore";
import { auth, db } from "./firebase";

// Collections
const USERS_COLLECTION = "users";
const CARTS_COLLECTION = "carts";
const ORDERS_COLLECTION = "orders";
const WISHLIST_COLLECTION = "wishlists";
const PRODUCTS_COLLECTION = "products";
const CATEGORIES_COLLECTION = "categories";
const HERO_BANNERS_COLLECTION = "hero-banners";

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

export interface Product {
  id: number | string;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  categoryId?: number | string;
  images: string[];
  sizes: string[];
  colors: string[];
  stock: number;
  featured: boolean;
  trending: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Category {
  id: number | string;
  name: string;
  image?: string;
  description?: string;
  featured: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CartItem {
  productId: number | string;
  quantity: number;
  name: string;
  price: number;
  discountPrice?: number | null;
  image?: string;
  size?: string;
  color?: string;
}

export type CartItems = Record<string, CartItem>;

export interface Cart {
  userId: string;
  items: CartItems;
  updatedAt: Timestamp;
}

export interface OrderItem extends CartItem {
  subtotal: number;
}

export interface Order {
  id?: string;
  userId: string;
  items: OrderItem[];
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  orderDate: Timestamp;
  trackingNumber?: string;
  notes?: string;
}

export interface WishlistItem {
  productId: number | string;
  name: string;
  price: number;
  discountPrice?: number | null;
  image?: string;
  addedAt: Timestamp;
}

export interface Wishlist {
  userId: string;
  items: WishlistItem[];
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
    // First check if the email already exists in Firebase
    try {
      // We'll attempt to authenticate with a dummy password to see if the user exists
      // This will fail with auth/wrong-password if the user exists, or auth/user-not-found if they don't
      await signInWithEmailAndPassword(auth, email, "dummy-password-for-check-only");
      
      // If we get here, the password was wrong but the user exists
      throw new Error("Email already exists in Firebase");
    } catch (checkError: any) {
      // If we get auth/user-not-found, the email is available
      if (checkError.code !== 'auth/user-not-found') {
        console.log("Email check result:", checkError.code);
        
        // If it's auth/wrong-password, the user exists
        if (checkError.code === 'auth/wrong-password' || checkError.code === 'auth/invalid-credential') {
          const error = new Error("Email already in use");
          // @ts-ignore
          error.code = 'auth/email-already-in-use';
          throw error;
        }
        
        // For other errors, continue with registration as they're likely unrelated
        if (checkError.message === "Email already exists in Firebase") {
          const error = new Error("Email already in use");
          // @ts-ignore
          error.code = 'auth/email-already-in-use';
          throw error;
        }
      }
    }
    
    console.log("Email is available, creating new user in Firebase Authentication:", email);
    
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
    
    // Synchronize with backend server - use the most direct method
    try {
      console.log("Syncing new Firebase user with backend server...");
      
      // Try first with the /api/auth/google endpoint which handles Firebase UIDs
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: username,
          email: email,
          uid: user.uid,
          photoURL: user.photoURL
        }),
      });
      
      if (response.ok) {
        console.log("User synchronized with backend server successfully via Google endpoint");
      } else {
        // If that fails, try the direct login endpoint
        console.warn("Failed to sync with Google endpoint, trying login endpoint...");
        
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
            password: 'firebase-auth', // This won't be used when firebaseUid is provided
            firebaseUid: user.uid,
            recaptchaToken: 'firebase-auth' // This is a special bypass token for Firebase auth
          }),
        });
        
        if (loginResponse.ok) {
          console.log("User synchronized with backend server successfully via login endpoint");
        } else {
          const errorData = await loginResponse.json();
          console.warn("Failed to sync user with backend server:", errorData);
          // If the backend says the email already exists, we need to clean up the Firebase user
          if (errorData.message === "Email already in use") {
            console.error("Email already exists in backend but not in Firebase, cleaning up Firebase user");
            // Delete the Firebase user if backend sync fails with email already in use
            try {
              await user.delete();
            } catch (deleteError) {
              console.error("Failed to delete Firebase user after sync failure:", deleteError);
            }
            throw new Error("Email already in use in the system");
          }
        }
      }
    } catch (syncError: any) {
      console.error("Error syncing with backend:", syncError);
      
      // If this is a critical error about email already in use, propagate it
      if (syncError.message === "Email already in use in the system") {
        const error = new Error("Email already in use");
        // @ts-ignore
        error.code = 'auth/email-already-in-use';
        throw error;
      }
      
      // Otherwise, continue with signup as this sync is non-critical
    }
    
    return user;
  } catch (error: any) {
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
    
    // Use the signInWithGoogle implementation from firebase.ts
    // which uses the proper environment variables
    const { signInWithGoogle: firebaseSignInWithGoogle } = await import("./firebase");
    const user = await firebaseSignInWithGoogle();
    
    if (!user) {
      throw new Error("Failed to sign in with Google - no user returned");
    }
    
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
      
      // Synchronize with backend server
      try {
        console.log("Syncing Google user with backend server...");
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            displayName: user.displayName,
            email: user.email,
            uid: user.uid,
            photoURL: user.photoURL
          }),
        });
        
        if (response.ok) {
          console.log("Google user synchronized with backend server successfully");
        } else {
          console.warn("Failed to sync Google user with backend server:", await response.json());
        }
      } catch (syncError) {
        console.error("Error syncing Google user with backend:", syncError);
        // Non-critical, continue with signup
      }
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
 * Reset password for a user - sends email with reset link
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
 * Update password for a user
 * @param currentPassword The user's current password
 * @param newPassword The new password to set
 */
export const updateUserPassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    
    if (!user || !user.email) {
      console.error("No authenticated user found");
      return false;
    }
    
    try {
      // First re-authenticate the user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Then update the password
      await updatePassword(user, newPassword);
      console.log("Password updated successfully");
      return true;
    } catch (error: any) {
      console.error("Error updating password:", error);
      
      if (error.code === 'auth/wrong-password') {
        throw new Error("Current password is incorrect");
      } else if (error.code === 'auth/requires-recent-login') {
        throw new Error("For security reasons, please log in again before changing your password");
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error("Password update failed:", error);
    throw error;
  }
};

/**
 * Update password with reset workflow (for forgotten passwords)
 * No need for current password, but requires verified reset token
 */
export const resetPasswordWithOTP = async (email: string, newPassword: string, resetCode: string): Promise<boolean> => {
  try {
    console.log(`Processing password reset for ${email} with verification code`);
    
    // Step 1: Verify the reset code is valid through our backend
    console.log('Verifying reset code with backend server...');
    const verifyResponse = await axios.post('/api/auth/verify-reset-code', {
      email,
      code: resetCode
    });
    
    if (!verifyResponse.data || !verifyResponse.data.success) {
      console.error('Invalid or expired reset code');
      return false;
    }
    
    console.log('Reset code verified, proceeding with password reset');
    
    // Step 2: Try the Admin API first (most reliable approach)
    // This will update both Firebase and PostgreSQL in one go if the server has proper Firebase admin credentials
    try {
      console.log('Attempting to reset password via server Admin API...');
      const adminResetResponse = await axios.post('/api/auth/firebase-password-reset', {
        email,
        newPassword,
        resetDocId: resetCode
      });
      
      if (adminResetResponse.data && adminResetResponse.data.success) {
        console.log('Password reset successful via Admin API');
        
        // Double-check sync with PostgreSQL for redundancy
        try {
          console.log('Ensuring PostgreSQL database is synced...');
          await axios.post('/api/auth/sync-password', {
            email,
            password: newPassword,
            forceSyncAll: true // Ensure both datastores are updated
          });
          console.log('Password sync with PostgreSQL confirmed');
        } catch (syncError) {
          console.warn('Additional PostgreSQL sync failed but initial reset was successful:', syncError);
          // Continue since the main reset worked
        }
        
        return true;
      }
      
      if (adminResetResponse.data && adminResetResponse.data.clientSideFallback) {
        console.log('Admin API requested client-side fallback:', adminResetResponse.data.message);
        // Continue to client-side methods
      } else if (adminResetResponse.status !== 200) {
        throw new Error(`Admin API error: ${adminResetResponse.data?.message || 'Unknown error'}`);
      }
    } catch (adminApiError) {
      console.warn('Admin API error, trying alternative methods:', adminApiError);
    }
    
    // Step 3: Try the sync-password endpoint explicitly 
    // This is the most direct way to update both systems
    try {
      console.log('Using direct sync-password endpoint to update both databases...');
      const syncResponse = await axios.post('/api/auth/sync-password', {
        email,
        password: newPassword,
        forceSyncAll: true // Critical flag to ensure BOTH Firebase and PostgreSQL are updated
      });
      
      if (syncResponse.data && syncResponse.data.success) {
        console.log('Password successfully synced across all databases');
        return true;
      }
    } catch (syncError) {
      console.warn('Direct password sync failed, will try more methods:', syncError);
    }
    
    // Step 4: Try using a temporary token to sign in and update password
    try {
      console.log('Attempting temporary token authentication method...');
      const userCredential = await axios.post('/api/auth/get-temp-token', {
        email,
        resetCode
      });
      
      if (userCredential.data && userCredential.data.token) {
        // Sign in with the temporary token
        await signInWithCustomToken(auth, userCredential.data.token);
        
        // Now we're signed in, we can update the password
        const currentUser = auth.currentUser;
        if (currentUser) {
          await updatePassword(currentUser, newPassword);
          console.log('Firebase password updated successfully via temporary auth');
          
          // Make sure to sync with PostgreSQL
          try {
            await axios.post('/api/auth/sync-password', {
              email,
              uid: currentUser.uid,
              password: newPassword,
              forceSyncAll: true
            });
            console.log('Password successfully synced with PostgreSQL database');
          } catch (syncError) {
            console.warn('Error syncing with PostgreSQL after Firebase update:', syncError);
            // Continue anyway since Firebase auth is updated
          }
          
          // Sign out after password change
          await firebaseSignOut(auth);
          return true;
        }
      }
    } catch (tempAuthError) {
      console.warn('Temporary auth method failed:', tempAuthError);
    }
    
    // Step 5: Last resort - standard password reset email flow
    console.log('Falling back to standard password reset email flow...');
    await sendPasswordResetEmail(auth, email);
    
    // Also make one final attempt to update the PostgreSQL database directly
    try {
      await axios.post('/api/auth/sync-password', {
        email,
        password: newPassword,
        forceSyncAll: true
      });
      console.log('Final attempt to sync PostgreSQL password succeeded');
    } catch (finalSyncError) {
      console.warn('Final PostgreSQL sync attempt failed:', finalSyncError);
    }
    
    // Update the reset document in Firestore if ID is provided
    if (resetCode && resetCode.length > 10) { // Likely a Firestore doc ID not just a code
      try {
        const resetDocRef = doc(db, "passwordResets", resetCode);
        await updateDoc(resetDocRef, {
          resetComplete: true,
          resetCompletedAt: new Date(),
        });
      } catch (docError) {
        console.warn('Error updating reset document:', docError);
      }
    }
    
    console.log("Password reset email sent as fallback to:", email);
    return true;
  } catch (error) {
    console.error("Error processing password reset:", error);
    return false;
  }
};

/**
 * Send OTP email for password reset
 */
export const sendOTP = async (email: string, otp: string): Promise<void> => {
  try {
    // Send email with OTP via Firebase's custom email sending
    // For this demo, we'll use a cloud function or other email service
    // Here we're using Firebase Functions method
    
    const response = await fetch("https://us-central1-burger-c0af3.cloudfunctions.net/sendOtpEmail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        otp,
        subject: "Your Password Reset Code",
        storeName: "Feminine Elegance",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to send OTP email");
    }
  } catch (error) {
    console.error("Error sending OTP:", error);
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
    // Remove undefined values to prevent Firestore errors
    const cleanUserData: Record<string, any> = {};
    Object.entries(userData).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanUserData[key] = value;
      }
    });
    
    const userDocRef = getUserDocRef(uid);
    await setDoc(userDocRef, cleanUserData);
    
    // Synchronize with backend server if we have enough data
    if (userData.email) {
      try {
        console.log("Syncing user profile with backend server...");
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            displayName: userData.fullName || userData.username || "",
            email: userData.email,
            uid: uid,
            photoURL: userData.photoURL || null
          }),
        });
        
        if (response.ok) {
          console.log("User profile synchronized with backend server successfully");
        } else {
          console.warn("Failed to sync user profile with backend server:", await response.json());
        }
      } catch (syncError) {
        console.error("Error syncing profile with backend:", syncError);
        // Non-critical, continue with operation
      }
    }
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
    // Remove undefined values to prevent Firestore errors
    const cleanUserData: Record<string, any> = {};
    Object.entries(userData).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanUserData[key] = value;
      }
    });
    
    const userDocRef = getUserDocRef(uid);
    await updateDoc(userDocRef, {
      ...cleanUserData,
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

/**
 * Update a user's role (admin or user) directly in Firestore 
 * This is a more reliable method that bypasses server authentication issues
 * by using the client's authentication.
 */
export const updateUserRole = async (
  uid: string,
  role: "admin" | "user"
): Promise<void> => {
  try {
    console.log(`Directly updating user ${uid} role to ${role}`);
    
    // Get direct Firestore reference to the user document
    const userRef = doc(db, USERS_COLLECTION, uid);
    
    // Simply update the role field with merge option
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

// ===================== CART FUNCTIONS =====================

/**
 * Helper function to get the cart document reference for a user
 */
const getCartDocRef = (userId: string) => doc(db, CARTS_COLLECTION, userId);

/**
 * Get a user's cart from Firestore
 */
export const getUserCart = async (userId: string): Promise<Cart | null> => {
  try {
    const cartDocRef = getCartDocRef(userId);
    const cartDoc = await getDoc(cartDocRef);
    
    if (cartDoc.exists()) {
      return cartDoc.data() as Cart;
    }
    
    // Create a new empty cart if one doesn't exist
    const newCart: Cart = {
      userId,
      items: {},
      updatedAt: serverTimestamp() as Timestamp
    };
    
    await setDoc(cartDocRef, newCart);
    console.log("Created new empty cart for user:", userId);
    return newCart;
  } catch (error) {
    console.error("Error getting user cart:", error);
    throw error;
  }
};

/**
 * Add an item to the cart
 */
export const addToCart = async (
  userId: string,
  product: {
    id: number | string;
    name: string;
    price: number;
    image?: string;
  },
  quantity: number = 1,
  options: { size?: string; color?: string } = {}
): Promise<Cart> => {
  try {
    console.log(`Adding product ${product.id} to cart for user ${userId}`);
    const cartDocRef = getCartDocRef(userId);
    
    // Get current cart
    const cartDoc = await getDoc(cartDocRef);
    let cart: Cart;
    
    if (cartDoc.exists()) {
      cart = cartDoc.data() as Cart;
    } else {
      // Create a new cart if it doesn't exist
      cart = {
        userId,
        items: {},
        updatedAt: serverTimestamp() as Timestamp
      };
    }
    
    // Add or update item quantity
    const productId = product.id.toString();
    if (cart.items[productId]) {
      // Update existing item
      cart.items[productId].quantity += quantity;
    } else {
      // Add new item
      cart.items[productId] = {
        productId: product.id,
        name: product.name,
        price: product.price,
        discountPrice: product.discountPrice,
        quantity,
        image: product.image || "",  // Ensure image is never undefined
        ...options
      };
    }
    
    // Update cart in Firestore
    await setDoc(cartDocRef, {
      ...cart,
      updatedAt: serverTimestamp()
    });
    
    console.log("Cart updated successfully");
    console.log("Cart saved to Firestore successfully");
    return cart;
  } catch (error) {
    console.error("Error adding to cart:", error);
    throw error;
  }
};

/**
 * Update cart item quantity
 */
export const updateCartItemQuantity = async (
  userId: string,
  productId: number | string,
  quantity: number
): Promise<Cart> => {
  try {
    const cartDocRef = getCartDocRef(userId);
    const cartDoc = await getDoc(cartDocRef);
    
    if (!cartDoc.exists()) {
      throw new Error("Cart not found");
    }
    
    const cart = cartDoc.data() as Cart;
    const productIdStr = productId.toString();
    
    if (!cart.items[productIdStr]) {
      throw new Error("Product not in cart");
    }
    
    if (quantity <= 0) {
      // Remove item from cart if quantity is zero or negative
      delete cart.items[productIdStr];
    } else {
      // Update quantity
      cart.items[productIdStr].quantity = quantity;
    }
    
    // Update cart in Firestore
    await setDoc(cartDocRef, {
      ...cart,
      updatedAt: serverTimestamp()
    });
    
    console.log(`Updated quantity for product ${productId} to ${quantity}`);
    return cart;
  } catch (error) {
    console.error("Error updating cart item quantity:", error);
    throw error;
  }
};

/**
 * Remove an item from the cart
 */
export const removeFromCart = async (
  userId: string,
  productId: number | string
): Promise<Cart> => {
  try {
    const cartDocRef = getCartDocRef(userId);
    const cartDoc = await getDoc(cartDocRef);
    
    if (!cartDoc.exists()) {
      throw new Error("Cart not found");
    }
    
    const cart = cartDoc.data() as Cart;
    const productIdStr = productId.toString();
    
    if (!cart.items[productIdStr]) {
      throw new Error("Product not in cart");
    }
    
    // Remove the item
    delete cart.items[productIdStr];
    
    // Update cart in Firestore
    await setDoc(cartDocRef, {
      ...cart,
      updatedAt: serverTimestamp()
    });
    
    console.log(`Removed product ${productId} from cart`);
    return cart;
  } catch (error) {
    console.error("Error removing from cart:", error);
    throw error;
  }
};

/**
 * Clear the entire cart
 */
export const clearCart = async (userId: string): Promise<void> => {
  try {
    const cartDocRef = getCartDocRef(userId);
    
    // Create a new empty cart
    const emptyCart: Cart = {
      userId,
      items: {},
      updatedAt: serverTimestamp() as Timestamp
    };
    
    await setDoc(cartDocRef, emptyCart);
    console.log("Cart cleared successfully");
  } catch (error) {
    console.error("Error clearing cart:", error);
    throw error;
  }
};

// ===================== ORDER FUNCTIONS =====================

/**
 * Create a new order from cart items
 */
export const createOrderFromCart = async (
  userId: string,
  shippingAddress: Order['shippingAddress'],
  paymentMethod: string
): Promise<Order> => {
  try {
    console.log("Creating new order for user:", userId);
    
    // Get the user's cart
    const cart = await getUserCart(userId);
    
    if (!cart || Object.keys(cart.items).length === 0) {
      throw new Error("Cannot create order from empty cart");
    }
    
    // Calculate total and create order items
    let totalAmount = 0;
    const orderItems: OrderItem[] = [];
    
    Object.values(cart.items).forEach(item => {
      // Use discounted price if available, otherwise use regular price
      const effectivePrice = item.discountPrice !== undefined && item.discountPrice !== null 
        ? item.discountPrice 
        : item.price;
      
      const subtotal = effectivePrice * item.quantity;
      totalAmount += subtotal;
      
      orderItems.push({
        ...item,
        subtotal
      });
    });
    
    // Create new order
    const newOrder: Order = {
      userId,
      items: orderItems,
      totalAmount,
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod,
      shippingAddress,
      orderDate: serverTimestamp() as Timestamp
    };
    
    // Add order to Firestore
    const orderRef = await addDoc(collection(db, ORDERS_COLLECTION), newOrder);
    
    // Update the order with the generated ID
    const orderWithId: Order = {
      ...newOrder,
      id: orderRef.id
    };
    
    await updateDoc(orderRef, { id: orderRef.id });
    console.log("New order created with ID:", orderRef.id);
    
    // Clear the cart after successful order creation
    await clearCart(userId);
    
    return orderWithId;
  } catch (error) {
    console.error("Error creating order:", error);
    throw error;
  }
};

/**
 * Get all orders for a user
 */
export const getUserOrders = async (userId: string): Promise<Order[]> => {
  try {
    // Step 1: Try to get orders from user subcollection (new structure)
    console.log(`Fetching orders for user ${userId} from user subcollection...`);
    const userOrdersRef = collection(db, 'users', userId, 'orders');
    const userOrdersQuery = query(userOrdersRef);
    
    try {
      const userOrdersSnapshot = await getDocs(userOrdersQuery);
      
      if (!userOrdersSnapshot.empty) {
        console.log(`Found ${userOrdersSnapshot.size} orders in user subcollection`);
        const orders: Order[] = [];
        
        userOrdersSnapshot.forEach((doc) => {
          const data = doc.data();
          orders.push({
            id: doc.id,
            ...data,
            // Convert Timestamp to Date if needed
            orderDate: data.orderDate instanceof Timestamp 
              ? data.orderDate.toDate() 
              : data.createdAt instanceof Timestamp 
                ? data.createdAt.toDate() 
                : new Date(),
            items: data.items || []
          } as Order);
        });
        
        // Sort by date, newest first
        return orders.sort((a, b) => {
          const dateA = a.orderDate ? new Date(a.orderDate).getTime() : 0;
          const dateB = b.orderDate ? new Date(b.orderDate).getTime() : 0;
          return dateB - dateA;
        });
      }
    } catch (subcollectionError) {
      console.warn("Error accessing user subcollection orders:", subcollectionError);
      // Continue to try other methods
    }
    
    // Step 2: Try the root orders collection (old structure)
    console.log(`Trying root orders collection for user ${userId}...`);
    const ordersQuery = query(
      collection(db, ORDERS_COLLECTION),
      where("userId", "==", userId)
    );
    
    const ordersSnapshot = await getDocs(ordersQuery);
    const orders: Order[] = [];
    
    if (!ordersSnapshot.empty) {
      console.log(`Found ${ordersSnapshot.size} orders in root collection`);
      
      ordersSnapshot.forEach((doc) => {
        const data = doc.data();
        orders.push({
          id: doc.id,
          ...data,
          // Convert Timestamp to Date if needed
          orderDate: data.orderDate instanceof Timestamp 
            ? data.orderDate.toDate() 
            : data.createdAt instanceof Timestamp 
              ? data.createdAt.toDate() 
              : new Date(),
          items: data.items || []
        } as Order);
      });
      
      // Sort by date, newest first
      return orders.sort((a, b) => {
        const dateA = a.orderDate ? new Date(a.orderDate).getTime() : 0;
        const dateB = b.orderDate ? new Date(b.orderDate).getTime() : 0;
        return dateB - dateA;
      });
    }
    
    // Step 3: Try the API as a fallback for database orders
    console.log("No orders found in Firebase, trying API...");
    try {
      const response = await fetch(`/api/users/${userId}/orders`);
      if (response.ok) {
        const apiOrders = await response.json();
        console.log(`Found ${apiOrders.length} orders via API`);
        return apiOrders;
      }
    } catch (apiError) {
      console.warn("Error fetching orders from API:", apiError);
    }
    
    console.log("No orders found for user");
    return [];
  } catch (error) {
    console.error("Error getting user orders:", error);
    throw error;
  }
};

/**
 * Get order details
 */
/**
 * Save a new order to Firestore and clear the user's cart
 */
export const saveOrder = async (
  userId: string, 
  orderData: {
    items: Array<{
      productId: number | string;
      quantity: number;
      name?: string;
      price?: number;
      image?: string;
    }>;
    totalAmount: number;
    status: string;
    paymentStatus: string;
    paymentIntent: string;
    shippingAddress: {
      fullName: string;
      address: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      phone: string;
    };
  }
): Promise<Order> => {
  try {
    console.log(`Saving order for user ${userId}`, orderData);
    
    // Create a reference to the user's orders subcollection
    const userOrdersRef = collection(db, 'users', userId, 'orders');
    const orderDocRef = doc(userOrdersRef);
    
    // Prepare the order data with timestamp and ID
    const order: Order = {
      id: orderDocRef.id,
      userId,
      items: orderData.items,
      totalAmount: orderData.totalAmount,
      status: orderData.status,
      paymentStatus: orderData.paymentStatus,
      paymentIntent: orderData.paymentIntent,
      shippingAddress: orderData.shippingAddress,
      orderDate: serverTimestamp() as any,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
      trackingNumber: null
    };
    
    // Save the order to Firestore
    await setDoc(orderDocRef, order);
    
    // Also save to the root orders collection for backward compatibility
    await setDoc(doc(db, ORDERS_COLLECTION, orderDocRef.id), order);
    
    // Clear the user's cart after successful order
    await clearCart(userId);
    
    console.log(`Order saved successfully with ID: ${orderDocRef.id}`);
    return order;
  } catch (error) {
    console.error("Error saving order:", error);
    throw error;
  }
};

export const getOrderDetails = async (orderId: string): Promise<Order | null> => {
  try {
    const orderDoc = await getDoc(doc(db, ORDERS_COLLECTION, orderId));
    
    if (orderDoc.exists()) {
      return orderDoc.data() as Order;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting order details:", error);
    throw error;
  }
};

/**
 * Update order status
 */
export const updateOrderStatus = async (
  orderId: string,
  status: Order['status']
): Promise<void> => {
  try {
    const orderRef = doc(db, ORDERS_COLLECTION, orderId);
    await updateDoc(orderRef, {
      status,
      updatedAt: serverTimestamp()
    });
    
    console.log(`Updated order ${orderId} status to ${status}`);
  } catch (error) {
    console.error("Error updating order status:", error);
    throw error;
  }
};

/**
 * Update payment status
 */
export const updatePaymentStatus = async (
  orderId: string,
  paymentStatus: Order['paymentStatus']
): Promise<void> => {
  try {
    const orderRef = doc(db, ORDERS_COLLECTION, orderId);
    await updateDoc(orderRef, {
      paymentStatus,
      updatedAt: serverTimestamp()
    });
    
    console.log(`Updated order ${orderId} payment status to ${paymentStatus}`);
  } catch (error) {
    console.error("Error updating payment status:", error);
    throw error;
  }
};

/**
 * Get all orders (admin function)
 */
export const getAllOrders = async (
  limitCount: number = 100,
  startAfterTimestamp?: Timestamp
): Promise<Order[]> => {
  try {
    // Avoid using orderBy and get all orders
    const ordersQuery = query(
      collection(db, ORDERS_COLLECTION)
    );
    
    const ordersSnapshot = await getDocs(ordersQuery);
    const orders: Order[] = [];
    
    ordersSnapshot.forEach((doc) => {
      orders.push(doc.data() as Order);
    });
    
    // Sort manually in memory to avoid needing an index - newest first (descending)
    const sortedOrders = orders.sort((a, b) => {
      // Convert Timestamp to milliseconds for comparison
      const dateA = a.orderDate instanceof Timestamp ? a.orderDate.toMillis() : a.orderDate;
      const dateB = b.orderDate instanceof Timestamp ? b.orderDate.toMillis() : b.orderDate;
      return dateB - dateA; // Descending order (newest first)
    });
    
    // Handle pagination manually
    if (startAfterTimestamp) {
      const startAfterMillis = startAfterTimestamp.toMillis();
      const filteredOrders = sortedOrders.filter(order => {
        const orderMillis = order.orderDate instanceof Timestamp ? 
          order.orderDate.toMillis() : order.orderDate;
        return orderMillis < startAfterMillis;
      });
      
      return filteredOrders.slice(0, limitCount);
    }
    
    // Return first page with limit
    return sortedOrders.slice(0, limitCount);
  } catch (error) {
    console.error("Error getting all orders:", error);
    throw error;
  }
};

// ===================== PRODUCT FUNCTIONS =====================

/**
 * Helper function to get a product document reference
 */
const getProductDocRef = (productId: number | string) => doc(db, PRODUCTS_COLLECTION, productId.toString());

/**
 * Create a new product in Firestore
 */
export const createProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> => {
  try {
    console.log("Creating new product in Firestore");
    
    // Get all products first
    const productsQuery = query(collection(db, PRODUCTS_COLLECTION));
    const productsSnapshot = await getDocs(productsQuery);
    
    let nextId = 1;
    if (!productsSnapshot.empty) {
      // Find the highest ID manually
      let highestId = 0;
      productsSnapshot.forEach((doc) => {
        const product = doc.data() as Product;
        const productId = typeof product.id === 'string' ? parseInt(product.id, 10) : product.id;
        if (productId > highestId) {
          highestId = productId;
        }
      });
      nextId = highestId + 1;
    }
    
    // Create the product with auto-generated ID and timestamps
    const newProduct: Product = {
      ...productData,
      id: nextId,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp
    };
    
    // Save to Firestore with the ID as the document ID
    const productDocRef = getProductDocRef(nextId);
    await setDoc(productDocRef, newProduct);
    
    console.log(`Product created successfully with ID: ${nextId}`);
    return newProduct;
  } catch (error) {
    console.error("Error creating product:", error);
    throw error;
  }
};

/**
 * Get all products from Firestore
 */
export const getAllProducts = async (): Promise<Product[]> => {
  try {
    // Get all products without any ordering to avoid index requirements
    const productsQuery = query(collection(db, PRODUCTS_COLLECTION));
    const productsSnapshot = await getDocs(productsQuery);
    
    const products: Product[] = [];
    productsSnapshot.forEach((doc) => {
      products.push(doc.data() as Product);
    });
    
    // Sort manually in memory to avoid needing an index
    const sortedProducts = products.sort((a, b) => {
      const idA = typeof a.id === 'number' ? a.id : parseInt(a.id as string);
      const idB = typeof b.id === 'number' ? b.id : parseInt(b.id as string);
      return idA - idB;
    });
    
    return sortedProducts;
  } catch (error) {
    console.error("Error getting all products:", error);
    return [];
  }
};

/**
 * Get a single product by ID
 */
export const getProductById = async (productId: number | string): Promise<Product | null> => {
  try {
    const productDocRef = getProductDocRef(productId);
    const productDoc = await getDoc(productDocRef);
    
    if (productDoc.exists()) {
      return productDoc.data() as Product;
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting product ${productId}:`, error);
    return null;
  }
};

/**
 * Get featured products
 */
export const getFeaturedProducts = async (): Promise<Product[]> => {
  try {
    // Simplify the query to avoid composite index requirements
    const productsQuery = query(
      collection(db, PRODUCTS_COLLECTION),
      where("featured", "==", true)
    );
    
    const productsSnapshot = await getDocs(productsQuery);
    
    const products: Product[] = [];
    productsSnapshot.forEach((doc) => {
      products.push(doc.data() as Product);
    });
    
    // Sort manually in memory to avoid needing a composite index
    return products.sort((a, b) => {
      const idA = typeof a.id === 'number' ? a.id : parseInt(a.id as string);
      const idB = typeof b.id === 'number' ? b.id : parseInt(b.id as string);
      return idA - idB;
    });
  } catch (error) {
    console.error("Error getting featured products:", error);
    return [];
  }
};

/**
 * Get trending products
 */
export const getTrendingProducts = async (): Promise<Product[]> => {
  try {
    // Simplify the query to avoid composite index requirements
    const productsQuery = query(
      collection(db, PRODUCTS_COLLECTION),
      where("trending", "==", true)
    );
    
    const productsSnapshot = await getDocs(productsQuery);
    
    const products: Product[] = [];
    productsSnapshot.forEach((doc) => {
      products.push(doc.data() as Product);
    });
    
    // Sort manually in memory to avoid needing a composite index
    return products.sort((a, b) => {
      const idA = typeof a.id === 'number' ? a.id : parseInt(a.id as string);
      const idB = typeof b.id === 'number' ? b.id : parseInt(b.id as string);
      return idA - idB;
    });
  } catch (error) {
    console.error("Error getting trending products:", error);
    return [];
  }
};

/**
 * Update a product
 */
export const updateProduct = async (
  productId: number | string,
  productData: Partial<Product>
): Promise<Product | null> => {
  try {
    const productDocRef = getProductDocRef(productId);
    const productDoc = await getDoc(productDocRef);
    
    if (!productDoc.exists()) {
      console.error(`Product ${productId} not found`);
      return null;
    }
    
    const updatedProduct = {
      ...productData,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(productDocRef, updatedProduct);
    
    // Get the updated document
    const updatedDoc = await getDoc(productDocRef);
    return updatedDoc.data() as Product;
  } catch (error) {
    console.error(`Error updating product ${productId}:`, error);
    return null;
  }
};

/**
 * Delete a product
 */
export const deleteProduct = async (productId: number | string): Promise<boolean> => {
  try {
    const productDocRef = getProductDocRef(productId);
    await deleteDoc(productDocRef);
    console.log(`Product ${productId} deleted successfully`);
    return true;
  } catch (error) {
    console.error(`Error deleting product ${productId}:`, error);
    return false;
  }
};

/**
 * Get products by category
 */
export const getProductsByCategory = async (categoryId: number | string): Promise<Product[]> => {
  try {
    // Simplify the query to avoid composite index requirements
    const productsQuery = query(
      collection(db, PRODUCTS_COLLECTION),
      where("categoryId", "==", categoryId)
    );
    
    const productsSnapshot = await getDocs(productsQuery);
    
    const products: Product[] = [];
    productsSnapshot.forEach((doc) => {
      products.push(doc.data() as Product);
    });
    
    // Sort manually in memory to avoid needing a composite index
    return products.sort((a, b) => {
      const idA = typeof a.id === 'number' ? a.id : parseInt(a.id as string);
      const idB = typeof b.id === 'number' ? b.id : parseInt(b.id as string);
      return idA - idB;
    });
  } catch (error) {
    console.error(`Error getting products for category ${categoryId}:`, error);
    return [];
  }
};

// ===================== CATEGORY FUNCTIONS =====================

/**
 * Helper function to get a category document reference
 */
const getCategoryDocRef = (categoryId: number | string) => doc(db, CATEGORIES_COLLECTION, categoryId.toString());

/**
 * Create a new category
 */
export const createCategory = async (categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> => {
  try {
    console.log("Creating new category in Firestore");
    
    // Get all categories first
    const categoriesQuery = query(collection(db, CATEGORIES_COLLECTION));
    const categoriesSnapshot = await getDocs(categoriesQuery);
    
    let nextId = 1;
    if (!categoriesSnapshot.empty) {
      // Find the highest ID manually
      let highestId = 0;
      categoriesSnapshot.forEach((doc) => {
        const category = doc.data() as Category;
        const categoryId = typeof category.id === 'string' ? parseInt(category.id, 10) : category.id;
        if (categoryId > highestId) {
          highestId = categoryId;
        }
      });
      nextId = highestId + 1;
    }
    
    // Create the category with auto-generated ID and timestamps
    const newCategory: Category = {
      ...categoryData,
      id: nextId,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp
    };
    
    // Save to Firestore with the ID as the document ID
    const categoryDocRef = getCategoryDocRef(nextId);
    await setDoc(categoryDocRef, newCategory);
    
    console.log(`Category created successfully with ID: ${nextId}`);
    return newCategory;
  } catch (error) {
    console.error("Error creating category:", error);
    throw error;
  }
};

/**
 * Get all categories
 */
export const getAllCategories = async (): Promise<Category[]> => {
  try {
    // Get all categories without any ordering to avoid index requirements
    const categoriesQuery = query(collection(db, CATEGORIES_COLLECTION));
    const categoriesSnapshot = await getDocs(categoriesQuery);
    
    const categories: Category[] = [];
    categoriesSnapshot.forEach((doc) => {
      categories.push(doc.data() as Category);
    });
    
    // Sort manually in memory to avoid needing an index
    const sortedCategories = categories.sort((a, b) => {
      const idA = typeof a.id === 'number' ? a.id : parseInt(a.id as string);
      const idB = typeof b.id === 'number' ? b.id : parseInt(b.id as string);
      return idA - idB;
    });
    
    return sortedCategories;
  } catch (error) {
    console.error("Error getting all categories:", error);
    return [];
  }
};

/**
 * Get featured categories
 */
export const getFeaturedCategories = async (): Promise<Category[]> => {
  try {
    // Simplify the query to avoid composite index requirements
    const categoriesQuery = query(
      collection(db, CATEGORIES_COLLECTION),
      where("featured", "==", true)
    );
    
    const categoriesSnapshot = await getDocs(categoriesQuery);
    
    const categories: Category[] = [];
    categoriesSnapshot.forEach((doc) => {
      categories.push(doc.data() as Category);
    });
    
    // Sort manually in memory to avoid needing a composite index
    return categories.sort((a, b) => {
      const idA = typeof a.id === 'number' ? a.id : parseInt(a.id as string);
      const idB = typeof b.id === 'number' ? b.id : parseInt(b.id as string);
      return idA - idB;
    });
  } catch (error) {
    console.error("Error getting featured categories:", error);
    return [];
  }
};

/**
 * Get a single category by ID
 */
export const getCategoryById = async (categoryId: number | string): Promise<Category | null> => {
  try {
    const categoryDocRef = getCategoryDocRef(categoryId);
    const categoryDoc = await getDoc(categoryDocRef);
    
    if (categoryDoc.exists()) {
      return categoryDoc.data() as Category;
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting category ${categoryId}:`, error);
    return null;
  }
};

/**
 * Update a category
 */
export const updateCategory = async (
  categoryId: number | string,
  categoryData: Partial<Category>
): Promise<Category | null> => {
  try {
    const categoryDocRef = getCategoryDocRef(categoryId);
    const categoryDoc = await getDoc(categoryDocRef);
    
    if (!categoryDoc.exists()) {
      console.error(`Category ${categoryId} not found`);
      return null;
    }
    
    const updatedCategory = {
      ...categoryData,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(categoryDocRef, updatedCategory);
    
    // Get the updated document
    const updatedDoc = await getDoc(categoryDocRef);
    return updatedDoc.data() as Category;
  } catch (error) {
    console.error(`Error updating category ${categoryId}:`, error);
    return null;
  }
};

/**
 * Delete a category
 */
export const deleteCategory = async (categoryId: number | string): Promise<boolean> => {
  try {
    const categoryDocRef = getCategoryDocRef(categoryId);
    await deleteDoc(categoryDocRef);
    console.log(`Category ${categoryId} deleted successfully`);
    return true;
  } catch (error) {
    console.error(`Error deleting category ${categoryId}:`, error);
    return false;
  }
};

// ===================== WISHLIST FUNCTIONS =====================

/**
 * Helper function to get the wishlist document reference for a user
 */
const getWishlistDocRef = (userId: string) => doc(db, WISHLIST_COLLECTION, userId);

/**
 * Get a user's wishlist
 */
export const getUserWishlist = async (userId: string): Promise<Wishlist | null> => {
  try {
    const wishlistDocRef = getWishlistDocRef(userId);
    const wishlistDoc = await getDoc(wishlistDocRef);
    
    if (wishlistDoc.exists()) {
      return wishlistDoc.data() as Wishlist;
    }
    
    // Create a new empty wishlist if one doesn't exist
    const newWishlist: Wishlist = {
      userId,
      items: [],
      updatedAt: Timestamp.fromDate(new Date()) // Use client-side timestamp instead of serverTimestamp()
    };
    
    await setDoc(wishlistDocRef, newWishlist);
    console.log("Created new empty wishlist for user:", userId);
    return newWishlist;
  } catch (error) {
    console.error("Error getting user wishlist:", error);
    throw error;
  }
};

/**
 * Add an item to the wishlist
 */
export const addToWishlist = async (
  userId: string,
  product: {
    id: number | string;
    name: string;
    price: number;
    discountPrice?: number | null;
    image?: string;
  }
): Promise<Wishlist> => {
  try {
    console.log(`Adding product ${product.id} to wishlist for user ${userId}`);
    const wishlistDocRef = getWishlistDocRef(userId);
    
    // Get current wishlist
    const wishlistDoc = await getDoc(wishlistDocRef);
    let wishlist: Wishlist;
    
    if (wishlistDoc.exists()) {
      wishlist = wishlistDoc.data() as Wishlist;
    } else {
      // Create a new wishlist if it doesn't exist
      wishlist = {
        userId,
        items: [],
        updatedAt: Timestamp.fromDate(new Date()) // Use client-side timestamp
      };
    }
    
    // Check if item already exists in wishlist
    const existingItem = wishlist.items.find(item => item.productId === product.id);
    
    if (!existingItem) {
      // Add new item to wishlist with a JavaScript Date instead of serverTimestamp()
      // Ensure prices are stored as number values
      const numericPrice = typeof product.price === 'string' 
        ? parseFloat(product.price) 
        : (typeof product.price === 'number' ? product.price : 0);
      
      // Handle discounted price if it exists
      const numericDiscountPrice = product.discountPrice !== undefined && product.discountPrice !== null
        ? (typeof product.discountPrice === 'string' 
            ? parseFloat(product.discountPrice) 
            : (typeof product.discountPrice === 'number' ? product.discountPrice : null))
        : null;
      
      wishlist.items.push({
        productId: product.id,
        name: product.name,
        price: numericPrice,
        discountPrice: numericDiscountPrice,
        image: product.image,
        addedAt: Timestamp.fromDate(new Date()) // Use client-side timestamp instead of serverTimestamp()
      });
      
      // Update wishlist in Firestore (document-level timestamp is fine)
      await setDoc(wishlistDocRef, {
        ...wishlist,
        updatedAt: serverTimestamp()
      });
      
      console.log("Item added to wishlist successfully");
    } else {
      console.log("Item already exists in wishlist");
    }
    
    return wishlist;
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    throw error;
  }
};

/**
 * Remove an item from the wishlist
 */
export const removeFromWishlist = async (
  userId: string,
  productId: number | string
): Promise<Wishlist> => {
  try {
    const wishlistDocRef = getWishlistDocRef(userId);
    const wishlistDoc = await getDoc(wishlistDocRef);
    
    if (!wishlistDoc.exists()) {
      throw new Error("Wishlist not found");
    }
    
    const wishlist = wishlistDoc.data() as Wishlist;
    
    // Remove the item
    wishlist.items = wishlist.items.filter(item => item.productId !== productId);
    
    // Update wishlist in Firestore
    await setDoc(wishlistDocRef, {
      ...wishlist,
      updatedAt: serverTimestamp()
    });
    
    console.log(`Removed product ${productId} from wishlist`);
    return wishlist;
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    throw error;
  }
};

/**
 * Check if a product is in the wishlist
 */
export const isInWishlist = async (
  userId: string,
  productId: number | string
): Promise<boolean> => {
  try {
    const wishlist = await getUserWishlist(userId);
    
    if (!wishlist) {
      return false;
    }
    
    return wishlist.items.some(item => item.productId === productId);
  } catch (error) {
    console.error("Error checking if item is in wishlist:", error);
    return false;
  }
};

// Review-related types
interface ProductReview {
  id?: string;
  productId: number | string;
  userId: string;
  username: string;
  rating: number;
  comment: string;
  userPhotoURL?: string;
  purchaseVerified: boolean;
  createdAt: Timestamp;
}

interface ReviewsData {
  totalReviews: number;
  averageRating: number;
  lastUpdated: Timestamp;
}

// Review collection references
const getReviewsColRef = () => collection(db, 'reviews');
const getProductReviewsColRef = (productId: number | string) => 
  collection(db, 'products', productId.toString(), 'reviews');
const getProductReviewStatsDocRef = (productId: number | string) => 
  doc(db, 'products', productId.toString());

/**
 * Add a review to a product
 */
export const addProductReview = async (
  userId: string,
  productId: number | string,
  reviewData: {
    rating: number;
    comment: string;
    username: string;
    userPhotoURL?: string;
    purchaseVerified?: boolean;
  }
): Promise<ProductReview> => {
  try {
    // First check if user has already reviewed this product
    const existingReview = await getUserProductReview(userId, productId);
    
    if (existingReview) {
      throw new Error("You have already reviewed this product");
    }
    
    // Get user profile to include name
    const userProfile = await getUserProfile(userId);
    
    if (!userProfile) {
      throw new Error("User profile not found");
    }
    
    // Use the provided purchaseVerified value or determine it
    const purchaseVerified = reviewData.purchaseVerified !== undefined 
      ? reviewData.purchaseVerified 
      : false; // Default to false if not explicitly set
    
    // Create a new review
    const reviewDataWithTimestamp: ProductReview = {
      productId,
      userId,
      username: userProfile.username || reviewData.username,
      rating: reviewData.rating,
      comment: reviewData.comment,
      userPhotoURL: userProfile.photoURL || reviewData.userPhotoURL,
      purchaseVerified,
      createdAt: serverTimestamp() as Timestamp
    };
    
    // Add to both the general reviews collection and the product-specific collection
    const reviewRef = await addDoc(getReviewsColRef(), reviewDataWithTimestamp);
    const productReviewRef = await addDoc(getProductReviewsColRef(productId), reviewDataWithTimestamp);
    
    // Update the product's review stats
    await updateProductReviewStats(productId);
    
    return {
      id: reviewRef.id,
      ...reviewDataWithTimestamp
    };
  } catch (error) {
    console.error("Error adding product review:", error);
    throw error;
  }
};

/**
 * Get a user's review for a specific product
 */
export const getUserProductReview = async (
  userId: string,
  productId: number | string
): Promise<ProductReview | null> => {
  try {
    const reviewsQuery = query(
      getReviewsColRef(),
      where("userId", "==", userId),
      where("productId", "==", productId)
    );
    
    const reviewsSnapshot = await getDocs(reviewsQuery);
    
    if (reviewsSnapshot.empty) {
      return null;
    }
    
    const reviewDoc = reviewsSnapshot.docs[0];
    return { id: reviewDoc.id, ...reviewDoc.data() } as ProductReview;
  } catch (error) {
    console.error("Error fetching user product review:", error);
    return null;
  }
};

/**
 * Check if a user has purchased a specific product
 */
export const hasUserPurchasedProduct = async (
  userId: string,
  productId: number | string
): Promise<boolean> => {
  try {
    if (!userId) return false;
    
    // Convert productId to string for comparison
    const productIdStr = productId.toString();
    
    // Get all orders for this user
    const orders = await getUserOrders(userId);
    
    // Check if any order contains this product
    for (const order of orders) {
      if (!order.items) continue;
      
      // Look for the product in the order items
      const hasPurchased = order.items.some(item => 
        item.productId.toString() === productIdStr
      );
      
      if (hasPurchased) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error("Error checking purchase status:", error);
    return false;
  }
};

/**
 * Get all reviews for a specific product
 */
export const getProductReviews = async (
  productId: number | string
): Promise<ProductReview[]> => {
  try {
    const reviewsQuery = query(
      getProductReviewsColRef(productId),
      orderBy("createdAt", "desc")
    );
    
    const reviewsSnapshot = await getDocs(reviewsQuery);
    
    if (reviewsSnapshot.empty) {
      return [];
    }
    
    return reviewsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ProductReview[];
  } catch (error) {
    console.error("Error fetching product reviews:", error);
    return [];
  }
};

/**
 * Update review statistics for a product
 */
export const updateProductReviewStats = async (
  productId: number | string
): Promise<ReviewsData | null> => {
  try {
    const reviews = await getProductReviews(productId);
    
    if (!reviews.length) {
      return null;
    }
    
    const totalReviews = reviews.length;
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / totalReviews;
    
    const statsData: ReviewsData = {
      totalReviews,
      averageRating,
      lastUpdated: serverTimestamp() as Timestamp
    };
    
    // Update the product document with review stats
    await updateDoc(getProductReviewStatsDocRef(productId), {
      reviewStats: statsData
    });
    
    return statsData;
  } catch (error) {
    console.error("Error updating product review stats:", error);
    return null;
  }
};

/**
 * Clear the entire wishlist
 */
export const clearWishlist = async (userId: string): Promise<void> => {
  try {
    const wishlistDocRef = getWishlistDocRef(userId);
    
    // Create a new empty wishlist
    const emptyWishlist: Wishlist = {
      userId,
      items: [],
      updatedAt: Timestamp.fromDate(new Date()) // Use client-side timestamp
    };
    
    await setDoc(wishlistDocRef, emptyWishlist);
    console.log("Wishlist cleared successfully");
  } catch (error) {
    console.error("Error clearing wishlist:", error);
    throw error;
  }
};