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
export const USERS_COLLECTION = "users";
export const CARTS_COLLECTION = "carts";
export const WISHLIST_COLLECTION = "wishlists";

// Define a common Firebase document interface for type safety
export interface FirebaseDocument {
  id: string;
  [key: string]: any;
}

// Define more specific interfaces
export interface FirebaseProduct extends FirebaseDocument {
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  categoryId?: string | number;
  images: string[];
  colors: string[];
  sizes: string[];
  stock: number;
  featured: boolean;
  trending: boolean;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface FirebaseCartItem extends FirebaseDocument {
  productId: string;
  quantity: number;
  price?: number;
  name?: string;
}

export interface FirebaseWishlistItem extends FirebaseDocument {
  productId: string;
}

export interface FirebaseCart extends FirebaseDocument {
  userId: string;
  items: Record<string, FirebaseCartItem> | FirebaseCartItem[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface FirebaseWishlist extends FirebaseDocument {
  userId: string;
  items: string[] | FirebaseWishlistItem[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface FirebaseUser extends FirebaseDocument {
  email?: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  phoneNumber?: string;
  emailVerified?: boolean;
  createdAt?: string | Date;
  lastSignInTime?: string | Date;
  cartItems?: any[];
  wishlistItems?: any[];
}

// Product functions
export const createProduct = async (productData: Partial<FirebaseProduct>) => {
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

export const getProductFromFirestore = async (id: number | string): Promise<FirebaseProduct | null> => {
  try {
    console.log(`Fetching Firestore product with ID: ${id}`);
    const product = await getDocument(PRODUCTS_COLLECTION, id.toString()) as FirebaseDocument;
    
    if (!product) {
      console.log(`No product found with ID: ${id} in Firestore`);
      return null;
    }
    
    // Normalize the product structure to match PostgreSQL format
    return {
      id: product.id,
      name: product.name || "",
      description: product.description || "",
      price: Number(product.price) || 0,
      discountPrice: product.discountPrice ? Number(product.discountPrice) : undefined,
      categoryId: product.categoryId || undefined,
      images: Array.isArray(product.images) ? product.images : [],
      colors: Array.isArray(product.colors) ? product.colors : [],
      sizes: Array.isArray(product.sizes) ? product.sizes : [],
      stock: Number(product.stock) || 0,
      featured: Boolean(product.featured),
      trending: Boolean(product.trending),
      createdAt: product.createdAt ? new Date(product.createdAt) : new Date()
    };
  } catch (error) {
    console.error(`Error fetching product ${id} from Firestore:`, error);
    return null;
  }
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

// Constants for order collections already defined: USERS_COLLECTION

// User cart and wishlist functions
export const getUserCart = async (userId: string): Promise<(FirebaseProduct & { quantity: number })[]> => {
  try {
    console.log(`Getting cart for user: ${userId}`);
    if (!isFirebaseInitialized) {
      console.warn('Firebase is not initialized, initializing now');
      initializeFirebase();
    }
    
    const carts = await queryDocuments(CARTS_COLLECTION, 'userId', '==', userId) as FirebaseCart[];
    
    if (carts && carts.length > 0) {
      const cart = carts[0] as FirebaseCart;
      const itemsObj = cart.items || {};
      
      // Determine if items is an array or object
      let itemsArray: { productId: string, quantity: number }[] = [];
      
      if (Array.isArray(itemsObj)) {
        console.log(`Found cart for user ${userId} with ${itemsObj.length} items (array format)`);
        itemsArray = itemsObj.map(item => ({
          productId: typeof item === 'string' ? item : item.productId,
          quantity: typeof item === 'string' ? 1 : (item.quantity || 1)
        }));
      } else {
        console.log(`Found cart for user ${userId} with ${Object.keys(itemsObj).length} items (object format)`);
        itemsArray = Object.entries(itemsObj).map(([productId, itemData]) => ({
          productId,
          quantity: typeof itemData === 'object' ? (itemData as any).quantity || 1 : 1
        }));
      }
      
      // Convert cart items to array with product details
      const cartItems: (FirebaseProduct & { quantity: number })[] = [];
      
      for (const { productId, quantity } of itemsArray) {
        try {
          if (!productId) continue;
          
          // Get product details
          const product = await getProductFromFirestore(productId);
          
          if (product) {
            // Add product details to cart item
            cartItems.push({
              ...product,
              quantity
            });
          }
        } catch (error) {
          console.error(`Error processing cart item ${productId}:`, error);
        }
      }
      
      return cartItems;
    }
    
    console.log(`No cart found for user ${userId}`);
    return [];
  } catch (error) {
    console.error(`Error getting cart for user ${userId}:`, error);
    return [];
  }
};

export const getUserWishlist = async (userId: string): Promise<FirebaseProduct[]> => {
  try {
    console.log(`Getting wishlist for user: ${userId}`);
    if (!isFirebaseInitialized) {
      console.warn('Firebase is not initialized, initializing now');
      initializeFirebase();
    }
    
    const wishlists = await queryDocuments(WISHLIST_COLLECTION, 'userId', '==', userId) as FirebaseWishlist[];
    
    if (wishlists && wishlists.length > 0) {
      const wishlist = wishlists[0] as FirebaseWishlist;
      const items = wishlist.items || [];
      
      console.log(`Found wishlist for user ${userId} with ${Array.isArray(items) ? items.length : 0} items`);
      
      // Get product details for each wishlist item
      const wishlistItems: FirebaseProduct[] = [];
      
      // Convert items to an array of product IDs
      const productIds: string[] = Array.isArray(items) 
        ? items.map(item => typeof item === 'string' ? item : item.productId)
        : [];
      
      for (const productId of productIds) {
        try {
          if (!productId) continue;
          
          // Get product details
          const product = await getProductFromFirestore(productId);
          
          if (product) {
            wishlistItems.push(product);
          }
        } catch (error) {
          console.error(`Error processing wishlist item:`, error);
        }
      }
      
      return wishlistItems;
    }
    
    console.log(`No wishlist found for user ${userId}`);
    return [];
  } catch (error) {
    console.error(`Error getting wishlist for user ${userId}:`, error);
    return [];
  }
};

// Get a user from Firestore
export const getFirestoreUser = async (uid: string): Promise<FirebaseUser | null> => {
  try {
    console.log(`Getting Firestore user data for UID: ${uid}`);
    if (!isFirebaseInitialized) {
      console.warn('Firebase is not initialized, initializing now');
      initializeFirebase();
    }
    
    // First try to get from Firestore
    const userData = await getDocument(USERS_COLLECTION, uid) as FirebaseDocument;
    
    // If found in Firestore, return it
    if (userData) {
      console.log(`Found Firestore user data for UID: ${uid}`);
      
      // Get cart items with product details
      const cartItems = await getUserCart(uid);
      
      // Get wishlist items with product details
      const wishlistItems = await getUserWishlist(uid);
      
      // Create a properly typed user object
      const user: FirebaseUser = {
        id: userData.id,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        phoneNumber: userData.phoneNumber,
        emailVerified: userData.emailVerified,
        role: userData.role,
        createdAt: userData.createdAt,
        lastSignInTime: userData.lastSignInTime,
        cartItems,
        wishlistItems
      };
      
      return user;
    }
    
    // If not found in Firestore, try to get from Auth
    try {
      if (firebaseAuth) {
        const userRecord = await firebaseAuth.getUser(uid);
        console.log(`Found Firebase Auth user record for UID: ${uid}`);
        
        // Create a minimal user object from Auth data
        const user: FirebaseUser = {
          id: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          photoURL: userRecord.photoURL,
          phoneNumber: userRecord.phoneNumber,
          emailVerified: userRecord.emailVerified,
          role: 'user', // Default role
          createdAt: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime,
          cartItems: [],
          wishlistItems: []
        };
        
        return user;
      }
    } catch (authError) {
      console.error(`Error retrieving user ${uid} from Firebase Auth:`, authError);
    }
    
    console.log(`No Firestore or Auth data found for UID: ${uid}`);
    return null;
  } catch (error) {
    console.error(`Error getting Firestore user ${uid}:`, error);
    return null;
  }
};

// Function to update a user's role in Firestore
export const updateUserRole = async (firebaseUid: string, role: "admin" | "user"): Promise<FirebaseUser> => {
  try {
    console.log(`Updating role for user ${firebaseUid} to ${role} in Firestore`);
    
    if (!isFirebaseInitialized) {
      console.warn('Firebase is not initialized, initializing now');
      initializeFirebase();
      
      console.log(`Firebase initialized status: ${isFirebaseInitialized}`);
      
      if (!isFirebaseInitialized) {
        throw new Error('Failed to initialize Firebase');
      }
    }
    
    // First check if the user document exists
    const firestore = db();
    const userRef = firestore.collection(USERS_COLLECTION).doc(firebaseUid);
    
    console.log(`Attempting to get document for user ${firebaseUid}`);
    
    try {
      // Attempt to directly update without checking first
      console.log('Using direct update approach for reliability');
      await userRef.set({
        uid: firebaseUid,
        role,
        updatedAt: new Date()
      }, { merge: true }); // Using merge: true to only update specified fields
      
      console.log(`Role for user ${firebaseUid} successfully updated to ${role} using merge`);
      
      // Get the updated document to return
      const updatedDoc = await userRef.get();
      if (updatedDoc.exists) {
        console.log('Successfully retrieved updated document');
        const userData = { id: updatedDoc.id, ...updatedDoc.data() } as FirebaseDocument;
        
        // Get cart and wishlist data
        const cartItems = await getUserCart(firebaseUid);
        const wishlistItems = await getUserWishlist(firebaseUid);
        
        // Return fully formed FirebaseUser
        return {
          id: userData.id,
          email: userData.email,
          role: userData.role || role,
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          phoneNumber: userData.phoneNumber,
          emailVerified: userData.emailVerified,
          createdAt: userData.createdAt,
          cartItems,
          wishlistItems
        };
      } else {
        console.log('Document still doesn\'t exist after update');
        // Return minimal user
        return { 
          id: firebaseUid, 
          role,
          cartItems: [],
          wishlistItems: []
        } as FirebaseUser;
      }
    } catch (updateError) {
      console.error('Error with direct update approach:', updateError);
      console.log('Falling back to REST API approach');
      
      // Fallback to direct REST API call
      try {
        // Create a direct REST API call to Firebase
        const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "softgirlfashion";
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${firebaseUid}`;
        
        console.log(`Attempting REST API call to ${url}`);
        
        const https = require('https');
        
        // Prepare data for the request
        const data = JSON.stringify({
          fields: {
            role: { stringValue: role },
            updatedAt: { timestampValue: new Date().toISOString() }
          }
        });
        
        // Create a promise for the request
        const result = new Promise<unknown>((resolve, reject) => {
          const req = https.request(
            url,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
              }
            },
            (res: { statusCode: number; on: (event: string, callback: (data?: any) => void) => void }) => {
              let responseData = '';
              res.on('data', (chunk: Buffer | string) => { responseData += chunk.toString(); });
              res.on('end', () => {
                console.log('REST API response:', res.statusCode);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                  resolve(JSON.parse(responseData));
                } else {
                  reject(new Error(`HTTP error ${res.statusCode}: ${responseData}`));
                }
              });
            }
          );
          
          req.on('error', (e: Error) => {
            console.error('REST API request error:', e);
            reject(e);
          });
          
          req.write(data);
          req.end();
        });
        
        await result;
        console.log('REST API update successful');
        
        // Return minimal user
        return {
          id: firebaseUid,
          role,
          cartItems: [],
          wishlistItems: []
        } as FirebaseUser;
      } catch (restError) {
        console.error('REST API approach also failed:', restError);
        throw restError;
      }
    }
  } catch (error) {
    console.error(`Error updating role for user ${firebaseUid}:`, error);
    throw error;
  }
};