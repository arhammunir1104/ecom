import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';

// Track if Firebase Admin is already initialized
let isInitialized = false;

/**
 * Initialize Firebase Admin with service account or App Engine environment
 */
export const initializeFirebaseAdmin = () => {
  // If already initialized, return the existing app
  if (isInitialized) {
    console.log('Firebase Admin already initialized');
    return admin.app();
  }
  
  // Check if any Firebase admin apps are already initialized
  if (admin.apps && admin.apps.length > 0) {
    console.log('Using existing Firebase Admin app');
    isInitialized = true;
    return admin.app();
  }
  
  try {
    // Initialize with application default credentials
    // In Replit, this falls back to using the environment variables
    const app = admin.initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    });
    
    console.log('Firebase Admin initialized successfully with project ID:', process.env.VITE_FIREBASE_PROJECT_ID);
    isInitialized = true;
    return app;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    throw error;
  }
};

/**
 * Get Firebase Admin Auth instance
 */
export const getFirebaseAdminAuth = () => {
  // Initialize if not already done
  initializeFirebaseAdmin();
  return getAuth();
};

/**
 * Reset a user's password using Firebase Admin Auth
 */
export const resetUserPassword = async (email: string, newPassword: string): Promise<boolean> => {
  try {
    const auth = getFirebaseAdminAuth();
    
    // Get user by email
    const userRecord = await auth.getUserByEmail(email)
      .catch(error => {
        console.error('Error getting user by email:', error);
        return null;
      });
    
    if (!userRecord) {
      console.error('User not found:', email);
      return false;
    }
    
    // Update user's password
    await auth.updateUser(userRecord.uid, {
      password: newPassword
    }).catch(error => {
      console.error('Error updating user password:', error);
      throw error;
    });
    
    console.log('Password updated successfully for user:', email);
    return true;
  } catch (error) {
    console.error('Error resetting password:', error);
    return false;
  }
};