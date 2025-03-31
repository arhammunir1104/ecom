import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage, Storage } from 'firebase-admin/storage';

// Check if Firebase Admin is already initialized
let firestoreDb: Firestore | undefined;
let firebaseAuth: Auth | undefined;
let firebaseStorage: Storage | undefined;

// Flag to track if Firebase is properly initialized
let isFirebaseInitialized = false;

export const initializeFirebase = () => {
  if (getApps().length === 0) {
    try {
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
      
      if (!projectId) {
        console.warn("Firebase project ID is missing. Firebase services won't be initialized.");
        return false;
      }
      
      // Initialize the app with default credentials for Replit environment
      const app = initializeApp({
        projectId,
        storageBucket: `${projectId}.appspot.com`,
      });
      
      // Initialize Firestore
      firestoreDb = getFirestore(app);
      
      // Initialize Firebase Auth
      firebaseAuth = getAuth(app);
      
      // Initialize Firebase Storage
      firebaseStorage = getStorage(app);
      
      console.log('Firebase services initialized successfully');
      isFirebaseInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Firebase services:', error);
      return false;
    }
  } else {
    // Firebase is already initialized
    firestoreDb = getFirestore();
    firebaseAuth = getAuth();
    firebaseStorage = getStorage();
    isFirebaseInitialized = true;
    return true;
  }
};

export const db = (): Firestore => {
  if (!isFirebaseInitialized) {
    const initialized = initializeFirebase();
    if (!initialized) {
      throw new Error('Firebase services are not initialized. Cannot access Firestore.');
    }
  }
  if (!firestoreDb) {
    throw new Error('Firestore is not initialized.');
  }
  return firestoreDb;
};

export const auth = (): Auth => {
  if (!isFirebaseInitialized) {
    const initialized = initializeFirebase();
    if (!initialized) {
      throw new Error('Firebase services are not initialized. Cannot access Auth.');
    }
  }
  if (!firebaseAuth) {
    throw new Error('Firebase Auth is not initialized.');
  }
  return firebaseAuth;
};

export const storage = (): Storage => {
  if (!isFirebaseInitialized) {
    const initialized = initializeFirebase();
    if (!initialized) {
      throw new Error('Firebase services are not initialized. Cannot access Storage.');
    }
  }
  if (!firebaseStorage) {
    throw new Error('Firebase Storage is not initialized.');
  }
  return firebaseStorage;
};

// Attempt to initialize Firebase when the module is imported
initializeFirebase();

// Utility functions for working with Firestore from the server
export const createDocument = async (collection: string, data: any, id?: string) => {
  try {
    if (!isFirebaseInitialized) {
      throw new Error('Firebase is not initialized');
    }
    
    const firestore = db();
    const collectionRef = firestore.collection(collection);
    
    if (id) {
      // Create with specific ID
      await collectionRef.doc(id).set({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Get the created document
      const docSnapshot = await collectionRef.doc(id).get();
      return { id: docSnapshot.id, ...docSnapshot.data() };
    } else {
      // Create with auto-generated ID
      const docRef = await collectionRef.add({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Get the created document
      const docSnapshot = await docRef.get();
      return { id: docSnapshot.id, ...docSnapshot.data() };
    }
  } catch (error) {
    console.error(`Error creating document in ${collection}:`, error);
    throw error;
  }
};

export const updateDocument = async (collection: string, id: string, data: any) => {
  try {
    if (!isFirebaseInitialized) {
      throw new Error('Firebase is not initialized');
    }
    
    const firestore = db();
    const docRef = firestore.collection(collection).doc(id);
    
    // Update the document
    await docRef.update({
      ...data,
      updatedAt: new Date()
    });
    
    // Get the updated document
    const docSnapshot = await docRef.get();
    return { id: docSnapshot.id, ...docSnapshot.data() };
  } catch (error) {
    console.error(`Error updating document ${id} in ${collection}:`, error);
    throw error;
  }
};

export const getDocument = async (collection: string, id: string) => {
  try {
    if (!isFirebaseInitialized) {
      throw new Error('Firebase is not initialized');
    }
    
    const firestore = db();
    const docSnapshot = await firestore.collection(collection).doc(id).get();
    
    if (!docSnapshot.exists) {
      return null;
    }
    
    return { id: docSnapshot.id, ...docSnapshot.data() };
  } catch (error) {
    console.error(`Error getting document ${id} from ${collection}:`, error);
    throw error;
  }
};

export const getAllDocuments = async (collection: string) => {
  try {
    if (!isFirebaseInitialized) {
      throw new Error('Firebase is not initialized');
    }
    
    const firestore = db();
    const querySnapshot = await firestore.collection(collection).get();
    
    return querySnapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>) => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error(`Error getting all documents from ${collection}:`, error);
    throw error;
  }
};

export const deleteDocument = async (collection: string, id: string) => {
  try {
    if (!isFirebaseInitialized) {
      throw new Error('Firebase is not initialized');
    }
    
    const firestore = db();
    await firestore.collection(collection).doc(id).delete();
    
    return true;
  } catch (error) {
    console.error(`Error deleting document ${id} from ${collection}:`, error);
    throw error;
  }
};

export const queryDocuments = async (collection: string, field: string, operator: FirebaseFirestore.WhereFilterOp, value: any) => {
  try {
    if (!isFirebaseInitialized) {
      throw new Error('Firebase is not initialized');
    }
    
    const firestore = db();
    const querySnapshot = await firestore
      .collection(collection)
      .where(field, operator, value)
      .get();
    
    return querySnapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>) => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error(`Error querying documents in ${collection}:`, error);
    throw error;
  }
};