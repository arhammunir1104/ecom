import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
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
      // Use project ID from environment variables or fallback to a default for development
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "softgirlfashion";
      
      // Initialize the app with explicit project configuration for Replit environment
      const app = initializeApp({
        projectId: projectId,
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

// Constants for collections
export const PRODUCTS_COLLECTION = "products";
export const CATEGORIES_COLLECTION = "categories";

// Product functions
export const createProduct = async (productData: any) => {
  try {
    console.log("Creating new product in Firestore (server-side)");
    
    // Get all products first to determine next ID
    const products = await getAllDocuments(PRODUCTS_COLLECTION);
    
    let nextId = 1;
    if (products.length > 0) {
      // Find the highest ID manually
      const highestId = products.reduce((max, product) => {
        const productId = typeof product.id === 'string' ? parseInt(product.id, 10) : product.id;
        return productId > max ? productId : max;
      }, 0);
      nextId = highestId + 1;
    }
    
    // Create the product with auto-generated ID and timestamps
    const newProduct = {
      ...productData,
      id: nextId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save to Firestore with the ID as the document ID
    await createDocument(PRODUCTS_COLLECTION, newProduct, nextId.toString());
    
    console.log(`Product created successfully with ID: ${nextId}`);
    return newProduct;
  } catch (error) {
    console.error("Error creating product (server-side):", error);
    throw error;
  }
};

export const getProductById = async (id: number | string) => {
  return getDocument(PRODUCTS_COLLECTION, id.toString());
};

export const updateProduct = async (id: number | string, productData: any) => {
  return updateDocument(PRODUCTS_COLLECTION, id.toString(), productData);
};

export const deleteProduct = async (id: number | string) => {
  return deleteDocument(PRODUCTS_COLLECTION, id.toString());
};

export const getAllProducts = async () => {
  return getAllDocuments(PRODUCTS_COLLECTION);
};

export const getProductsByCategory = async (categoryId: number | string) => {
  return queryDocuments(PRODUCTS_COLLECTION, "categoryId", "==", categoryId);
};

export const getFeaturedProducts = async () => {
  return queryDocuments(PRODUCTS_COLLECTION, "featured", "==", true);
};

export const getTrendingProducts = async () => {
  return queryDocuments(PRODUCTS_COLLECTION, "trending", "==", true);
};

// Category functions
export const createCategory = async (categoryData: any) => {
  try {
    console.log("Creating new category in Firestore (server-side)");
    
    // Get all categories first to determine next ID
    const categories = await getAllDocuments(CATEGORIES_COLLECTION);
    
    let nextId = 1;
    if (categories.length > 0) {
      // Find the highest ID manually
      const highestId = categories.reduce((max, category) => {
        const categoryId = typeof category.id === 'string' ? parseInt(category.id, 10) : category.id;
        return categoryId > max ? categoryId : max;
      }, 0);
      nextId = highestId + 1;
    }
    
    // Create the category with auto-generated ID and timestamps
    const newCategory = {
      ...categoryData,
      id: nextId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save to Firestore with the ID as the document ID
    await createDocument(CATEGORIES_COLLECTION, newCategory, nextId.toString());
    
    console.log(`Category created successfully with ID: ${nextId}`);
    return newCategory;
  } catch (error) {
    console.error("Error creating category (server-side):", error);
    throw error;
  }
};

export const getCategoryById = async (id: number | string) => {
  return getDocument(CATEGORIES_COLLECTION, id.toString());
};

export const updateCategory = async (id: number | string, categoryData: any) => {
  return updateDocument(CATEGORIES_COLLECTION, id.toString(), categoryData);
};

export const deleteCategory = async (id: number | string) => {
  return deleteDocument(CATEGORIES_COLLECTION, id.toString());
};

export const getAllCategories = async () => {
  return getAllDocuments(CATEGORIES_COLLECTION);
};

export const getFeaturedCategories = async () => {
  return queryDocuments(CATEGORIES_COLLECTION, "featured", "==", true);
};

// Constants for order collections
export const ORDERS_COLLECTION = "orders";

// Order functions
export const createOrder = async (orderData: any) => {
  try {
    console.log("Creating new order in Firestore (server-side)");
    
    // Make sure the data has required fields
    if (!orderData.userId) {
      throw new Error("Order must have a userId");
    }
    
    // Validate and transform items if needed
    if (Array.isArray(orderData.items)) {
      // Make sure each item has a subtotal
      orderData.items = orderData.items.map((item: any) => {
        if (!item.subtotal && item.price && item.quantity) {
          item.subtotal = Number(item.price) * Number(item.quantity);
        }
        return item;
      });
    }
    
    // Format shipping address if needed
    if (orderData.shippingAddress) {
      // Handle the common case where address is provided instead of addressLine1
      if (orderData.shippingAddress.address && !orderData.shippingAddress.addressLine1) {
        orderData.shippingAddress.addressLine1 = orderData.shippingAddress.address;
        delete orderData.shippingAddress.address;
      }
    }
    
    // Create a unique order ID using timestamp
    const timestamp = Date.now();
    const orderId = `ORD${timestamp}`;
    
    // Format the order data
    const newOrder = {
      ...orderData,
      id: orderId,
      orderDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save to Firestore with the ID as the document ID
    await createDocument(ORDERS_COLLECTION, newOrder, orderId);
    
    console.log(`Order created successfully with ID: ${orderId}`);
    return newOrder;
  } catch (error) {
    console.error("Error creating order (server-side):", error);
    throw error;
  }
};

export const getOrderById = async (id: string) => {
  return getDocument(ORDERS_COLLECTION, id);
};

export const updateOrderStatus = async (id: string, status: string) => {
  return updateDocument(ORDERS_COLLECTION, id, { status });
};

export const updatePaymentStatus = async (id: string, paymentStatus: string) => {
  return updateDocument(ORDERS_COLLECTION, id, { paymentStatus });
};

export const getUserOrders = async (userId: string) => {
  return queryDocuments(ORDERS_COLLECTION, "userId", "==", userId);
};

export const getAllOrders = async () => {
  return getAllDocuments(ORDERS_COLLECTION);
};

// Constants for user collection
export const USERS_COLLECTION = "users";

// Function to update a user's role in Firestore
export const updateUserRole = async (firebaseUid: string, role: "admin" | "user") => {
  try {
    console.log(`Updating role for user ${firebaseUid} to ${role} in Firestore`);
    
    if (!isFirebaseInitialized) {
      throw new Error('Firebase is not initialized');
    }
    
    // First check if the user document exists
    const firestore = db();
    const userRef = firestore.collection(USERS_COLLECTION).doc(firebaseUid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.error(`User ${firebaseUid} not found in Firestore`);
      throw new Error(`User not found in Firestore`);
    }
    
    // Update the role field
    await userRef.update({
      role,
      updatedAt: new Date()
    });
    
    console.log(`Role for user ${firebaseUid} successfully updated to ${role}`);
    
    // Get the updated user document
    const updatedDoc = await userRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() };
  } catch (error) {
    console.error(`Error updating role for user ${firebaseUid}:`, error);
    throw error;
  }
};