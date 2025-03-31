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

export interface CartItem {
  productId: number;
  quantity: number;
  name: string;
  price: number;
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
  productId: number;
  name: string;
  price: number;
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
    
    // Synchronize with backend server
    try {
      console.log("Syncing user with backend server...");
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
        console.log("User synchronized with backend server successfully");
      } else {
        console.warn("Failed to sync user with backend server:", await response.json());
      }
    } catch (syncError) {
      console.error("Error syncing with backend:", syncError);
      // Non-critical, continue with signup
    }
    
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
            displayName: userData.fullName || userData.username,
            email: userData.email,
            uid: uid,
            photoURL: userData.photoURL
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

/**
 * Update a user's role (admin or user)
 */
export const updateUserRole = async (
  uid: string,
  role: "admin" | "user"
): Promise<void> => {
  try {
    console.log(`Updating user ${uid} role to ${role}`);
    await updateUserProfile(uid, {
      role: role
    });
    console.log(`User role updated successfully`);
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
    id: number;
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
        quantity,
        image: product.image,
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
  productId: number,
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
  productId: number
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
      const subtotal = item.price * item.quantity;
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
    const ordersQuery = query(
      collection(db, ORDERS_COLLECTION),
      where("userId", "==", userId),
      orderBy("orderDate", "desc")
    );
    
    const ordersSnapshot = await getDocs(ordersQuery);
    const orders: Order[] = [];
    
    ordersSnapshot.forEach((doc) => {
      orders.push(doc.data() as Order);
    });
    
    return orders;
  } catch (error) {
    console.error("Error getting user orders:", error);
    throw error;
  }
};

/**
 * Get order details
 */
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
    let ordersQuery;
    
    if (startAfterTimestamp) {
      // Use the Timestamp object as a cursor for pagination
      ordersQuery = query(
        collection(db, ORDERS_COLLECTION),
        orderBy("orderDate", "desc"),
        startAfter(startAfterTimestamp),
        limit(limitCount)
      );
    } else {
      // Get the first page without a cursor
      ordersQuery = query(
        collection(db, ORDERS_COLLECTION),
        orderBy("orderDate", "desc"),
        limit(limitCount)
      );
    }
    
    const ordersSnapshot = await getDocs(ordersQuery);
    const orders: Order[] = [];
    
    ordersSnapshot.forEach((doc) => {
      orders.push(doc.data() as Order);
    });
    
    return orders;
  } catch (error) {
    console.error("Error getting all orders:", error);
    throw error;
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
      updatedAt: serverTimestamp() as Timestamp
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
    id: number;
    name: string;
    price: number;
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
        updatedAt: serverTimestamp() as Timestamp
      };
    }
    
    // Check if item already exists in wishlist
    const existingItem = wishlist.items.find(item => item.productId === product.id);
    
    if (!existingItem) {
      // Add new item to wishlist
      wishlist.items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        addedAt: serverTimestamp() as Timestamp
      });
      
      // Update wishlist in Firestore
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
  productId: number
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
  productId: number
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
      updatedAt: serverTimestamp() as Timestamp
    };
    
    await setDoc(wishlistDocRef, emptyWishlist);
    console.log("Wishlist cleared successfully");
  } catch (error) {
    console.error("Error clearing wishlist:", error);
    throw error;
  }
};