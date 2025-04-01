import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Track if Firebase Admin is already initialized
let isInitialized = false;

/**
 * Initialize Firebase Admin with service account or App Engine environment
 */
export const initializeFirebaseAdmin = () => {
  // If already initialized, return the existing app
  if (isInitialized) {
    console.log('Firebase Admin already initialized');
    return admin.apps[0];
  }
  
  // Check if any Firebase admin apps are already initialized
  if (admin.apps && admin.apps.length > 0) {
    console.log('Using existing Firebase Admin app');
    isInitialized = true;
    return admin.apps[0];
  }
  
  try {
    // Initialize with application default credentials
    // In Replit, this falls back to using the environment variables
    const app = admin.initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      credential: admin.credential.cert({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || `firebase-adminsdk@${process.env.VITE_FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`,
        // We won't have the private key, so we'll just handle this as a graceful degradation case
        privateKey: process.env.FIREBASE_PRIVATE_KEY || 'dummy-key',
      }),
    });
    
    console.log('Firebase Admin initialized with project ID:', process.env.VITE_FIREBASE_PROJECT_ID);
    console.log('Note: Without proper Firebase credentials, only PostgreSQL password resets will succeed');
    isInitialized = true;
    return app;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    // Return null instead of throwing - we'll handle the null case in the calling code
    return null;
  }
};

/**
 * Get Firebase Admin Auth instance
 */
export const getFirebaseAdminAuth = () => {
  // Initialize if not already done
  const app = initializeFirebaseAdmin();
  if (!app) {
    throw new Error("Firebase Admin SDK initialization failed");
  }
  return getAuth();
};

/**
 * Reset a user's password using Firebase Admin Auth
 */
export const resetUserPassword = async (email: string, newPassword: string): Promise<boolean> => {
  try {
    console.log(`Attempting to reset password for user ${email} using Firebase Admin SDK`);
    const auth = getFirebaseAdminAuth();
    
    // Get user by email
    const userRecord = await auth.getUserByEmail(email)
      .catch(error => {
        console.error('Error getting user by email:', error);
        return null;
      });
    
    if (!userRecord) {
      console.error('User not found in Firebase:', email);
      return false;
    }
    
    console.log(`Found user in Firebase with UID: ${userRecord.uid}`);
    
    // Update user's password
    await auth.updateUser(userRecord.uid, {
      password: newPassword
    }).catch(error => {
      console.error('Error updating user password in Firebase:', error);
      throw error;
    });
    
    // Also update the password in Firestore if we have access
    try {
      const app = initializeFirebaseAdmin();
      if (app) {
        const db = getFirestore(app);
        
        // We don't store raw passwords in Firestore, just mark that it was reset
        const userRef = db.collection('users').doc(userRecord.uid);
        await userRef.update({
          passwordLastUpdated: new Date(),
          updatedAt: new Date()
        });
        console.log('Password update timestamp added to Firestore for user:', email);
      } else {
        console.warn('Skipping Firestore update - Firebase Admin SDK initialization failed');
      }
    } catch (firestoreError) {
      console.warn('Could not update Firestore password timestamp:', firestoreError);
      // Non-critical error, continue
    }
    
    console.log('Password updated successfully in Firebase Auth for user:', email);
    return true;
  } catch (error) {
    console.error('Error resetting password with Firebase Admin:', error);
    return false;
  }
};

/**
 * Update a user's role in Firebase Firestore and Auth custom claims
 */
export const updateUserRole = async (firebaseUid: string, role: 'admin' | 'user'): Promise<boolean> => {
  try {
    console.log(`Admin SDK: Updating Firebase role for user ${firebaseUid} to ${role}`);
    
    // Initialize Firebase Admin
    const app = initializeFirebaseAdmin();
    if (!app) {
      console.warn('Firebase Admin initialization failed, cannot update Firebase role');
      return false;
    }
    
    const db = getFirestore(app);
    let firestoreUpdateSuccess = false;
    let authUpdateSuccess = false;
    
    // Update the user document in Firestore
    try {
      const userRef = db.collection('users').doc(firebaseUid);
      await userRef.update({
        role: role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Firestore role updated successfully for user ${firebaseUid}`);
      firestoreUpdateSuccess = true;
    } catch (firestoreError) {
      console.error('Error updating user role in Firestore:', firestoreError);
      // Continue to try Auth update even if Firestore fails
    }
    
    // Also set custom claims for additional security in Auth
    try {
      const auth = getFirebaseAdminAuth();
      await auth.setCustomUserClaims(firebaseUid, { role });
      console.log(`Auth custom claims updated successfully for user ${firebaseUid}`);
      authUpdateSuccess = true;
    } catch (authError) {
      console.error('Error updating custom claims in Auth:', authError);
      // We'll still return true if at least Firestore update worked
    }
    
    console.log(`Firebase role update process completed for user ${firebaseUid}`);
    return firestoreUpdateSuccess || authUpdateSuccess;
  } catch (error) {
    console.error('Error initializing Firebase Admin for role update:', error);
    
    // Special case - try direct update through Firebase client SDK
    // This would require implementing a separate mechanism since 
    // client SDK doesn't have permission to update other users
    console.log('Will rely on database update only');
    
    return false;
  }
};