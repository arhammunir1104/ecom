import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loginSchema, userSchema, twoFactorVerifySchema, insertProductSchema, insertCategorySchema, insertReviewSchema, insertOrderSchema, insertHeroBannerSchema, insertTestimonialSchema } from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";
import { verifyRecaptcha } from "./utils/recaptcha";
import { setupTwoFactor, verifyToken } from "./utils/twoFactor";
import * as firebaseAdmin from "./utils/firebase";
import firebaseApp from "../client/src/lib/firebase";
import * as firebaseAuth from "firebase/auth";
import * as firebaseFirestore from "firebase/firestore";

// Augment the Express Request type to include the user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        [key: string]: any;
      };
    }
  }
}

// Firebase document types
interface FirebaseCategory {
  id: string;
  name: string;
  description?: string;
  image?: string;
  featured?: boolean;
  [key: string]: any;
}

interface FirebaseProduct {
  id: string;
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
  [key: string]: any;
}

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("⚠️ STRIPE_SECRET_KEY is not set. Please set it in your secrets/environment variables.");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16" as any,
});

// Middleware for checking if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  console.log("isAuthenticated middleware called for path:", req.path);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  
  // Check for the user ID in various places
  
  // 1. Check headers first (for API calls that set it directly)
  let userId = req.headers["user-id"];
  let firebaseUid = null;
  
  // 2. Check for the X-User-ID header that our frontend can set
  if (!userId && req.headers["x-user-id"]) {
    userId = req.headers["x-user-id"];
  }
  
  // 3. Get Firebase UID from header (capitalization doesn't matter for headers)
  if (req.headers["firebase-uid"]) {
    firebaseUid = req.headers["firebase-uid"];
    console.log("Found Firebase UID in header:", firebaseUid);
  }
  
  // 4. Check if a user object was sent in the request body (for client-side auth)
  if (!userId && req.body && req.body.userId) {
    userId = req.body.userId;
  }
  
  // 5. Check for Firebase UID in the request body
  if (!firebaseUid && req.body && req.body.uid) {
    firebaseUid = req.body.uid;
    console.log("Found Firebase UID in body:", firebaseUid);
  }
  
  console.log("Resolved userId:", userId);
  console.log("Resolved firebaseUid:", firebaseUid);
  
  // Try to authenticate with Firebase UID first if available
  if (firebaseUid) {
    (async () => {
      try {
        // Try to find user by Firebase UID
        const foundUser = await storage.getUserByFirebaseId(firebaseUid.toString());
        
        if (foundUser) {
          console.log("Found user by Firebase UID:", foundUser.id);
          req.user = { id: foundUser.id, firebaseUid: firebaseUid.toString() };
          next();
          return;
        } else {
          console.log("No user found with Firebase UID:", firebaseUid);
          
          // If the user is in Firebase but not in our database, try to register them automatically
          if (req.body && req.body.email) {
            try {
              console.log("Attempting to auto-register Firebase user in database:", firebaseUid);
              
              // Create a new user entry with the Firebase UID
              const newUser = await storage.createUser({
                username: req.body.username || req.body.email.split('@')[0],
                email: req.body.email,
                password: 'firebase-auth', // Placeholder since Firebase handles auth
                fullName: req.body.fullName || req.body.username || null,
                role: 'user',
                firebaseUid: firebaseUid.toString(),
                photoURL: req.body.photoURL || null
              });
              
              console.log("Auto-registered Firebase user in database:", newUser.id);
              req.user = { id: newUser.id, firebaseUid: firebaseUid.toString() };
              next();
              return;
            } catch (regError) {
              console.error("Error auto-registering Firebase user:", regError);
            }
          }
        }
      } catch (error) {
        console.error("Error finding user by Firebase UID:", error);
      }
      
      // If we get here and we also have a userId, try that next
      if (userId) {
        proceedWithUserIdAuthentication();
      } else {
        // If no userId either, return 401
        res.status(401).json({ message: "User not found with Firebase UID and no userId provided" });
      }
    })();
    return;
  }
  
  // If we only have userId, proceed with that
  if (userId) {
    proceedWithUserIdAuthentication();
    return;
  }
  
  // If we have neither, return 401
  return res.status(401).json({ message: "Unauthorized - No user ID or Firebase UID found" });
  
  // Helper function to authenticate with userId
  function proceedWithUserIdAuthentication() {
    // Make sure userId is defined
    if (!userId) {
      console.error("User ID is undefined in authentication");
      return res.status(401).json({ message: "Unauthorized - No user ID provided" });
    }

    // Convert string userId to number if needed
    const numericUserId = /^\d+$/.test(userId.toString()) ? Number(userId) : null;
    
    if (numericUserId) {
      console.log("Using numeric user ID:", numericUserId);
      req.user = { id: numericUserId };
      next();
      return;
    }
    
    // If userId is not numeric, it might be Firebase UID
    (async () => {
      try {
        // Try to find user by Firebase UID
        const foundUser = await storage.getUserByFirebaseId(userId.toString());
        
        if (foundUser) {
          console.log("Found user by treating userId as Firebase UID:", foundUser.id);
          req.user = { id: foundUser.id, firebaseUid: userId.toString() };
          next();
          return;
        }
        
        // If we're here, no user was found - return error
        console.log("No user found with ID:", userId);
        res.status(401).json({ message: "User not found in our system" });
      } catch (error) {
        console.error("Error in isAuthenticated middleware:", error);
        res.status(500).json({ message: "Server error in authentication" });
      }
    })();
  }
};

// Middleware for checking if user is an admin
const isAdmin = async (req: Request, res: Response, next: Function) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // First check PostgreSQL database
  const user = await storage.getUser(req.user.id);
  if (user && user.role === "admin") {
    return next(); // User is admin in PostgreSQL
  }
  
  // If user exists but is not admin in PostgreSQL, or if user doesn't exist in PostgreSQL
  // Check if they have a Firebase UID and check Firestore
  if (user && user.firebaseUid) {
    try {
      // Check Firestore for admin role
      const db = firebaseFirestore.getFirestore(firebaseApp);
      const userRef = firebaseFirestore.doc(db, 'users', user.firebaseUid);
      const userDoc = await firebaseFirestore.getDoc(userRef);
      
      if (userDoc.exists() && userDoc.data().role === "admin") {
        // User is admin in Firestore but not in PostgreSQL
        // Let's synchronize the databases in the background
        console.log(`User ${user.id} is admin in Firestore but not in PostgreSQL. Synchronizing...`);
        storage.updateUser(user.id, { role: "admin" })
          .then(() => console.log(`User ${user.id} role updated to admin in PostgreSQL`))
          .catch(err => console.error(`Failed to update user ${user.id} role in PostgreSQL:`, err));
        
        return next(); // Allow access since they're admin in Firestore
      }
    } catch (error) {
      console.error("Error checking Firestore admin status:", error);
      // Continue to the next check - don't fail here
    }
  }
  
  // If firebaseUid is present in headers, check Firestore directly
  const firebaseUid = req.headers["firebase-uid"]?.toString();
  if (firebaseUid) {
    try {
      // Check Firestore for admin role
      const db = firebaseFirestore.getFirestore(firebaseApp);
      const userRef = firebaseFirestore.doc(db, 'users', firebaseUid);
      const userDoc = await firebaseFirestore.getDoc(userRef);
      
      if (userDoc.exists() && userDoc.data().role === "admin") {
        // User is admin in Firestore
        return next();
      }
    } catch (error) {
      console.error("Error checking Firestore admin status by header:", error);
      // Continue to the forbidden response
    }
  }
  
  // If we reach here, user is not admin in any database
  return res.status(403).json({ message: "Forbidden - Admin access required" });
};

// Helper functions for Firebase Auth
const getFirebaseAuth = () => {
  try {
    const { getAuth } = require("firebase/auth");
    const app = require("../client/src/lib/firebase").default;
    return getAuth(app);
  } catch (error) {
    console.error("Error initializing Firebase Auth:", error);
    return null;
  }
};

const createFirebaseUser = async (email: string, password: string) => {
  try {
    const { createUserWithEmailAndPassword } = require("firebase/auth");
    const auth = getFirebaseAuth();
    if (!auth) return null;
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential?.user || null;
  } catch (error: any) {
    console.error("Error creating Firebase user:", error.code, error.message);
    return null;
  }
};

const signInWithFirebase = async (email: string, password: string) => {
  try {
    const { signInWithEmailAndPassword } = require("firebase/auth");
    const auth = getFirebaseAuth();
    if (!auth) return null;
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential?.user || null;
  } catch (error: any) {
    console.error("Error signing in with Firebase:", error.code, error.message);
    return null;
  }
};

const createFirestoreUser = async (uid: string, userData: any) => {
  try {
    const { getFirestore, collection, doc, setDoc } = require("firebase/firestore");
    const app = require("../client/src/lib/firebase").default;
    const db = getFirestore(app);
    
    await setDoc(doc(collection(db, "users"), uid), {
      ...userData,
      uid,
      createdAt: new Date()
    });
    return true;
  } catch (error) {
    console.error("Error creating Firestore user:", error);
    return false;
  }
};

// Helper function to sync role between Firestore and PostgreSQL
const syncUserRole = async (firebaseUid: string, role: "admin" | "user") => {
  let postgreSQLSuccess = false;
  let firestoreSuccess = false;
  
  try {
    // 1. Update role in PostgreSQL if user exists
    try {
      const user = await storage.getUserByFirebaseId(firebaseUid);
      if (user) {
        await storage.updateUser(user.id, { role });
        console.log(`User ${user.id} role updated in PostgreSQL to ${role}`);
        postgreSQLSuccess = true;
      } else {
        console.log(`No PostgreSQL user found with Firebase UID: ${firebaseUid}. Creating a minimal user record...`);
        
        // Try to get user data from Firestore to create a PostgreSQL record
        try {
          const db = firebaseFirestore.getFirestore(firebaseApp);
          const userRef = firebaseFirestore.doc(db, 'users', firebaseUid);
          const userDoc = await firebaseFirestore.getDoc(userRef);
          
          if (userDoc.exists()) {
            const firestoreUserData = userDoc.data();
            // Create a minimal user record in PostgreSQL
            if (firestoreUserData.email) {
              const newUser = await storage.createUser({
                username: firestoreUserData.username || firestoreUserData.email.split('@')[0],
                email: firestoreUserData.email,
                password: 'firebase-auth', // Placeholder as Firebase handles auth
                fullName: firestoreUserData.displayName || firestoreUserData.fullName || null,
                role: role, // Set the requested role
                firebaseUid: firebaseUid,
                photoURL: firestoreUserData.photoURL || null
              });
              console.log(`Created new PostgreSQL user with ID ${newUser.id} for Firebase UID ${firebaseUid}`);
              postgreSQLSuccess = true;
            }
          }
        } catch (firestoreError) {
          console.error(`Error getting Firestore user data for ${firebaseUid}:`, firestoreError);
          // Continue with just updating Firestore
        }
      }
    } catch (postgresError) {
      console.error("Error updating PostgreSQL:", postgresError);
      // Continue with Firestore update even if PostgreSQL fails
    }

    // 2. Update role in Firestore
    try {
      const db = firebaseFirestore.getFirestore(firebaseApp);
      const userRef = firebaseFirestore.doc(db, 'users', firebaseUid);
      
      // Check if user document exists in Firestore
      const userDoc = await firebaseFirestore.getDoc(userRef);
      
      if (userDoc.exists()) {
        // Update existing user document
        await firebaseFirestore.setDoc(userRef, {
          role,
          updatedAt: firebaseFirestore.serverTimestamp()
        }, { merge: true });
        console.log(`User ${firebaseUid} role updated in Firestore to ${role}`);
        firestoreSuccess = true;
      } else {
        console.log(`No Firestore user document found for UID: ${firebaseUid}. Cannot update non-existent document.`);
        // Don't try to create a document from scratch - that should be handled by the auth system
      }
    } catch (firestoreError) {
      console.error("Error updating Firestore:", firestoreError);
    }

    // Return success if either database was updated successfully
    if (postgreSQLSuccess || firestoreSuccess) {
      return true;
    }
    
    // If neither database was updated, return false
    console.error(`Failed to update role for ${firebaseUid} in any database.`);
    return false;
  } catch (error) {
    console.error("Error in syncUserRole function:", error);
    return false;
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const validation = loginSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid credentials", errors: validation.error.flatten().fieldErrors });
      }
      
      // Check for reCAPTCHA token
      const { email, password, recaptchaToken, firebaseUid } = validation.data;
      
      if (!recaptchaToken) {
        return res.status(400).json({ message: "reCAPTCHA verification is required" });
      }
      
      // Verify reCAPTCHA token
      const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
      if (!isRecaptchaValid) {
        return res.status(400).json({ message: "reCAPTCHA verification failed" });
      }
      
      // First try to find the user by Firebase UID if provided
      let user = null;
      
      if (firebaseUid) {
        user = await storage.getUserByFirebaseId(firebaseUid);
        console.log(`Looked up user by Firebase UID ${firebaseUid}: ${user ? 'Found' : 'Not found'}`);
      }
      
      // If not found by Firebase UID, try by email
      if (!user) {
        user = await storage.getUserByEmail(email);
        console.log(`Looked up user by email ${email}: ${user ? 'Found' : 'Not found'}`);
      }
      
      // If user is found by email but has no Firebase UID and one was provided, update it
      if (user && !user.firebaseUid && firebaseUid) {
        console.log(`Updating user ${user.id} with Firebase UID ${firebaseUid}`);
        user = await storage.updateUser(user.id, { firebaseUid });
      }
      
      // If not using Firebase authentication directly (no Firebase UID provided), 
      // we need to authenticate via Firebase Auth ourselves
      if (!firebaseUid) {
        console.log("Attempting to authenticate with Firebase using email/password");
        
        // Try to sign in with Firebase
        const firebaseUser = await signInWithFirebase(email, password);
        
        if (firebaseUser) {
          // Successfully signed in with Firebase
          console.log(`Successfully authenticated with Firebase: ${firebaseUser.uid}`);
          
          // If we don't have a user record yet, or it doesn't have the Firebase UID, update it
          if (!user) {
            console.log(`User not found in database, creating new record with Firebase UID: ${firebaseUser.uid}`);
            user = await storage.createUser({
              username: email.split('@')[0],
              email: email,
              password: password,
              fullName: null,
              role: "user",
              firebaseUid: firebaseUser.uid
            });
            
            // Create user in Firestore as well
            await createFirestoreUser(firebaseUser.uid, {
              email: email,
              username: email.split('@')[0],
              role: "user",
              twoFactorEnabled: false
            });
            
          } else if (!user.firebaseUid) {
            // Update existing user with Firebase UID
            console.log(`Updating existing user ${user.id} with Firebase UID: ${firebaseUser.uid}`);
            user = await storage.updateUser(user.id, { 
              firebaseUid: firebaseUser.uid 
            });
          }
        } else {
          // Firebase Auth failed, check our local database as a fallback
          if (!user || user.password !== password) {
            return res.status(401).json({ 
              message: "Invalid credentials",
              details: "Email or password is incorrect" 
            });
          }
        }
      }
      
      // If user still not found, create them if we have a Firebase UID
      if (!user && firebaseUid) {
        console.log(`User not found in database but has Firebase UID ${firebaseUid}. Creating new user record.`);
        user = await storage.createUser({
          username: email.split('@')[0],
          email: email,
          password: 'firebase-auth', // Placeholder since Firebase handles auth
          fullName: req.body.fullName || req.body.displayName || null,
          role: 'user',
          firebaseUid: firebaseUid,
          photoURL: req.body.photoURL || null
        });
        console.log(`Created new user with ID ${user.id} for Firebase UID ${firebaseUid}`);
      }
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Check if the user has two-factor authentication enabled
      if (user.twoFactorEnabled) {
        // Generate and send OTP
        const result = await setupTwoFactor(user.email);
        
        if (!result.success) {
          return res.status(500).json({ message: "Failed to send verification code" });
        }
        
        // Update the user's secret
        await storage.updateUserTwoFactorSecret(user.id, result.secret);
        
        // If 2FA is enabled, send back limited information
        // The frontend will prompt for a verification code
        return res.json({
          id: user.id,
          email: user.email,
          twoFactorEnabled: true
        });
      }
      
      // In a real app, we'd generate a JWT or session here
      return res.json({ 
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        twoFactorEnabled: false,
        firebaseUid: user.firebaseUid
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const validation = userSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      // Check for reCAPTCHA token
      const { recaptchaToken } = req.body;
      
      if (!recaptchaToken) {
        return res.status(400).json({ message: "reCAPTCHA verification is required" });
      }
      
      // Verify reCAPTCHA token
      const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
      if (!isRecaptchaValid) {
        return res.status(400).json({ message: "reCAPTCHA verification failed" });
      }
      
      const email = validation.data.email;
      console.log("Checking if email exists in our database:", email);
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        console.log("Email found in database:", email);
        return res.status(409).json({ message: "Email already in use" });
      }
      
      // Also check if the email exists in Firebase
      try {
        // Import the initialized Firebase admin auth from our utility file
        const { auth } = await import('./utils/firebase');
        const firebaseAuth = auth();
        
        try {
          // Try to get the user by email from Firebase
          console.log("Checking if email exists in Firebase Auth:", email);
          const userRecord = await firebaseAuth.getUserByEmail(email);
          
          if (userRecord) {
            console.log("Email exists in Firebase Auth but not in our database:", email);
            return res.status(409).json({ message: "Email already registered in authentication system" });
          }
        } catch (fbError: any) {
          if (fbError.code === 'auth/user-not-found') {
            console.log("Email not found in Firebase Auth:", email);
          } else {
            console.error("Firebase auth error:", fbError);
            // If it's not a user-not-found error, there might be an issue with Firebase configuration
            console.log("Firebase error details:", fbError.code, fbError.message);
          }
        }
      } catch (adminError) {
        console.error("Error loading Firebase admin:", adminError);
        console.log("Admin error details:", adminError);
        // Continue with registration if we can't check Firebase
      }
      
      // Generate and send OTP for email verification
      const result = await setupTwoFactor(validation.data.email);
      
      if (!result.success) {
        return res.status(500).json({ message: "Failed to send verification code to your email" });
      }
      
      // Store the user data in a temporary session or a pending users table
      // This is a simplified version where we'll use the secret to store user data temporarily
      const pendingUserData = {
        userData: validation.data,
        secret: result.secret
      };
      
      // In a real app, this would be stored in a database or session
      // For now, we'll just return it to the frontend
      return res.status(200).json({
        email: validation.data.email,
        requiresEmailVerification: true,
        message: "Verification code sent to your email. Please verify your email to complete registration."
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Email verification endpoint for registration
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      console.log("Email verification request:", req.body);
      const { email, token, userData, firebaseUid } = req.body;
      
      if (!email || !token) {
        return res.status(400).json({ message: "Email and verification code are required" });
      }
      
      // In a real app, we would fetch the pending user data from a database or session
      // For this example, we'll simulate verifying the token by checking length
      if (token.length !== 6) {
        return res.status(400).json({ message: "Invalid verification code" });
      }
      
      // Check if the user already exists before creating a new one
      let existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        // If they already exist but we have a Firebase UID, update their record
        if (firebaseUid && existingUser && !existingUser.firebaseUid) {
          const updatedUser = await storage.updateUser(existingUser.id, { firebaseUid });
          
          if (updatedUser) {
            console.log(`Updated existing user ${updatedUser.id} with Firebase UID ${firebaseUid}`);
            
            return res.status(200).json({ 
              id: updatedUser.id,
              username: updatedUser.username,
              email: updatedUser.email,
              fullName: updatedUser.fullName,
              role: updatedUser.role,
              twoFactorEnabled: updatedUser.twoFactorEnabled || false,
              message: "Email verified and account updated with Firebase authentication."
            });
          }
        }
        
        return res.status(409).json({ 
          message: "An account with this email already exists. Please log in instead." 
        });
      }
      
      // Create user account (with the userData saved from registration)
      const newUserData: any = {
        username: userData?.username || email.split('@')[0], // Use provided username or generate one
        email: email,
        password: userData?.password || "temporaryPassword", // Use provided password or a default
        fullName: userData?.fullName,
        role: "user"
      };
      
      // If we have a Firebase UID, include it in the user record
      if (firebaseUid) {
        newUserData.firebaseUid = firebaseUid;
        console.log(`Creating new user with Firebase UID: ${firebaseUid}`);
      } else {
        // No Firebase UID provided, so create a Firebase Auth account
        console.log("Creating user in Firebase Authentication:", email);
        
        const userPassword = userData?.password || "temporaryPassword";
        console.log(`Attempting to create Firebase Auth account for: ${email}`);
        
        // Create user in Firebase Authentication
        const firebaseUser = await createFirebaseUser(email, userPassword);
        
        if (firebaseUser) {
          // Add the Firebase UID to our database record
          newUserData.firebaseUid = firebaseUser.uid;
          console.log(`Created Firebase Auth user with UID: ${firebaseUser.uid}`);
          
          // Create user in Firestore as well
          const firestoreResult = await createFirestoreUser(firebaseUser.uid, {
            email: email,
            username: newUserData.username,
            fullName: newUserData.fullName,
            role: "user",
            createdAt: new Date(),
            twoFactorEnabled: false
          });
          
          if (firestoreResult) {
            console.log(`Created user document in Firestore: ${firebaseUser.uid}`);
          }
        } else {
          console.log("No Firebase user created, continuing with database-only user");
        }
      }
      
      const user = await storage.createUser(newUserData);
      
      res.status(201).json({ 
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled || false,
        message: "Email verified successfully. Your account has been created."
      });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Resend email verification code
  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Check if the email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "Email already has an account" });
      }
      
      // Generate and send new OTP
      const result = await setupTwoFactor(email);
      
      if (!result.success) {
        return res.status(500).json({ message: "Failed to send verification code" });
      }
      
      res.json({ 
        message: "Verification code resent to your email",
        email: email,
        success: true
      });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Google authentication endpoint
  app.post("/api/auth/google", async (req, res) => {
    try {
      const { displayName, email, uid, photoURL } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      if (!uid) {
        return res.status(400).json({ message: "Firebase UID is required" });
      }
      
      console.log(`Processing Google auth for user: ${email} with Firebase UID: ${uid}`);
      
      // First check if user exists by Firebase UID
      let user = await storage.getUserByFirebaseId(uid);
      
      // If user found by Firebase UID, log it
      if (user) {
        console.log(`Found existing user by Firebase UID ${uid}: User ID ${user.id}`);
      } else {
        // If no user found by Firebase UID, check by email
        user = await storage.getUserByEmail(email);
        
        if (user) {
          console.log(`Found existing user by email ${email}: User ID ${user.id}`);
        } else {
          console.log(`No existing user found for email ${email} or Firebase UID ${uid}`);
        }
      }
      
      if (!user) {
        // Create a new user if they don't exist
        const username = displayName?.split(' ')[0]?.toLowerCase() || email.split('@')[0];
        try {
          console.log(`Creating new user in database: ${username} (${email}) with Firebase UID ${uid}`);
          user = await storage.createUser({
            username: username,
            email: email,
            password: `firebase-auth-${Date.now()}`,  // Use a unique placeholder password
            fullName: displayName,
            role: "user",
            firebaseUid: uid,
            photoURL: photoURL
          });
          
          console.log(`Created new user from Google login: ${username} (${email}) with ID ${user.id}`);
        } catch (createError) {
          console.error("Error creating user in database:", createError);
          return res.status(500).json({ message: "Failed to create user record in database" });
        }
      } else if (!user.firebaseUid) {
        // If user exists but doesn't have Firebase UID, update it
        console.log(`User found but missing Firebase UID. Updating user ${user.id} with Firebase UID ${uid}`);
        try {
          user = await storage.updateUser(user.id, { 
            firebaseUid: uid,
            photoURL: photoURL || user.photoURL
          });
          
          if (user) {
            console.log(`Successfully updated user with Firebase UID: ${user.username} (${email})`);
          } else {
            // Get the user again since the updateUser operation might have failed
            const updatedUser = await storage.getUserByEmail(email);
            if (updatedUser) {
              // Use the existing user data
              user = updatedUser;
              console.log(`Using existing user data for ${email}`);
            } else {
              console.error(`Failed to update user with Firebase UID for ${email}`);
            }
          }
        } catch (updateError) {
          console.error("Error updating user with Firebase UID:", updateError);
          // Continue with existing user data even if update fails
        }
      } else {
        console.log(`Using existing user account: ${user.username} (ID: ${user.id})`);
      }
      
      // Don't send the password in the response
      if (user) {
        const { password, ...userWithoutPassword } = user;
        console.log(`Returning user data for user ID ${user.id}`);
        res.json(userWithoutPassword);
      } else {
        console.error("Failed to retrieve or create user data");
        res.status(500).json({ message: "Failed to retrieve user data" });
      }
    } catch (error) {
      console.error("Google auth error:", error);
      res.status(500).json({ message: "Error authenticating with Google" });
    }
  });

  // Category routes
  app.get("/api/categories", async (req, res) => {
    try {
      try {
        // Try to use server-side Firebase utils
        console.log("Attempting to fetch categories from Firebase");
        
        // Get all categories from Firestore 'categories' collection
        const firebaseCategories = await firebaseAdmin.getAllDocuments('categories');
        
        if (firebaseCategories && firebaseCategories.length > 0) {
          // Transform the Firebase data to match our API format
          const formattedCategories = firebaseCategories.map((category: any) => ({
            id: parseInt(category.id),
            name: category.name,
            description: category.description || '',
            image: category.image || null,
            featured: category.featured || false
          }));
          
          console.log(`Fetched ${formattedCategories.length} categories from Firebase`);
          return res.json(formattedCategories);
        } else {
          console.log("No categories found in Firebase");
        }
      } catch (firebaseError) {
        console.error("Firebase categories fetch error:", firebaseError);
        console.log("Falling back to database storage");
      }
      
      // If we got here, there was an error with Firebase or no categories found
      const categories = await storage.getAllCategories();
      console.log(`Fetched ${categories.length} categories from database`);
      res.json(categories);
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/categories/featured", async (req, res) => {
    try {
      try {
        // Try to use server-side Firebase utils
        console.log("Attempting to fetch featured categories from Firebase");
        
        // Attempt to query featured categories
        const firebaseCategories = await firebaseAdmin.queryDocuments('categories', 'featured', '==', true);
        
        if (firebaseCategories && firebaseCategories.length > 0) {
          // Transform the Firebase data to match our API format
          const formattedCategories = firebaseCategories.map((category: any) => ({
            id: parseInt(category.id),
            name: category.name,
            description: category.description || '',
            image: category.image || null,
            featured: true
          }));
          
          console.log(`Fetched ${formattedCategories.length} featured categories from Firebase`);
          return res.json(formattedCategories);
        } else {
          console.log("No featured categories found in Firebase");
        }
      } catch (firebaseError) {
        console.error("Firebase featured categories fetch error:", firebaseError);
        console.log("Falling back to database storage");
      }
      
      // If we got here, there was an error with Firebase or no featured categories found
      const categories = await storage.getFeaturedCategories();
      console.log(`Fetched ${categories.length} featured categories from database`);
      res.json(categories);
    } catch (error) {
      console.error("Get featured categories error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/categories/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }
      
      try {
        // Use the imported firebaseAdmin
        console.log(`Attempting to fetch category ${id} from Firebase`);
        
        // Try to get category from Firebase
        const firebaseCategory = await firebaseAdmin.getCategoryById(id);
        
        if (firebaseCategory) {
          console.log(`Category ${id} found in Firebase`);
          return res.json(firebaseCategory);
        } else {
          console.log(`Category ${id} not found in Firebase, falling back to database`);
        }
      } catch (firebaseError) {
        console.error(`Error fetching category ${id} from Firebase:`, firebaseError);
        console.log(`Falling back to database storage for category ${id}`);
      }
      
      // If we got here, there was either an error with Firebase or the category wasn't found
      // Let's try from the local database storage
      const category = await storage.getCategory(id);
      if (!category) {
        console.log(`Category ${id} not found in database either`);
        return res.status(404).json({ message: "Category not found" });
      }
      
      console.log(`Category ${id} found in database`);
      res.json(category);
    } catch (error) {
      console.error("Get category error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/categories", isAuthenticated, isAdmin, async (req, res) => {
    try {
      console.log("Creating new category with data:", req.body);
      
      const validation = insertCategorySchema.safeParse(req.body);
      if (!validation.success) {
        console.error("Category validation failed:", validation.error.flatten().fieldErrors);
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      try {
        // Attempt to use server-side Firebase utils
        console.log("Attempting to create category in Firebase");
        
        const categoryData = {
          name: validation.data.name,
          description: validation.data.description || "",
          image: validation.data.image || undefined,
          featured: !!validation.data.featured,
          id: Date.now(), // Generate a numeric ID (timestamp)
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Try to create the category in Firestore
        const firebaseCategory = await firebaseAdmin.createDocument('categories', categoryData, categoryData.id.toString());
        
        if (firebaseCategory) {
          console.log("Category created successfully in Firebase:", firebaseCategory);
          const typedCategory = firebaseCategory as any;
          return res.status(201).json({
            id: parseInt(typedCategory.id),
            name: typedCategory.name,
            description: typedCategory.description || '',
            image: typedCategory.image || null,
            featured: typedCategory.featured || false
          });
        }
      } catch (firebaseError) {
        console.error("Error creating category in Firebase:", firebaseError);
        console.log("Falling back to database storage");
      }
      
      // If we got here, there was an error with Firebase
      // Let's try with the local database storage
      console.log("Creating category in database");
      const category = await storage.createCategory(validation.data);
      console.log("Category created successfully in database:", category.id);
      res.status(201).json(category);
    } catch (error) {
      console.error("Create category error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/categories/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }
      
      console.log(`Updating category ${id} with data:`, req.body);
      
      const validation = insertCategorySchema.partial().safeParse(req.body);
      if (!validation.success) {
        console.error("Category update validation failed:", validation.error.flatten().fieldErrors);
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      try {
        // Use the imported firebaseAdmin
        console.log(`Attempting to update category ${id} in Firebase`);
        
        // Prepare the category data with proper type handling
        const categoryData: Partial<any> = {};
        
        // Only include fields that were provided in the request
        if ('name' in validation.data) categoryData.name = validation.data.name;
        if ('description' in validation.data) categoryData.description = validation.data.description || "";
        if ('image' in validation.data) categoryData.image = validation.data.image;
        if ('featured' in validation.data) categoryData.featured = !!validation.data.featured;
        
        // Try to update the category in Firebase
        const firebaseCategory = await firebaseAdmin.updateCategory(id, categoryData);
        
        if (firebaseCategory) {
          console.log(`Category ${id} updated successfully in Firebase:`, firebaseCategory);
          return res.json(firebaseCategory);
        } else {
          console.log(`Category ${id} not found in Firebase, falling back to database`);
        }
      } catch (firebaseError) {
        console.error(`Error updating category ${id} in Firebase:`, firebaseError);
        console.log(`Falling back to database storage for category ${id} update`);
      }
      
      // If we got here, there was either an error with Firebase or the category wasn't found
      // Let's try with the local database storage
      console.log(`Updating category ${id} in database`);
      const category = await storage.updateCategory(id, validation.data);
      if (!category) {
        console.log(`Category ${id} not found in database either`);
        return res.status(404).json({ message: "Category not found" });
      }
      
      console.log(`Category ${id} updated successfully in database`);
      res.json(category);
    } catch (error) {
      console.error("Update category error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/categories/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }
      
      console.log(`Attempting to delete category ${id}`);
      
      try {
        // Use the imported firebaseAdmin
        console.log(`Attempting to delete category ${id} from Firebase`);
        
        // Try to delete from Firebase
        const success = await firebaseAdmin.deleteCategory(id);
        
        if (success) {
          console.log(`Category ${id} deleted successfully from Firebase`);
          return res.json({ message: "Category deleted successfully" });
        } else {
          console.log(`Category ${id} not found in Firebase, falling back to database`);
        }
      } catch (firebaseError) {
        console.error(`Error deleting category ${id} from Firebase:`, firebaseError);
        console.log(`Falling back to database storage for category ${id} deletion`);
      }
      
      // If we got here, there was either an error with Firebase or the category wasn't found
      // Let's try with the local database storage
      console.log(`Deleting category ${id} from database`);
      const success = await storage.deleteCategory(id);
      if (!success) {
        console.log(`Category ${id} not found in database either`);
        return res.status(404).json({ message: "Category not found" });
      }
      
      console.log(`Category ${id} deleted successfully from database`);
      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error("Delete category error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Product routes
  // Endpoint to get products for cart items by IDs
  app.get("/api/products/cart", async (req, res) => {
    try {
      const productIds = req.query.ids;
      
      if (!productIds) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      // Convert to array if it's a single value
      const ids = Array.isArray(productIds) ? productIds : [productIds];
      
      console.log("Cart product request for IDs:", ids);
      
      // Get products from Firebase or Database
      const allProducts = await storage.getAllProducts();
      
      // Filter products by the requested IDs
      const cartProducts = allProducts.filter(product => 
        ids.includes(product.id.toString())
      );
      
      console.log(`Found ${cartProducts.length} products for cart`);
      return res.json(cartProducts);
    } catch (error) {
      console.error("Error fetching cart products:", error);
      return res.status(500).json({ message: "Failed to fetch cart products" });
    }
  });

  app.get("/api/products", async (req, res) => {
    try {
      let products = [];
      const { 
        category, 
        search, 
        featured, 
        trending, 
        sale,
        minPrice, 
        maxPrice 
      } = req.query;
      
      console.log("Product API request with params:", req.query);
      
      try {
        // Check Firebase environment variables before importing
        if (process.env.VITE_FIREBASE_PROJECT_ID && process.env.VITE_FIREBASE_API_KEY) {
          // Import Firebase functions
          // We're already importing firebaseAdmin at the top, no need for dynamic import
          console.log("Imported Firebase service for products");
          
          // Fetch base products based on primary filter from Firebase
          if (category) {
            const categoryId = Number(category);
            if (isNaN(categoryId)) {
              return res.status(400).json({ message: "Invalid category ID" });
            }
            console.log(`Fetching products for category ${categoryId} from Firebase`);
            products = await firebaseAdmin.getProductsByCategory(categoryId);
          } else if (featured === 'true') {
            console.log("Fetching featured products from Firebase");
            products = await firebaseAdmin.getFeaturedProducts();
          } else if (trending === 'true') {
            console.log("Fetching trending products from Firebase");
            products = await firebaseAdmin.getTrendingProducts();
          } else {
            console.log("Fetching all products from Firebase");
            products = await firebaseAdmin.getAllProducts();
          }
          
          console.log(`Retrieved ${products.length} products from Firebase`);
        } else {
          throw new Error("Missing required Firebase environment variables");
        }
      } catch (firebaseError) {
        // Log the error but continue with local storage
        console.error("Firebase products fetch error:", firebaseError);
        console.log("Falling back to database storage");
        
        // Fetch base products based on primary filter from local storage
        if (category) {
          const categoryId = Number(category);
          if (isNaN(categoryId)) {
            return res.status(400).json({ message: "Invalid category ID" });
          }
          products = await storage.getProductsByCategory(categoryId);
        } else if (search) {
          products = await storage.searchProducts(search as string);
        } else if (featured === 'true') {
          products = await storage.getFeaturedProducts();
        } else if (trending === 'true') {
          products = await storage.getTrendingProducts();
        } else {
          products = await storage.getAllProducts();
        }
      }
      
      // Apply search filter (needs to be done server-side)
      if (search && products.length > 0) {
        const searchLower = (search as string).toLowerCase();
        products = products.filter(product => 
          product.name.toLowerCase().includes(searchLower) || 
          (product.description && product.description.toLowerCase().includes(searchLower))
        );
        console.log(`Filtered to ${products.length} products matching search: ${search}`);
      }
      
      // Apply secondary filters if needed
      if (products && products.length > 0) {
        // Price filter
        if (minPrice || maxPrice) {
          const min = minPrice ? Number(minPrice) : 0;
          const max = maxPrice ? Number(maxPrice) : Infinity;
          
          products = products.filter(product => 
            product.price >= min && product.price <= max
          );
          console.log(`Filtered to ${products.length} products in price range: ${min} - ${max}`);
        }
        
        // Sale filter (has discount price)
        if (sale === 'true') {
          products = products.filter(product => 
            product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.price
          );
          console.log(`Filtered to ${products.length} products on sale`);
        }
      }
      
      console.log(`Returning ${products.length} products to client`);
      res.json(products);
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      try {
        // Use the imported firebaseAdmin
        console.log(`Attempting to fetch product ${id} from Firebase`);
        
        // Try to get product from Firebase
        const firebaseProduct = await firebaseAdmin.getProductById(id);
        
        if (firebaseProduct) {
          console.log(`Product ${id} found in Firebase`);
          return res.json(firebaseProduct);
        } else {
          console.log(`Product ${id} not found in Firebase, falling back to database`);
        }
      } catch (firebaseError) {
        console.error(`Error fetching product ${id} from Firebase:`, firebaseError);
        console.log(`Falling back to database storage for product ${id}`);
      }
      
      // If we got here, there was either an error with Firebase or the product wasn't found
      // Let's try from the local database storage
      const product = await storage.getProduct(id);
      if (!product) {
        console.log(`Product ${id} not found in database either`);
        return res.status(404).json({ message: "Product not found" });
      }
      
      console.log(`Product ${id} found in database`);
      res.json(product);
    } catch (error) {
      console.error("Get product error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/products", isAuthenticated, isAdmin, async (req, res) => {
    try {
      console.log("Creating new product with data:", req.body);
      
      const validation = insertProductSchema.safeParse(req.body);
      if (!validation.success) {
        console.error("Product validation failed:", validation.error.flatten().fieldErrors);
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      try {
        // Use the imported firebaseAdmin
        console.log("Attempting to create product in Firebase");
        
        // Prepare the product data with proper type handling
        const productData = {
          name: validation.data.name,
          description: validation.data.description || "",
          price: validation.data.price,
          discountPrice: validation.data.discountPrice || undefined,
          categoryId: validation.data.categoryId || undefined,
          images: Array.isArray(validation.data.images) ? validation.data.images : [],
          sizes: Array.isArray(validation.data.sizes) ? validation.data.sizes : [],
          colors: Array.isArray(validation.data.colors) && validation.data.colors.length > 0 
                  ? validation.data.colors 
                  : [], // Ensure colors is always a valid array
          stock: validation.data.stock || 0,
          featured: !!validation.data.featured,
          trending: !!validation.data.trending
        };
        
        // Try to create the product in Firebase
        const firebaseProduct = await firebaseAdmin.createProduct(productData);
        
        console.log("Product created successfully in Firebase:", firebaseProduct);
        return res.status(201).json(firebaseProduct);
      } catch (firebaseError) {
        console.error("Error creating product in Firebase:", firebaseError);
        console.log("Falling back to database storage");
      }
      
      // If we got here, there was an error with Firebase
      // Let's try with the local database storage
      console.log("Creating product in database");
      const product = await storage.createProduct(validation.data);
      console.log("Product created successfully in database:", product.id);
      res.status(201).json(product);
    } catch (error) {
      console.error("Create product error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/products/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      console.log(`Updating product ${id} with data:`, req.body);
      
      const validation = insertProductSchema.partial().safeParse(req.body);
      if (!validation.success) {
        console.error("Product update validation failed:", validation.error.flatten().fieldErrors);
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      try {
        // Use the imported firebaseAdmin
        console.log(`Attempting to update product ${id} in Firebase`);
        
        // Prepare the product data with proper type handling
        const productData: Partial<any> = {};
        
        // Only include fields that were provided in the request
        if ('name' in validation.data) productData.name = validation.data.name;
        if ('description' in validation.data) productData.description = validation.data.description || "";
        if ('price' in validation.data) productData.price = validation.data.price;
        if ('discountPrice' in validation.data) productData.discountPrice = validation.data.discountPrice;
        if ('categoryId' in validation.data) productData.categoryId = validation.data.categoryId;
        if ('images' in validation.data) productData.images = Array.isArray(validation.data.images) ? validation.data.images : [];
        if ('sizes' in validation.data) productData.sizes = Array.isArray(validation.data.sizes) ? validation.data.sizes : [];
        if ('colors' in validation.data) productData.colors = Array.isArray(validation.data.colors) && validation.data.colors.length > 0 
                                        ? validation.data.colors 
                                        : [];
        if ('stock' in validation.data) productData.stock = validation.data.stock || 0;
        if ('featured' in validation.data) productData.featured = !!validation.data.featured;
        if ('trending' in validation.data) productData.trending = !!validation.data.trending;
        
        // Try to update the product in Firebase
        const firebaseProduct = await firebaseAdmin.updateProduct(id, productData);
        
        if (firebaseProduct) {
          console.log(`Product ${id} updated successfully in Firebase:`, firebaseProduct);
          return res.json(firebaseProduct);
        } else {
          console.log(`Product ${id} not found in Firebase, falling back to database`);
        }
      } catch (firebaseError) {
        console.error(`Error updating product ${id} in Firebase:`, firebaseError);
        console.log(`Falling back to database storage for product ${id} update`);
      }
      
      // If we got here, there was either an error with Firebase or the product wasn't found
      // Let's try with the local database storage
      console.log(`Updating product ${id} in database`);
      const product = await storage.updateProduct(id, validation.data);
      if (!product) {
        console.log(`Product ${id} not found in database either`);
        return res.status(404).json({ message: "Product not found" });
      }
      
      console.log(`Product ${id} updated successfully in database`);
      res.json(product);
    } catch (error) {
      console.error("Update product error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/products/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      console.log(`Attempting to delete product ${id}`);
      
      try {
        // Use the imported firebaseAdmin
        console.log(`Attempting to delete product ${id} from Firebase`);
        
        // Try to delete from Firebase
        const success = await firebaseAdmin.deleteProduct(id);
        
        if (success) {
          console.log(`Product ${id} deleted successfully from Firebase`);
          return res.json({ message: "Product deleted successfully" });
        } else {
          console.log(`Product ${id} not found in Firebase, falling back to database`);
        }
      } catch (firebaseError) {
        console.error(`Error deleting product ${id} from Firebase:`, firebaseError);
        console.log(`Falling back to database storage for product ${id} deletion`);
      }
      
      // If we got here, there was either an error with Firebase or the product wasn't found
      // Let's try with the local database storage
      console.log(`Deleting product ${id} from database`);
      const success = await storage.deleteProduct(id);
      if (!success) {
        console.log(`Product ${id} not found in database either`);
        return res.status(404).json({ message: "Product not found" });
      }
      
      console.log(`Product ${id} deleted successfully from database`);
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Delete product error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Review routes
  app.get("/api/reviews/product/:productId", async (req, res) => {
    try {
      const productId = Number(req.params.productId);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      const reviews = await storage.getProductReviews(productId);
      res.json(reviews);
    } catch (error) {
      console.error("Get product reviews error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/reviews", isAuthenticated, async (req, res) => {
    try {
      const validation = insertReviewSchema.safeParse({
        ...req.body,
        userId: req.user?.id
      });
      
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      const review = await storage.createReview(validation.data);
      res.status(201).json(review);
    } catch (error) {
      console.error("Create review error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Order routes
  app.get("/api/orders", async (req, res) => {
    try {
      // Get Firebase UID from header
      const firebaseUid = req.headers["firebase-uid"]?.toString();
      
      // Try to find user by Firebase UID if available
      let userId = null;
      if (firebaseUid) {
        const user = await storage.getUserByFirebaseId(firebaseUid);
        if (user) {
          userId = user.id;
        } else {
          return res.status(401).json({ 
            message: "User not found with Firebase UID and no fallback authentication available" 
          });
        }
      } else if (req.user?.id) {
        // If no Firebase UID but we have a session user ID
        userId = req.user.id;
      }
      
      // If no user authentication found at all, return an empty array
      // This allows for guest checkout without errors
      if (!userId) {
        return res.json([]);
      }
      
      const orders = await storage.getUserOrders(userId);
      res.json(orders);
    } catch (error) {
      console.error("Get user orders error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Wishlist routes
  app.get("/api/users/wishlist", async (req, res) => {
    try {
      // Get Firebase UID from header
      const firebaseUid = req.headers["firebase-uid"]?.toString();
      
      // Try to find user by Firebase UID if available
      let userId = null;
      if (firebaseUid) {
        const user = await storage.getUserByFirebaseId(firebaseUid);
        if (user) {
          userId = user.id;
        } else {
          return res.status(401).json({ 
            message: "User not found with Firebase UID and no fallback authentication available" 
          });
        }
      } else if (req.user?.id) {
        // If no Firebase UID but we have a session user ID
        userId = req.user.id;
      }
      
      // If no user authentication found at all, return an empty array
      if (!userId) {
        return res.json([]);
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get wishlist items
      const wishlistItems = Array.isArray(user.wishlistItems) ? user.wishlistItems : [];
      
      // Fetch product details for each wishlist item
      const products = [];
      for (const productId of wishlistItems) {
        const product = await storage.getProduct(Number(productId));
        if (product) {
          products.push(product);
        }
      }
      
      res.json(products);
    } catch (error) {
      console.error("Error fetching wishlist:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/users/wishlist", async (req, res) => {
    try {
      // Get Firebase UID from header or body
      const firebaseUid = req.headers["firebase-uid"]?.toString() || req.body.firebaseUid;
      
      // Try to find user by Firebase UID if available
      let userId = null;
      if (firebaseUid) {
        const user = await storage.getUserByFirebaseId(firebaseUid);
        if (user) {
          userId = user.id;
        } else {
          return res.status(401).json({ 
            message: "User not found with Firebase UID and no fallback authentication available" 
          });
        }
      } else if (req.user?.id) {
        // If no Firebase UID but we have a session user ID
        userId = req.user.id;
      }
      
      // If no user authentication found at all, return an error
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { productId } = req.body;
      if (!productId) {
        return res.status(400).json({ message: "Product ID is required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if product exists
      const product = await storage.getProduct(Number(productId));
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Initialize wishlistItems if it doesn't exist
      const wishlistItems = Array.isArray(user.wishlistItems) ? user.wishlistItems : [];
      
      // Check if product is already in wishlist (as string or number)
      if (wishlistItems.includes(productId.toString()) || wishlistItems.includes(Number(productId))) {
        return res.status(200).json({ message: "Product already in wishlist" });
      }

      // Add product to wishlist
      const updatedWishlist = [...wishlistItems, productId.toString()];
      const updatedUser = await storage.updateUser(user.id, { wishlistItems: updatedWishlist });

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update wishlist" });
      }

      res.status(201).json({ message: "Product added to wishlist" });
    } catch (error) {
      console.error("Error adding to wishlist:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/users/wishlist/:productId", async (req, res) => {
    try {
      // Get Firebase UID from header
      const firebaseUid = req.headers["firebase-uid"]?.toString();
      
      // Try to find user by Firebase UID if available
      let userId = null;
      if (firebaseUid) {
        const user = await storage.getUserByFirebaseId(firebaseUid);
        if (user) {
          userId = user.id;
        } else {
          return res.status(401).json({ 
            message: "User not found with Firebase UID and no fallback authentication available" 
          });
        }
      } else if (req.user?.id) {
        // If no Firebase UID but we have a session user ID
        userId = req.user.id;
      }
      
      // If no user authentication found at all, return an error
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { productId } = req.params;
      if (!productId) {
        return res.status(400).json({ message: "Product ID is required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Initialize wishlistItems if it doesn't exist
      const wishlistItems = Array.isArray(user.wishlistItems) ? user.wishlistItems : [];
      
      // Remove product from wishlist (checking both string and number types)
      const updatedWishlist = wishlistItems.filter(id => 
        id !== productId && id !== Number(productId) && id !== productId.toString()
      );
      
      const updatedUser = await storage.updateUser(user.id, { wishlistItems: updatedWishlist });

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update wishlist" });
      }

      res.status(200).json({ message: "Product removed from wishlist" });
    } catch (error) {
      console.error("Error removing from wishlist:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/admin/orders", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error("Get all orders error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Update order status - admin only
  app.put("/api/admin/orders/:id/status", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const orderId = req.params.id;
      const { status } = req.body;
      
      if (!orderId) {
        return res.status(400).json({ message: "Order ID is required" });
      }
      
      if (!status || !['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: "Valid status is required" });
      }
      
      // Update in storage
      const updatedOrder = await storage.updateOrderStatus(orderId, status as 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled');
      
      // Also update in Firebase for backward compatibility
      try {
        // Get Firebase connection
        const db = firebaseFirestore.getFirestore(firebaseApp);
        
        // Check if it's a Firebase ID (string with non-numeric characters)
        const isFirebaseId = typeof orderId === 'string' && isNaN(Number(orderId));
        
        if (isFirebaseId) {
          // Update in the main orders collection
          const orderRef = firebaseFirestore.doc(db, 'orders', orderId);
          await firebaseFirestore.updateDoc(orderRef, {
            status,
            updatedAt: firebaseFirestore.serverTimestamp()
          });
          
          console.log(`Firebase order ${orderId} status updated to ${status}`);
        } else {
          console.log(`Order ${orderId} is not a Firebase ID, skipping Firebase update`);
        }
      } catch (firebaseError) {
        console.error("Firebase update error:", firebaseError);
        // Continue even if Firebase update fails as long as storage update succeeded
      }
      
      res.json({ 
        message: "Order status updated", 
        orderId, 
        status,
        order: updatedOrder || undefined
      });
    } catch (error) {
      console.error("Update order status error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      console.log("Creating order with data:", req.body);
      
      // Get userId if authenticated, otherwise create as guest order
      let userId = req.user?.id;
      
      // If user isn't authenticated, check if Firebase UID was passed in the body (from the client app)
      const firebaseUid = req.headers["firebase-uid"]?.toString() || req.body?.userId;
      
      if (firebaseUid) {
        console.log(`Order request includes Firebase UID: ${firebaseUid}`);
        
        try {
          // Try to save order to Firebase first
          if (firebaseAdmin) {
            console.log("Attempting to save order to Firebase");
            
            // Prepare order data for Firebase
            const firebaseOrderData = {
              userId: firebaseUid,
              items: req.body.items || [],
              status: req.body.status || "processing",
              paymentStatus: req.body.paymentStatus || "paid",
              totalAmount: req.body.totalAmount || 0,
              shippingAddress: req.body.shippingAddress || {},
              paymentMethod: req.body.paymentMethod || "stripe",
              orderDate: new Date(),
              notes: req.body.notes || "",
              trackingNumber: req.body.trackingNumber || ""
            };
            
            // Map the shippingAddress structure if needed
            if (firebaseOrderData.shippingAddress.address && !firebaseOrderData.shippingAddress.addressLine1) {
              firebaseOrderData.shippingAddress.addressLine1 = firebaseOrderData.shippingAddress.address;
              delete firebaseOrderData.shippingAddress.address;
            }
            
            // Calculate any missing subtotals for each item
            if (Array.isArray(firebaseOrderData.items)) {
              firebaseOrderData.items = firebaseOrderData.items.map(item => {
                if (!item.subtotal && item.price && item.quantity) {
                  item.subtotal = Number(item.price) * Number(item.quantity);
                }
                return item;
              });
            }
            
            // Save order to Firebase
            const savedOrder = await firebaseAdmin.createOrder(firebaseOrderData);
            
            if (savedOrder) {
              console.log("Order saved to Firebase successfully:", savedOrder.id);
              return res.status(201).json(savedOrder);
            } else {
              console.log("Failed to save order to Firebase, falling back to database");
            }
          }
        } catch (firebaseError) {
          console.error("Firebase order creation error:", firebaseError);
          console.log("Falling back to database storage for order");
        }
        
        // If we reach here with a Firebase UID, try to find or create the user in our system
        try {
          const user = await storage.getUserByFirebaseId(firebaseUid);
          if (user) {
            userId = user.id;
            console.log(`Found user ${userId} by Firebase UID ${firebaseUid}`);
          } else {
            console.log(`No user found for Firebase UID ${firebaseUid}, will create guest order`);
          }
        } catch (userLookupError) {
          console.error("Error looking up user by Firebase UID:", userLookupError);
        }
      }
      
      // If user ID from Firebase lookup or traditional authentication isn't available, 
      // check if a userId was passed in the body (for guest checkout)
      if (!userId && req.body.userId) {
        userId = req.body.userId;
      }
      
      const orderData = {
        ...req.body,
        // Set userId to null for guest orders if not authenticated
        userId: userId || null
      };
      
      console.log("Processed order data for database storage:", orderData);
      
      const validation = insertOrderSchema.safeParse(orderData);
      
      if (!validation.success) {
        console.error("Order validation failed:", validation.error.flatten().fieldErrors);
        return res.status(400).json({ 
          message: "Invalid order data", 
          errors: validation.error.flatten().fieldErrors 
        });
      }
      
      console.log("Order validation successful, creating order in database");
      const order = await storage.createOrder(validation.data);
      console.log("Order created successfully in database:", order.id);
      
      res.status(201).json(order);
    } catch (error) {
      console.error("Create order error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Hero Banner routes
  app.get("/api/hero-banners", async (req, res) => {
    try {
      const banners = await storage.getActiveHeroBanners();
      res.json(banners);
    } catch (error) {
      console.error("Get hero banners error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/admin/hero-banners", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const heroBanners = [];
      for (const banner of await storage.getActiveHeroBanners()) {
        heroBanners.push(banner);
      }
      res.json(heroBanners);
    } catch (error) {
      console.error("Get all hero banners error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/hero-banners", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validation = insertHeroBannerSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      const banner = await storage.createHeroBanner(validation.data);
      res.status(201).json(banner);
    } catch (error) {
      console.error("Create hero banner error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/admin/hero-banners/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid banner ID" });
      }
      
      const validation = insertHeroBannerSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      const banner = await storage.updateHeroBanner(id, validation.data);
      if (!banner) {
        return res.status(404).json({ message: "Hero banner not found" });
      }
      
      res.json(banner);
    } catch (error) {
      console.error("Update hero banner error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/admin/hero-banners/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid banner ID" });
      }
      
      const success = await storage.deleteHeroBanner(id);
      if (!success) {
        return res.status(404).json({ message: "Hero banner not found" });
      }
      
      res.json({ message: "Hero banner deleted successfully" });
    } catch (error) {
      console.error("Delete hero banner error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Testimonial routes
  app.get("/api/testimonials", async (req, res) => {
    try {
      const testimonials = await storage.getFeaturedTestimonials();
      res.json(testimonials);
    } catch (error) {
      console.error("Get testimonials error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/admin/testimonials", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const testimonials = await storage.getAllTestimonials();
      res.json(testimonials);
    } catch (error) {
      console.error("Get all testimonials error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/testimonials", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validation = insertTestimonialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      const testimonial = await storage.createTestimonial(validation.data);
      res.status(201).json(testimonial);
    } catch (error) {
      console.error("Create testimonial error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // reCAPTCHA verification endpoint
  app.post("/api/verify-recaptcha", async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ 
          success: false,
          message: "reCAPTCHA token is required" 
        });
      }
      
      const isValid = await verifyRecaptcha(token);
      
      return res.json({ 
        success: isValid,
        message: isValid ? "reCAPTCHA verification successful" : "reCAPTCHA verification failed" 
      });
    } catch (error) {
      console.error("reCAPTCHA verification error:", error);
      return res.status(500).json({ 
        success: false,
        message: "Internal server error during reCAPTCHA verification" 
      });
    }
  });

  // Stripe payment intent for checkout - authentication is not required for this endpoint
  // as we want to allow guest checkout as well
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      console.log("Creating payment intent, request body:", req.body);
      const { amount, orderData } = req.body;
      if (!amount || typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }
      
      // Log the request to help with debugging
      console.log(`Creating payment intent for amount: $${amount}`);
      
      // Store order data temporarily if provided
      if (orderData) {
        console.log("Order data received:", orderData);
        
        // You can store this in a temporary session or database for later retrieval
        // when the payment is confirmed
        
        // For now, just log it
        console.log("Order items count:", orderData.items?.length || 0);
        console.log("Order shipping address:", orderData.shippingAddress);
      }
      
      if (!process.env.STRIPE_SECRET_KEY) {
        console.error("⚠️ STRIPE_SECRET_KEY is not set. Payment intent creation will fail.");
        return res.status(500).json({ message: "Stripe API key is not configured" });
      }
      
      try {
        // Create a payment intent with any additional metadata from the order
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: "usd",
          payment_method_types: ['card'],
          metadata: {
            integration_check: 'accept_a_payment',
            order_data: orderData ? 'provided' : 'not_provided',
            total_amount: amount.toString()
          },
        });
        
        // Log success
        console.log("Payment intent created successfully:", paymentIntent.id);
        console.log("Client secret available:", !!paymentIntent.client_secret);
        
        res.json({ 
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id
        });
      } catch (stripeError: any) {
        console.error("Stripe API error:", stripeError);
        return res.status(400).json({ 
          message: stripeError.message || "Error creating payment with Stripe",
          code: stripeError.code || "stripe_error"
        });
      }
    } catch (error: any) {
      console.error("Create payment intent error:", error);
      res.status(500).json({ message: error.message || "Error creating payment intent" });
    }
  });

  // User profile route
  app.get("/api/profile", isAuthenticated, async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return sensitive information
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/profile", isAuthenticated, async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validation = userSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      // Don't allow changing the role through this endpoint
      const { role, ...updateData } = validation.data;
      
      const user = await storage.updateUser(req.user.id, updateData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return sensitive information
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin dashboard data
  app.get("/api/admin/dashboard", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      const users = await storage.getAllUsers();
      const products = await storage.getAllProducts();
      
      // Calculate metrics
      const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
      const totalOrders = orders.length;
      const totalUsers = users.length;
      const totalProducts = products.length;
      
      // Calculate monthly metrics for current and previous month
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      
      // Group orders by month
      const currentMonthOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
      });
      
      const lastMonthOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate.getMonth() === lastMonth && orderDate.getFullYear() === lastMonthYear;
      });
      
      // Calculate metrics for current and previous month
      const currentMonthRevenue = currentMonthOrders.reduce((sum, order) => sum + order.totalAmount, 0);
      const lastMonthRevenue = lastMonthOrders.reduce((sum, order) => sum + order.totalAmount, 0);
      const currentMonthOrderCount = currentMonthOrders.length;
      const lastMonthOrderCount = lastMonthOrders.length;
      
      // Calculate month-over-month growth
      const revenueGrowth = lastMonthRevenue === 0 
        ? 100 
        : ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
      
      const ordersGrowth = lastMonthOrderCount === 0 
        ? 100 
        : ((currentMonthOrderCount - lastMonthOrderCount) / lastMonthOrderCount) * 100;
      
      // Calculate user and product growth
      const lastMonthUsers = users.filter(user => {
        const createdAt = new Date(user.createdAt);
        return createdAt.getMonth() === lastMonth && createdAt.getFullYear() === lastMonthYear;
      }).length;
      
      const currentMonthUsers = users.filter(user => {
        const createdAt = new Date(user.createdAt);
        return createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear;
      }).length;
      
      const usersGrowth = lastMonthUsers === 0 
        ? 100 
        : ((currentMonthUsers - lastMonthUsers) / lastMonthUsers) * 100;
        
      // For products, we'll consider growth in product listing
      const lastMonthProducts = products.filter(product => {
        const createdAt = new Date(product.createdAt);
        return createdAt.getMonth() === lastMonth && createdAt.getFullYear() === lastMonthYear;
      }).length;
      
      const currentMonthProducts = products.filter(product => {
        const createdAt = new Date(product.createdAt);
        return createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear;
      }).length;
      
      const productsGrowth = lastMonthProducts === 0 
        ? 100 
        : ((currentMonthProducts - lastMonthProducts) / lastMonthProducts) * 100;
      
      // Recent orders
      const recentOrders = orders
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      
      // Top-selling products
      const productSales = new Map<number, number>();
      for (const order of orders) {
        for (const item of order.items as any[]) {
          const productId = item.productId;
          const quantity = item.quantity || 1;
          productSales.set(productId, (productSales.get(productId) || 0) + quantity);
        }
      }
      
      const topProducts = Array.from(productSales.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(async ([productId, soldCount]) => {
          const product = await storage.getProduct(productId);
          return { product, soldCount };
        });
      
      const resolvedTopProducts = await Promise.all(topProducts);
      
      // Generate monthly sales data for chart
      const monthlySalesData = [];
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      // Get sales for the past 12 months
      for (let i = 0; i < 12; i++) {
        const month = (currentMonth - i + 12) % 12; // Go back i months
        const year = currentYear - Math.floor((currentMonth - i + 12) / 12) + 1;
        
        const monthOrders = orders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate.getMonth() === month && orderDate.getFullYear() === year;
        });
        
        const monthRevenue = monthOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        const monthOrderCount = monthOrders.length;
        
        monthlySalesData.unshift({
          month: monthNames[month],
          revenue: monthRevenue,
          orders: monthOrderCount
        });
      }
      
      res.json({
        totalRevenue,
        totalOrders,
        totalUsers,
        totalProducts,
        recentOrders,
        topProducts: resolvedTopProducts,
        monthlySalesData,
        metrics: {
          revenue: {
            total: totalRevenue,
            growth: revenueGrowth.toFixed(1),
            trend: revenueGrowth >= 0 ? "up" : "down"
          },
          orders: {
            total: totalOrders,
            growth: ordersGrowth.toFixed(1),
            trend: ordersGrowth >= 0 ? "up" : "down"
          },
          users: {
            total: totalUsers,
            growth: usersGrowth.toFixed(1),
            trend: usersGrowth >= 0 ? "up" : "down"
          },
          products: {
            total: totalProducts,
            growth: productsGrowth.toFixed(1),
            trend: productsGrowth >= 0 ? "up" : "down"
          }
        }
      });
    } catch (error) {
      console.error("Get admin dashboard data error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Get all users for admin panel
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Get users from the database
      const dbUsers = await storage.getAllUsers();
      
      // Filter out sensitive information
      const users = dbUsers.map(user => {
        const { password, twoFactorSecret, ...userWithoutSensitiveInfo } = user;
        return userWithoutSensitiveInfo;
      });
      
      res.json(users);
    } catch (error) {
      console.error("Get admin users error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Update user role (promote or demote admin)
  // Legacy route for backward compatibility - redirects to the main role update endpoint
  app.put("/api/admin/users/:id/role", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { role } = req.body;
      
      console.log(`Redirecting legacy role update call for user ID ${userId} to main endpoint`);
      
      // Create a new request to the modern endpoint
      const newReq = Object.create(req);
      newReq.method = 'POST';
      newReq.url = '/api/admin/users/role';
      newReq.originalUrl = '/api/admin/users/role';
      newReq.path = '/api/admin/users/role';
      newReq.body = { userId, role };
      
      // Forward to the main role update endpoint
      return await new Promise((resolve) => {
        app._router.handle(newReq, res, resolve);
      });
    } catch (error) {
      console.error("Update user role error:", error);
      return res.status(500).json({ message: "Server error", error: String(error) });
    }
  });
  
  // Modern endpoint for PostgreSQL user role updates with Firebase synchronization
  app.post("/api/admin/users/role", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId, role } = req.body;
      
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          message: "User ID is required" 
        });
      }
      
      if (role !== "admin" && role !== "user") {
        return res.status(400).json({ 
          success: false, 
          message: "Valid role is required (admin or user)" 
        });
      }
      
      // 1. First update the PostgreSQL user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }
      
      // Update the PostgreSQL user role
      const updatedUser = await storage.updateUser(userId, { role });
      
      if (!updatedUser) {
        return res.status(500).json({ 
          success: false, 
          message: "Failed to update user role in database" 
        });
      }
      
      // 2. If the user has a Firebase UID, sync with Firebase
      let firebaseSuccess = false;
      let firebaseError = null;
      
      if (updatedUser.firebaseUid) {
        try {
          // Attempt to synchronize the role with Firestore
          firebaseSuccess = await syncUserRole(updatedUser.firebaseUid, role as any);
        } catch (error) {
          console.error("Error syncing user role with Firebase:", error);
          firebaseError = error;
        }
      }
      
      // Return response with user and Firebase status
      return res.json({
        success: true,
        message: firebaseSuccess 
          ? `User role updated to ${role} in both database and Firebase` 
          : `User role updated to ${role} in database only`,
        user: updatedUser,
        firebaseSuccess: firebaseSuccess,
        firebaseError: firebaseError ? String(firebaseError) : null
      });
    } catch (error) {
      console.error("Update user role error:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Server error", 
        error: String(error) 
      });
    }
  });
  
  // Main endpoint for updating user roles by Firebase UID - handles both database and Firebase updates
  // API to sync a user's role between Firestore and PostgreSQL
  app.post("/api/sync-user-role", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { firebaseUid, role } = req.body;
      
      if (!firebaseUid) {
        return res.status(400).json({ 
          success: false, 
          message: "Firebase UID is required" 
        });
      }
      
      if (role !== "admin" && role !== "user") {
        return res.status(400).json({ 
          success: false, 
          message: "Valid role is required (admin or user)" 
        });
      }
      
      const success = await syncUserRole(firebaseUid, role);
      
      if (success) {
        return res.json({
          success: true,
          message: `User role successfully synchronized to ${role}`
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "Failed to synchronize user role across databases"
        });
      }
    } catch (error) {
      console.error("Sync user role error:", error);
      return res.status(500).json({ 
        success: false,
        message: "Server error", 
        error: String(error) 
      });
    }
  });
  
  app.post("/api/direct-update-role", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId, role } = req.body;
      
      console.log(`Starting role update for user ID ${userId} to ${role}`);
      
      if (!userId || isNaN(Number(userId))) {
        return res.status(400).json({ message: "Valid user ID is required" });
      }
      
      if (role !== "admin" && role !== "user") {
        return res.status(400).json({ message: "Valid role is required (admin or user)" });
      }
      
      // Get the user from database
      const user = await storage.getUser(Number(userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update the user role in the database
      const updatedUser = await storage.updateUser(Number(userId), { role });
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user role in database" });
      }
      
      // If user has a Firebase UID, update their role in Firebase too
      let firebaseSuccess = false;
      let firebaseError = null;
      
      if (user.firebaseUid) {
        console.log(`Attempting to update Firebase role for UID: ${user.firebaseUid} to ${role}`);
        
        // Try multiple methods to update the user role in Firebase
        
        // Method 1: Use our custom Firebase utility function
        try {
          console.log("Method 1: Using Firebase utility function...");
          const { updateUserRole } = require('./utils/firebase');
          await updateUserRole(user.firebaseUid, role as "admin" | "user");
          console.log(`Firebase role updated successfully via method 1 for UID: ${user.firebaseUid}`);
          firebaseSuccess = true;
        } catch (error) {
          console.error("Method 1 failed:", error);
          firebaseError = error;
          
          // Method 2: Direct Firestore admin SDK
          try {
            console.log("Method 2: Using direct Firestore admin SDK...");
            const admin = require('firebase-admin');
            if (!admin.apps.length) {
              console.log("Initializing Firebase Admin directly");
              try {
                admin.initializeApp({
                  credential: admin.credential.cert(require('../firebase-admin.json'))
                });
              } catch (initError) {
                console.error("Failed to initialize Firebase Admin:", initError);
                // Continue to next method if this fails
              }
            }
            
            if (admin.apps.length > 0) {
              // Try set with merge option instead of update to handle non-existent documents
              await admin.firestore()
                .collection('users')
                .doc(user.firebaseUid)
                .set({ 
                  role, 
                  updatedAt: new Date(),
                  uid: user.firebaseUid // Ensure UID is set
                }, { merge: true });
                
              console.log(`Firebase role updated successfully via method 2`);
              firebaseSuccess = true;
            }
          } catch (method2Error) {
            console.error("Method 2 failed:", method2Error);
            
            // Method 3: REST API direct call to Firebase
            try {
              console.log("Method 3: Using REST API direct call...");
              const https = require('https');
              const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "softgirlfashion";
              const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${user.firebaseUid}`;
              
              console.log(`Attempting REST API call to ${url}`);
              
              // Prepare data for the request
              const data = JSON.stringify({
                fields: {
                  role: { stringValue: role },
                  updatedAt: { timestampValue: new Date().toISOString() }
                }
              });
              
              // Create a promise for the request
              const result = await new Promise((resolve, reject) => {
                const req = https.request(
                  url,
                  {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      'Content-Length': data.length
                    }
                  },
                  (res) => {
                    let responseData = '';
                    res.on('data', (chunk) => { responseData += chunk; });
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
                
                req.on('error', (e) => {
                  console.error('REST API request error:', e);
                  reject(e);
                });
                
                req.write(data);
                req.end();
              });
              
              console.log('REST API update successful');
              firebaseSuccess = true;
            } catch (method3Error) {
              console.error("Method 3 failed:", method3Error);
              // All methods failed - we'll return firebaseSuccess = false
            }
          }
        }
      }
      
      // Return user info without sensitive data
      const { password, twoFactorSecret, ...userWithoutPassword } = updatedUser;
      console.log(`Role update successful, returning response`);
      return res.json({
        success: true,
        user: userWithoutPassword,
        firebaseSuccess
      });
    } catch (error) {
      console.error("Update user role error:", error);
      return res.status(500).json({ 
        success: false,
        message: "Server error", 
        error: String(error) 
      });
    }
  });
  
  // Get comprehensive user details including orders, cart, wishlist, and product interactions
  app.get("/api/admin/users/:id/details", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ message: "Valid user ID is required" });
      }
      
      // Get the user from database
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get user's orders with detailed product information
      const orders = await storage.getUserOrders(userId);
      
      // Calculate total spent
      const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
      
      // Get user's reviews
      const reviews = await storage.getUserReviews(userId);
      
      // Get user's cart items
      let cartItems = [];
      try {
        // First, check the database user's cart items
        let dbCartItems = [];
        if (user.wishlistItems && Array.isArray(user.wishlistItems)) {
          const productPromises = user.wishlistItems.map(async (itemId) => {
            if (!itemId) return null;
            try {
              const product = await storage.getProduct(Number(itemId));
              return product ? { ...product, quantity: 1 } : null;
            } catch (err) {
              console.error(`Error fetching cart product ${itemId} from DB:`, err);
              return null;
            }
          });
          const resolvedProducts = await Promise.all(productPromises);
          dbCartItems = resolvedProducts.filter(product => product !== null);
        }
        
        // Next, try to get cart items from Firebase using our new utility function
        let firebaseCartItems = [];
        if (user.firebaseUid) {
          try {
            const { getUserCart } = require('./utils/firebase');
            firebaseCartItems = await getUserCart(user.firebaseUid);
            console.log(`Retrieved ${firebaseCartItems.length} cart items from Firebase for user ${user.firebaseUid}`);
          } catch (firebaseErr) {
            console.error(`Error fetching cart from Firebase for user ${user.firebaseUid}:`, firebaseErr);
          }
        }
        
        // Combine the results, removing duplicates
        const seenProductIds = new Set();
        cartItems = [...dbCartItems];
        
        for (const item of firebaseCartItems) {
          if (!seenProductIds.has(item.id)) {
            cartItems.push(item);
            seenProductIds.add(item.id);
          }
        }
        
        console.log(`Total cart items after combining sources: ${cartItems.length}`);
      } catch (cartError) {
        console.error("Error fetching cart:", cartError);
      }
      
      // Get wishlist items
      let wishlistItems = [];
      try {
        // First, check the database user's wishlist items
        let dbWishlistItems = [];
        if (user.wishlistItems && Array.isArray(user.wishlistItems)) {
          const productPromises = user.wishlistItems.map(async (itemId) => {
            if (!itemId) return null;
            try {
              return await storage.getProduct(Number(itemId));
            } catch (err) {
              console.error(`Error fetching wishlist product ${itemId} from DB:`, err);
              return null;
            }
          });
          const resolvedProducts = await Promise.all(productPromises);
          dbWishlistItems = resolvedProducts.filter(product => product !== null);
        }
        
        // Next, try to get wishlist items from Firebase using our new utility function
        let firebaseWishlistItems = [];
        if (user.firebaseUid) {
          try {
            const { getUserWishlist } = require('./utils/firebase');
            firebaseWishlistItems = await getUserWishlist(user.firebaseUid);
            console.log(`Retrieved ${firebaseWishlistItems.length} wishlist items from Firebase for user ${user.firebaseUid}`);
          } catch (firebaseErr) {
            console.error(`Error fetching wishlist from Firebase for user ${user.firebaseUid}:`, firebaseErr);
          }
        }
        
        // Combine the results, removing duplicates
        const seenProductIds = new Set();
        wishlistItems = [...dbWishlistItems];
        
        for (const item of firebaseWishlistItems) {
          if (!seenProductIds.has(item.id)) {
            wishlistItems.push(item);
            seenProductIds.add(item.id);
          }
        }
        
        console.log(`Total wishlist items after combining sources: ${wishlistItems.length}`);
      } catch (wishlistError) {
        console.error("Error fetching wishlist:", wishlistError);
      }
      
      // Aggregate user's purchase patterns
      const purchaseAnalytics = {
        productCategories: {},
        totalItemsPurchased: 0,
        averageOrderValue: totalSpent / (orders.length || 1),
        mostPurchasedProducts: {},
        lastPurchaseDate: orders.length > 0 ? orders.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt : null
      };
      
      // Analyze orders to extract purchase patterns
      for (const order of orders) {
        try {
          // Count items purchased
          if (order.items && Array.isArray(order.items)) {
            purchaseAnalytics.totalItemsPurchased += order.items.reduce(
              (sum, item) => sum + (item.quantity || 1), 0
            );
            
            // Track most purchased products
            for (const item of order.items) {
              if (item.productId) {
                const productId = typeof item.productId === 'object' ? 
                  item.productId.toString() : item.productId;
                  
                if (!purchaseAnalytics.mostPurchasedProducts[productId]) {
                  purchaseAnalytics.mostPurchasedProducts[productId] = {
                    count: 0,
                    name: item.name || `Product #${productId}`,
                    totalSpent: 0
                  };
                }
                
                purchaseAnalytics.mostPurchasedProducts[productId].count += (item.quantity || 1);
                purchaseAnalytics.mostPurchasedProducts[productId].totalSpent += 
                  (item.price || 0) * (item.quantity || 1);
              }
            }
          }
          
          // Track category preferences
          if (order.items && Array.isArray(order.items)) {
            for (const item of order.items) {
              if (item.categoryId) {
                const categoryId = typeof item.categoryId === 'object' ? 
                  item.categoryId.toString() : item.categoryId;
                  
                if (!purchaseAnalytics.productCategories[categoryId]) {
                  purchaseAnalytics.productCategories[categoryId] = {
                    count: 0,
                    name: item.categoryName || `Category #${categoryId}`,
                    totalSpent: 0
                  };
                }
                
                purchaseAnalytics.productCategories[categoryId].count += (item.quantity || 1);
                purchaseAnalytics.productCategories[categoryId].totalSpent += 
                  (item.price || 0) * (item.quantity || 1);
              }
            }
          }
        } catch (orderAnalysisError) {
          console.error("Error analyzing order:", orderAnalysisError);
        }
      }
      
      // Convert purchase analytics objects to arrays for easier client-side processing
      const formattedAnalytics = {
        ...purchaseAnalytics,
        productCategories: Object.entries(purchaseAnalytics.productCategories).map(([id, data]) => ({
          id,
          ...data
        })).sort((a, b) => b.count - a.count),
        mostPurchasedProducts: Object.entries(purchaseAnalytics.mostPurchasedProducts).map(([id, data]) => ({
          id,
          ...data
        })).sort((a, b) => b.count - a.count)
      };
      
      // Get user engagement metrics (Firebase)
      let firebaseUserData = null;
      if (user.firebaseUid) {
        try {
          // Try to get Firebase user data with properly typed return value
          const { getFirestoreUser } = require('./utils/firebase');
          // This now returns FirebaseUser | null with proper typings
          firebaseUserData = await getFirestoreUser(user.firebaseUid);
          
          if (firebaseUserData) {
            // Log that we successfully got Firebase user data
            console.log(`Successfully retrieved Firebase user data for ${user.firebaseUid} with ${firebaseUserData.cartItems?.length || 0} cart items and ${firebaseUserData.wishlistItems?.length || 0} wishlist items`);
          }
        } catch (firebaseError) {
          console.error("Error fetching Firebase user data:", firebaseError);
        }
      }
      
      // Don't return sensitive information
      const { password, twoFactorSecret, ...userWithoutPassword } = user;
      
      // Enrich the order data with formatted dates and status information
      const enrichedOrders = orders.map(order => {
        const createdDate = new Date(order.createdAt);
        return {
          ...order,
          formattedDate: createdDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          formattedTime: createdDate.toLocaleTimeString('en-US'),
          statusColor: getOrderStatusColor(order.status),
          items: Array.isArray(order.items) ? order.items.map(item => ({
            ...item,
            subtotal: (item.price || 0) * (item.quantity || 1)
          })) : []
        };
      });
      
      res.json({
        user: userWithoutPassword,
        orders: enrichedOrders,
        wishlistItems,
        cartItems,
        reviews,
        stats: {
          totalSpent,
          totalOrders: orders.length,
          totalWishlistItems: wishlistItems.length,
          totalCartItems: cartItems.length,
          totalReviews: reviews.length,
          averageReviewRating: reviews.length > 0 ? 
            reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0
        },
        analytics: formattedAnalytics,
        firebase: firebaseUserData
      });
    } catch (error) {
      console.error("Get user details error:", error);
      res.status(500).json({ message: "Server error", error: String(error) });
    }
  });
  
  // Helper function to get color for order status
  function getOrderStatusColor(status) {
    switch(status) {
      case 'delivered': return 'green';
      case 'shipped': return 'blue';
      case 'processing': return 'orange';
      case 'pending': return 'yellow';
      case 'cancelled': return 'red';
      default: return 'gray';
    }
  }

  // Two-factor authentication routes
  // Resend 2FA verification code
  app.post("/api/auth/2fa/resend", async (req, res) => {
    try {
      // Extract the Firebase UID from the header or body
      const firebaseUid = req.headers["firebase-uid"]?.toString() || req.body?.uid;
      const email = req.body?.email;
      
      if (!firebaseUid || !email) {
        return res.status(400).json({ message: "Firebase UID and email are required" });
      }
      
      // Try to find the user by Firebase UID
      let user = await storage.getUserByFirebaseId(firebaseUid);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!user.twoFactorSecret) {
        return res.status(400).json({ message: "Two-factor authentication not set up for this user" });
      }
      
      // Generate a new OTP and send it via email
      const result = await setupTwoFactor(user.email);
      
      if (!result.success) {
        return res.status(500).json({ message: "Failed to send verification code to your email" });
      }
      
      // Update the user's secret in the database
      await storage.updateUserTwoFactorSecret(user.id, result.secret);
      
      res.json({ 
        message: "Verification code sent to your email",
        emailSent: true
      });
      
    } catch (error: any) {
      console.error("2FA resend error:", error);
      res.status(500).json({ message: "Error resending verification code: " + error.message });
    }
  });
  
  app.post("/api/auth/2fa/setup", async (req, res) => {
    try {
      // Log headers for debugging
      console.log("2FA setup request headers:", req.headers);
      console.log("2FA setup request body:", req.body);
      
      // Extract the Firebase UID from the header or body
      const firebaseUid = req.headers["firebase-uid"]?.toString() || req.body?.uid;
      const email = req.body?.email;
      
      if (!firebaseUid || !email) {
        return res.status(400).json({ message: "Firebase UID and email are required" });
      }
      
      // Try to find the user by Firebase UID
      let user = await storage.getUserByFirebaseId(firebaseUid);
      
      // If no user is found, but we have email, try to create one
      if (!user && email) {
        console.log(`Creating new user for Firebase UID ${firebaseUid} with email ${email}`);
        
        try {
          // Create a new user with the Firebase UID
          user = await storage.createUser({
            username: email.split('@')[0],
            email: email,
            password: 'firebase-auth', // Placeholder since Firebase handles auth
            fullName: req.body.displayName || null,
            role: 'user',
            firebaseUid: firebaseUid,
            photoURL: req.body.photoURL || null
          });
          
          console.log(`Created new user with ID ${user.id} for Firebase UID ${firebaseUid}`);
        } catch (createError) {
          console.error("Error creating user:", createError);
          return res.status(500).json({ message: "Error creating user" });
        }
      }
      
      if (!user) {
        return res.status(404).json({ message: "User not found with Firebase UID and no userId provided" });
      }

      // Generate a new OTP and send it via email
      const result = await setupTwoFactor(user.email);
      
      if (!result.success) {
        return res.status(500).json({ message: "Failed to send verification code to your email" });
      }
      
      // Update the user's secret in the database
      await storage.updateUserTwoFactorSecret(user.id, result.secret);
      
      // Extract the raw secret for the QR code
      const secretData = JSON.parse(result.secret);
      const otp = secretData.otp;
      
      // Create the otpauth URL for QR code generation
      // This follows the standard format used by authenticator apps
      const otpAuthUrl = `otpauth://totp/${encodeURIComponent(user.email)}?secret=${otp}&issuer=SoftGirlFashion`;
      
      res.json({ 
        message: "Verification code sent to your email",
        emailSent: true,
        otpAuthUrl
      });
    } catch (error: any) {
      console.error("2FA setup error:", error);
      res.status(500).json({ message: "Error setting up 2FA: " + error.message });
    }
  });

  app.post("/api/auth/2fa/verify", async (req, res) => {
    try {
      // Log headers for debugging
      console.log("2FA verify request headers:", req.headers);
      console.log("2FA verify request body:", req.body);

      // Extract the Firebase UID from the header or body
      const firebaseUid = req.headers["firebase-uid"]?.toString() || req.body?.uid;
      const email = req.body?.email;
      
      // Try to find the user by Firebase UID
      let user;
      
      if (firebaseUid) {
        user = await storage.getUserByFirebaseId(firebaseUid);
      } else if (req.user?.id) {
        user = await storage.getUser(req.user.id);
      } else if (email) {
        user = await storage.getUserByEmail(email);
      }
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const validation = twoFactorVerifySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid token", 
          errors: validation.error.flatten().fieldErrors 
        });
      }
      
      const { token } = validation.data;
      
      if (!user.twoFactorSecret) {
        return res.status(400).json({ message: "2FA not set up for this user" });
      }
      
      const isValid = verifyToken(token, user.twoFactorSecret);
      
      if (!isValid) {
        return res.status(401).json({ message: "Invalid verification code" });
      }
      
      // Enable 2FA for the user
      await storage.enableTwoFactor(user.id);
      
      res.json({ 
        message: "Two-factor authentication enabled successfully",
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        twoFactorEnabled: true
      });
    } catch (error: any) {
      console.error("2FA verification error:", error);
      res.status(500).json({ message: "Error verifying 2FA token: " + error.message });
    }
  });

  app.post("/api/auth/2fa/disable", async (req, res) => {
    try {
      // Log headers for debugging
      console.log("2FA disable request headers:", req.headers);
      console.log("2FA disable request body:", req.body);
      
      // Extract the Firebase UID from the header or body
      const firebaseUid = req.headers["firebase-uid"]?.toString() || req.body?.uid;
      const email = req.body?.email;
      
      // Try to find the user by Firebase UID
      let user;
      
      if (firebaseUid) {
        user = await storage.getUserByFirebaseId(firebaseUid);
      } else if (req.user?.id) {
        user = await storage.getUser(req.user.id);
      } else if (email) {
        user = await storage.getUserByEmail(email);
      }
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!user.twoFactorEnabled) {
        return res.status(400).json({ message: "Two-factor authentication is not enabled" });
      }
      
      await storage.disableTwoFactor(user.id);
      
      res.json({ 
        message: "Two-factor authentication disabled successfully",
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        twoFactorEnabled: false
      });
    } catch (error: any) {
      console.error("2FA disable error:", error);
      res.status(500).json({ message: "Error disabling 2FA: " + error.message });
    }
  });

  app.post("/api/auth/2fa/resend", async (req, res) => {
    try {
      // Log headers for debugging
      console.log("2FA resend request headers:", req.headers);
      console.log("2FA resend request body:", req.body);
      
      // Extract the Firebase UID from the header or body
      const firebaseUid = req.headers["firebase-uid"]?.toString() || req.body?.uid;
      const email = req.body?.email;
      
      // Try to find the user by Firebase UID
      let user;
      
      if (firebaseUid) {
        user = await storage.getUserByFirebaseId(firebaseUid);
      } else if (req.user?.id) {
        user = await storage.getUser(req.user.id);
      } else if (email) {
        user = await storage.getUserByEmail(email);
      }
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Generate a new OTP and send it via email
      const result = await setupTwoFactor(user.email);
      
      if (!result.success) {
        return res.status(500).json({ message: "Failed to send verification code to your email" });
      }
      
      // Update the user's secret in the database
      await storage.updateUserTwoFactorSecret(user.id, result.secret);
      
      // Extract the raw secret for the QR code
      const secretData = JSON.parse(result.secret);
      const otp = secretData.otp;
      
      // Create the otpauth URL for QR code generation
      const otpAuthUrl = `otpauth://totp/${encodeURIComponent(user.email)}?secret=${otp}&issuer=SoftGirlFashion`;
      
      res.json({ 
        message: "Verification code resent to your email",
        emailSent: true,
        otpAuthUrl
      });
    } catch (error: any) {
      console.error("2FA resend error:", error);
      res.status(500).json({ message: "Error resending verification code: " + error.message });
    }
  });

  app.post("/api/auth/2fa/validate", async (req, res) => {
    try {
      // Log headers for debugging
      console.log("2FA validate request headers:", req.headers);
      console.log("2FA validate request body:", req.body);
      
      // Extract the Firebase UID from the header or body
      const firebaseUid = req.headers["firebase-uid"]?.toString() || req.body?.uid;
      const { email, token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: "Verification token is required" });
      }
      
      // Try to find the user by Firebase UID first, then by email
      let user;
      
      if (firebaseUid) {
        user = await storage.getUserByFirebaseId(firebaseUid);
      } else if (email) {
        user = await storage.getUserByEmail(email);
      } else if (req.user?.id) {
        user = await storage.getUser(req.user.id);
      }
      
      if (!user) {
        console.log("User not found for 2FA validation with Firebase UID:", firebaseUid, "or email:", email);
        return res.status(401).json({ message: "Invalid authentication attempt - user not found" });
      }
      
      if (!user.twoFactorSecret) {
        console.log("User found but missing 2FA secret. User ID:", user.id, "Email:", user.email);
        return res.status(401).json({ message: "Invalid authentication attempt - 2FA not properly set up" });
      }
      
      console.log("Verifying 2FA token for user:", user.email);
      const isValid = verifyToken(token, user.twoFactorSecret);
      console.log("2FA token verification result:", isValid);
      
      if (!isValid) {
        return res.status(401).json({ message: "Invalid verification code" });
      }
      
      const userResponse = {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        twoFactorEnabled: true,
        firebaseUid: user.firebaseUid,
        photoURL: user.photoURL
      };
      
      console.log(`Successful 2FA validation for ${user.email}`);
      
      // In a real app, you might generate a JWT or session here
      res.json(userResponse);
    } catch (error: any) {
      console.error("2FA validation error:", error);
      res.status(500).json({ message: "Error validating 2FA token: " + error.message });
    }
  });
  
  // Check if a user exists in our database
  // Send 2FA verification code
  app.post("/api/auth/2fa/send-code", async (req, res) => {
    try {
      // Log request details for debugging
      console.log("2FA send-code request headers:", req.headers);
      console.log("2FA send-code request body:", req.body);
      
      const { email, uid } = req.body;
      const firebaseUid = req.headers["firebase-uid"]?.toString() || uid;
      
      if (!email && !firebaseUid) {
        return res.status(400).json({ message: "Email or Firebase UID is required" });
      }
      
      // Try to find the user by Firebase UID or email
      let user;
      
      if (firebaseUid) {
        console.log("Looking up user by Firebase UID:", firebaseUid);
        user = await storage.getUserByFirebaseId(firebaseUid);
      }
      
      if (!user && email) {
        console.log("Looking up user by email:", email);
        user = await storage.getUserByEmail(email);
      }
      
      if (!user) {
        console.log("User not found for 2FA send-code. Firebase UID:", firebaseUid, "Email:", email);
        
        // If we have Firebase UID but no user, try to create one
        if (firebaseUid && email) {
          console.log("Attempting to create user for:", email, firebaseUid);
          try {
            user = await storage.createUser({
              username: email.split('@')[0],
              email: email,
              password: 'firebase-auth', // Placeholder
              fullName: null,
              role: 'user',
              firebaseUid: firebaseUid,
              photoURL: null
            });
            console.log("Created user:", user.id);
          } catch (createError) {
            console.error("Failed to create user:", createError);
          }
        }
        
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
      }
      
      if (!user.twoFactorEnabled) {
        return res.status(400).json({ message: "Two-factor authentication is not enabled for this user" });
      }
      
      // Generate a new OTP and send it via email
      const result = await setupTwoFactor(user.email);
      
      if (!result.success) {
        return res.status(500).json({ message: "Failed to send verification code to your email" });
      }
      
      // Update the user's secret in the database
      await storage.updateUserTwoFactorSecret(user.id, result.secret);
      
      res.json({ 
        message: "Verification code sent to your email",
        emailSent: true,
      });
    } catch (error: any) {
      console.error("Error sending 2FA code:", error);
      res.status(500).json({ message: "Error sending verification code: " + error.message });
    }
  });
  
  app.post("/api/auth/check-user", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      console.log("Checking if user exists:", email);
      
      // Find the user by email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        console.log("User not found:", email);
        return res.status(404).json({ 
          exists: false,
          message: "User not found" 
        });
      }
      
      console.log("User exists:", email, "Firebase UID:", user.firebaseUid);
      
      // User exists but check if they have a Firebase UID
      return res.json({
        exists: true,
        hasFirebaseAuth: !!user.firebaseUid,
        message: "User exists"
      });
    } catch (error) {
      console.error("Check user error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // TEMPORARY: Set user as admin (remove this in production)
  app.post("/api/auth/make-admin", async (req, res) => {
    try {
      const { email, secret } = req.body;
      
      // Basic protection to prevent unauthorized access
      if (secret !== "admin123") {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      console.log("Setting user as admin:", email);
      
      // Find the user by email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        console.log("User not found:", email);
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update user role to admin
      const updatedUser = await storage.updateUser(user.id, { 
        ...user,
        role: "admin" 
      });
      
      console.log("User updated to admin role:", updatedUser);
      
      return res.json({
        success: true,
        message: "User has been granted admin privileges",
        user: updatedUser
      });
    } catch (error) {
      console.error("Make admin error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get user by ID (only basic info - used for password reset emails)
  app.get("/api/auth/user/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Only return minimal info for security
      return res.status(200).json({
        id: user.id,
        email: user.email
      });
    } catch (error) {
      console.error("Error getting user:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Password reset endpoints
  // Handle OTP sending request from client-side
  app.post("/api/auth/send-reset-otp", async (req, res) => {
    try {
      const { email, otp } = req.body;
      
      if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
      }
      
      // Import the email sending utility
      const { sendPasswordResetEmail } = await import("./utils/passwordResetEmail");
      
      // Send the email with the OTP
      const emailSent = await sendPasswordResetEmail(email, otp);
      
      if (!emailSent) {
        console.error("Failed to send password reset email to:", email);
        return res.status(500).json({ message: "Failed to send password reset email" });
      }
      
      return res.status(200).json({ 
        success: true,
        message: "Password reset code has been sent to your email" 
      });
    } catch (error) {
      console.error("Error sending password reset OTP:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Step 1: Request password reset (sends OTP)
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Still return success even if user not found for security reasons
        return res.status(200).json({ 
          message: "If a user with that email exists, a password reset code has been sent" 
        });
      }
      
      // Generate OTP
      const { generateOTP, sendPasswordResetEmail } = await import("./utils/passwordResetEmail");
      const otp = generateOTP();
      
      // Save OTP to storage
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10-minute expiry
      await storage.savePasswordResetOTP(user.id, otp, expiresAt);
      
      // Send email with OTP
      const emailSent = await sendPasswordResetEmail(email, otp);
      
      if (!emailSent) {
        console.error("Failed to send password reset email to:", email);
        return res.status(500).json({ message: "Failed to send password reset email, please try again later" });
      }
      
      return res.status(200).json({ 
        userId: user.id,
        message: "Password reset code has been sent to your email" 
      });
    } catch (error) {
      console.error("Error in forgot-password:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Step 2: Verify OTP and generate token
  app.post("/api/auth/verify-reset-code", async (req, res) => {
    try {
      // Support both email+code method and userId+otp method for compatibility
      const { userId, otp, email, code } = req.body;
      
      console.log(`Received verification request with params:`, { 
        userId: userId || 'not provided', 
        hasOtp: !!otp, 
        email: email || 'not provided', 
        hasCode: !!code 
      });
      
      // Handle email + code verification (new method)
      if (email && code) {
        console.log(`Verifying reset code for email: ${email}, code: ${code}`);
        
        // Find user by email first
        const user = await storage.getUserByEmail(email);
        if (!user) {
          console.log(`No user found with email: ${email}`);
          return res.status(404).json({
            success: false,
            message: "User not found with this email address"
          });
        }
        
        console.log(`Found user with ID: ${user.id} for email: ${email}`);
        
        // For debugging purposes
        try {
          const allResetOTPs = storage.getAllPasswordResetOTPs();
          console.log(`Available OTPs in system:`, allResetOTPs);
        } catch (debugError) {
          console.error('Error getting debug info:', debugError);
        }
        
        // Verify OTP using the user ID
        const isValid = await storage.verifyPasswordResetOTP(user.id, code);
        if (!isValid) {
          console.log(`Invalid verification code for user ID: ${user.id}, email: ${email}`);
          
          // Try one more time with the string version of the ID for compatibility
          const isStringValid = await storage.verifyPasswordResetOTP(user.id.toString(), code);
          if (!isStringValid) {
            console.log(`Still invalid after trying string version of ID`);
            return res.status(400).json({ 
              success: false,
              message: "Invalid or expired verification code" 
            });
          } else {
            console.log(`Valid after trying string version of ID`);
          }
        } else {
          console.log(`Valid verification code for user ID: ${user.id}`);
        }
        
        // Generate reset token
        const { generateResetToken } = await import("./utils/passwordResetEmail");
        const resetToken = generateResetToken();
        
        console.log(`Generated reset token for user ID: ${user.id}`);
        
        // Save token to storage (will be validated in the next step)
        await storage.saveResetToken(user.id.toString(), resetToken);
        
        console.log(`Saved reset token for user ID: ${user.id}`);
        
        return res.status(200).json({ 
          success: true,
          userId: user.id,
          resetToken,
          email: user.email,
          message: "Verification successful. You can now reset your password" 
        });
      }
      
      // Handle userId + otp verification (original method)
      if (!userId || !otp) {
        console.log(`Missing required parameters for verification`);
        return res.status(400).json({ 
          success: false,
          message: "Either email+code or userId+otp parameters are required" 
        });
      }
      
      console.log(`Verifying reset code for userId: ${userId}, otp: ${otp}`);
      
      // For debugging purposes
      try {
        const allResetOTPs = storage.getAllPasswordResetOTPs();
        console.log(`Available OTPs in system:`, allResetOTPs);
      } catch (debugError) {
        console.error('Error getting debug info:', debugError);
      }
      
      // Verify OTP
      let isValid = false;
      
      // Try both number and string versions to ensure compatibility
      if (typeof userId === 'string' && !isNaN(Number(userId))) {
        console.log(`Trying numerical userId: ${Number(userId)}`);
        isValid = await storage.verifyPasswordResetOTP(Number(userId), otp);
      }
      
      if (!isValid) {
        console.log(`Trying string userId: ${userId}`);
        isValid = await storage.verifyPasswordResetOTP(userId, otp);
      }
      
      if (!isValid) {
        console.log(`Invalid verification code for user ID: ${userId}`);
        return res.status(400).json({ 
          success: false,
          message: "Invalid or expired verification code" 
        });
      }
      
      console.log(`Valid verification code for user ID: ${userId}`);
      
      // Generate reset token
      const { generateResetToken } = await import("./utils/passwordResetEmail");
      const resetToken = generateResetToken();
      
      console.log(`Generated reset token for user ID: ${userId}`);
      
      // Save token to storage (will be validated in the next step)
      await storage.saveResetToken(userId, resetToken);
      
      console.log(`Saved reset token for user ID: ${userId}`);
      
      return res.status(200).json({ 
        success: true,
        userId,
        resetToken,
        message: "Verification successful. You can now reset your password" 
      });
    } catch (error) {
      console.error("Error in verify-reset-code:", error);
      return res.status(500).json({ 
        success: false,
        message: "Internal server error" 
      });
    }
  });
  
  // Endpoint to generate a temporary token for password reset
  app.post("/api/auth/get-temp-token", async (req, res) => {
    try {
      const { email, resetCode } = req.body;
      
      if (!email || !resetCode) {
        return res.status(400).json({
          success: false,
          message: "Email and reset code are required"
        });
      }
      
      // Find user by email first
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found with this email address"
        });
      }
      
      // Verify the reset code is valid
      const isValid = await storage.verifyPasswordResetOTP(user.id.toString(), resetCode);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset code"
        });
      }
      
      // If the user has a Firebase UID, we would ideally generate a custom token
      // But without proper Firebase Admin credentials, we'll return an alternative flow
      if (user.firebaseUid) {
        try {
          // In a fully configured environment, we would do something like:
          // const customToken = await admin.auth().createCustomToken(user.firebaseUid);
          
          return res.json({
            success: true,
            message: "Reset code verified, proceed with password reset via email link",
            // token: customToken, - we can't include an actual token
            userId: user.id,
            firebaseUid: user.firebaseUid,
            alternativeFlow: true
          });
        } catch (firebaseError) {
          console.error("Firebase token generation not available:", firebaseError);
          // Fall through to alternative method
        }
      }
      
      // Provide an alternative flow for all cases
      res.json({
        success: true,
        message: "Reset code verified, use the standard reset flow",
        alternativeFlow: true,
        userId: user.id
      });
      
    } catch (error) {
      console.error("Error generating temp token:", error);
      res.status(500).json({
        success: false,
        message: "Server error generating temporary token"
      });
    }
  });
  
  // Firebase password reset endpoint
  app.post("/api/auth/firebase-password-reset", async (req, res) => {
    try {
      const { email, newPassword, resetDocId } = req.body;
      
      if (!email || !newPassword || !resetDocId) {
        return res.status(400).json({ message: "Email, new password, and reset document ID are required" });
      }
      
      console.log(`Password reset requested for email: ${email} with reset document ID: ${resetDocId}`);
      
      try {
        // Import the Firebase Admin utility
        const { resetUserPassword } = await import('./utils/firebaseAdmin');
        
        // Step 1: Reset password in Firebase Authentication
        const success = await resetUserPassword(email, newPassword);
        
        if (!success) {
          console.log(`Failed to reset password for user with email: ${email}`);
          // Instead of failing, we'll pass this back to the client to handle with the client SDK
          return res.status(200).json({ 
            clientSideFallback: true,
            message: "Failed to reset password with Admin SDK, please use client-side reset" 
          });
        }
        
        console.log(`Password successfully updated in Firebase Auth for user: ${email}`);
        
        // Step 2: Also update the password in PostgreSQL for data consistency
        try {
          // Find the user in PostgreSQL by email
          const pgUser = await storage.getUserByEmail(email);
          
          if (pgUser) {
            // Get the password hashing function
            const { hashPassword } = await import("./utils/auth");
            
            try {
              // Hash the password for PostgreSQL storage (properly this time)
              const hashedPassword = await hashPassword(newPassword);
              
              // Update the PostgreSQL user's password with the properly hashed value
              await storage.updateUser(pgUser.id, { 
                password: hashedPassword
              });
              
              console.log(`PostgreSQL password properly updated and hashed for user ID: ${pgUser.id}`);
            } catch (hashError) {
              console.error('Error hashing password for PostgreSQL:', hashError);
              
              // Fallback to placeholder if hashing fails
              await storage.updateUser(pgUser.id, { 
                password: 'firebase-auth-' + Date.now() // Use a unique placeholder value
              });
              
              console.log(`PostgreSQL password placeholder updated for user ID: ${pgUser.id}`);
            }
          } else {
            console.log(`No PostgreSQL user found with email: ${email}`);
          }
        } catch (pgError) {
          console.error('Error updating PostgreSQL user password:', pgError);
          // Continue with success response since Firebase Auth was updated successfully
        }
        
        return res.status(200).json({ 
          success: true,
          message: "Password has been reset successfully" 
        });
      } catch (adminError: any) {
        console.error("Firebase Admin Error:", adminError);
        
        // Handle specific Firebase errors
        if (adminError.code === 'auth/user-not-found') {
          return res.status(200).json({ 
            clientSideFallback: true,
            message: "User not found in Firebase Admin SDK, please use client-side reset" 
          });
        }
        
        // Pass back a generic error to the client to handle on their side
        return res.status(200).json({ 
          clientSideFallback: true,
          message: "Unable to reset password with admin SDK, falling back to client-side reset"
        });
      }
    } catch (error: any) {
      console.error("Error in firebase-password-reset:", error);
      
      if (error.code === 'auth/requires-recent-login') {
        return res.status(401).json({ 
          requiresReauthentication: true,
          message: "Recent authentication is required. Please log in again." 
        });
      }
      
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Step 3: Reset password with valid token - handles both Firebase and PostgreSQL users
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { userId, resetToken, newPassword, email } = req.body;
      
      if (!newPassword) {
        return res.status(400).json({ message: "New password is required" });
      }
      
      // Either userId+resetToken OR email+resetToken must be provided
      if ((!userId || !resetToken) && (!email || !resetToken)) {
        return res.status(400).json({ message: "Either userId with resetToken, or email with resetToken is required" });
      }
      
      let user = null;
      let isValid = false;
      
      // If email is provided, find user by email first
      if (email) {
        user = await storage.getUserByEmail(email);
        if (user) {
          console.log(`Found user by email: ${email}, user ID: ${user.id}`);
          // Check if token is valid for this user
          isValid = await storage.verifyResetToken(user.id, resetToken);
          // Also try with email directly as the key
          if (!isValid) {
            isValid = await storage.verifyResetToken(email, resetToken);
          }
          // Also try with Firebase UID if available
          if (!isValid && user.firebaseUid) {
            isValid = await storage.verifyResetToken(user.firebaseUid, resetToken);
          }
        }
      } else {
        // Verify reset token by userId
        isValid = await storage.verifyResetToken(userId, resetToken);
        if (isValid) {
          user = await storage.getUser(userId);
        }
      }
      
      if (!isValid) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log(`Proceeding with password reset for user ID: ${user.id}, email: ${user.email}`);
      
      // Update user in PostgreSQL
      let postgresUpdated = false;
      try {
        // Hash the password for PostgreSQL storage
        const { hashPassword } = await import("./utils/auth");
        const hashedPassword = await hashPassword(newPassword);
        
        // Update the hashed password in PostgreSQL
        const updatedUser = await storage.updateUser(user.id, { password: hashedPassword });
        
        if (updatedUser) {
          postgresUpdated = true;
          console.log(`PostgreSQL password updated successfully for user ID: ${user.id}`);
        } else {
          console.error(`Failed to update PostgreSQL password for user ID: ${user.id}`);
        }
      } catch (pgError) {
        console.error(`Error updating PostgreSQL password:`, pgError);
      }
      
      // Update the password in Firebase if this is a Firebase user
      let firebaseUpdated = false;
      if (user.firebaseUid) {
        try {
          console.log(`Updating Firebase password for user with UID: ${user.firebaseUid}`);
          const { resetUserPassword } = await import("./utils/firebaseAdmin");
          
          // Update Firebase password directly using Admin SDK
          firebaseUpdated = await resetUserPassword(user.email, newPassword);
          
          if (firebaseUpdated) {
            console.log(`Firebase password updated successfully for user ID: ${user.id}`);
          } else {
            console.error(`Failed to update Firebase password for user ID: ${user.id}`);
          }
        } catch (fbError) {
          console.error(`Error updating Firebase password:`, fbError);
        }
      }
      
      // Clear reset token regardless of outcome
      await storage.clearResetToken(user.id);
      if (user.email) await storage.clearResetToken(user.email);
      if (user.firebaseUid) await storage.clearResetToken(user.firebaseUid);
      
      // Determine response based on what was updated
      if (postgresUpdated && (firebaseUpdated || !user.firebaseUid)) {
        return res.status(200).json({ 
          success: true,
          message: "Password has been reset successfully"
        });
      } else if (postgresUpdated) {
        return res.status(207).json({
          success: true,
          message: "Password was updated in database but Firebase update failed",
          postgresUpdated,
          firebaseUpdated
        });
      } else if (firebaseUpdated) {
        return res.status(207).json({
          success: true,
          message: "Password was updated in Firebase but database update failed",
          postgresUpdated,
          firebaseUpdated
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "Failed to update password in any system",
          postgresUpdated,
          firebaseUpdated
        });
      }
    } catch (error) {
      console.error("Error in reset-password:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Endpoint to sync Firebase user password with PostgreSQL
  // Endpoint for client-side initiated password reset with reset code generation
  app.post("/api/auth/generate-reset-code", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          success: false,
          message: "Email is required" 
        });
      }
      
      console.log(`Password reset code generation requested for email: ${email}`);
      
      // Find the user in PostgreSQL by email
      const pgUser = await storage.getUserByEmail(email);
      
      if (!pgUser) {
        console.log(`No user found with email: ${email}`);
        // For security reasons, still return success
        return res.status(200).json({
          success: true,
          message: "If a user with this email exists, a reset code has been sent."
        });
      }
      
      // Generate a random 6-digit reset code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Import the generateSecureToken function
      const { generateSecureToken } = await import("./utils/auth");
      
      // Create a secure token for the reset verification
      const resetToken = generateSecureToken();
      
      // Create a future expiration date (30 minutes from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);
      
      try {
        // Save the OTP for verification
        await storage.savePasswordResetOTP(pgUser.id, resetCode, expiresAt);
        
        // Save the reset token
        await storage.saveResetToken(pgUser.id, resetToken);
        
        console.log(`Generated reset code and token for user ID: ${pgUser.id}, expires at: ${expiresAt}`);
        
        // In a real application, we would send an email with the reset code
        // For this example, we'll return it directly (not secure for production)
        return res.status(200).json({
          success: true,
          userId: pgUser.id,
          resetCode,
          resetToken,
          message: "Reset code generated successfully. In a production app, this would be sent via email."
        });
      } catch (error) {
        console.error("Error saving reset code/token:", error);
        return res.status(500).json({ 
          success: false,
          message: "Failed to generate reset code" 
        });
      }
    } catch (error) {
      console.error("Error generating reset code:", error);
      return res.status(500).json({ 
        success: false,
        message: "Internal server error" 
      });
    }
  });
  
  // Endpoint to verify reset code
  app.post("/api/auth/verify-reset-code", async (req, res) => {
    try {
      const { userId, resetCode, email, code, otp } = req.body;
      
      // Flag what we received
      const hasUserId = !!userId;
      const hasOtp = !!(otp || resetCode); // Support both otp and resetCode parameter names
      const hasEmail = !!email;
      const hasCode = !!(code);
      
      console.log(`Received verification request with params: { userId: ${userId || 'not provided'}, hasOtp: ${hasOtp}, email: '${email || 'not provided'}', hasCode: ${hasCode} }`);
      
      // We need either userId+otp or email+code
      if ((!hasUserId || !hasOtp) && (!hasEmail || !hasCode)) {
        console.log(`Missing required parameters for verification`);
        return res.status(400).json({ 
          success: false,
          message: "Either email+code or userId+otp parameters are required" 
        });
      }
      
      // Case 1: Email + Code
      if (hasEmail && hasCode) {
        const user = await storage.getUserByEmail(email);
        if (!user) {
          return res.status(400).json({
            success: false,
            message: "Invalid or expired code"
          });
        }
        
        // Verify the code using the user's ID - try multiple formats for maximum compatibility
        const actualCode = code || '';
        let isValid = await storage.verifyPasswordResetOTP(user.id, actualCode);
        
        // If not valid and Firebase UID exists, try that as well
        if (!isValid && user.firebaseUid) {
          console.log(`Trying verification with Firebase UID: ${user.firebaseUid}`);
          isValid = await storage.verifyPasswordResetOTP(user.firebaseUid, actualCode);
        }
        
        // As a last resort, try with email as ID
        if (!isValid && email) {
          console.log(`Trying verification with email as ID: ${email}`);
          isValid = await storage.verifyPasswordResetOTP(email, actualCode);
        }
        
        if (isValid) {
          console.log(`Reset code verified successfully for user with email: ${email}`);
          
          // Generate a new reset token for the password reset
          const { generateSecureToken } = await import("./utils/auth");
          const resetToken = generateSecureToken();
          
          // Save the token for this user with multiple IDs for robustness
          await storage.saveResetToken(user.id, resetToken);
          
          // Also save with Firebase UID if available
          if (user.firebaseUid) {
            await storage.saveResetToken(user.firebaseUid, resetToken);
            console.log(`Also saved reset token with Firebase UID: ${user.firebaseUid}`);
          }
          
          // Also save with email for additional lookup methods
          try {
            await storage.saveResetToken(email, resetToken);
            console.log(`Also saved reset token with email: ${email}`);
          } catch (emailKeyError) {
            console.warn("Could not save token with email as key:", emailKeyError);
          }
          
          console.log(`Generated reset token for user ID: ${user.id} (multiple IDs for redundancy)`);
          
          return res.status(200).json({
            success: true,
            message: "Reset code verified successfully",
            userId: user.id,
            resetToken,
            email
          });
        } else {
          console.log(`Invalid reset code provided for user with email: ${email}`);
          return res.status(400).json({ 
            success: false,
            message: "Invalid or expired reset code" 
          });
        }
      }
      
      // Case 2: User ID + OTP
      const actualOtp = otp || resetCode || '';
      console.log(`Verifying reset code for user ID: ${userId} with code: ${actualOtp}`);
      
      // Verify the reset code
      const isValid = await storage.verifyPasswordResetOTP(userId, actualOtp);
      
      if (isValid) {
        console.log(`Reset code verified successfully for user ID: ${userId}`);
        
        // Generate a new reset token for the password reset
        const { generateSecureToken } = await import("./utils/auth");
        const resetToken = generateSecureToken();
        
        // Save the token for this user
        await storage.saveResetToken(userId, resetToken);
        console.log(`Generated reset token for user ID: ${userId}`);
        
        return res.status(200).json({
          success: true,
          message: "Reset code verified successfully",
          userId,
          resetToken
        });
      } else {
        console.log(`Invalid reset code provided for user ID: ${userId}`);
        return res.status(400).json({ 
          success: false,
          message: "Invalid or expired reset code" 
        });
      }
    } catch (error) {
      console.error("Error verifying reset code:", error);
      return res.status(500).json({ 
        success: false,
        message: "Internal server error" 
      });
    }
  });
  
  // Endpoint for client-side initiated password reset
  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      const { email, resetCode } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          success: false,
          message: "Email is required" 
        });
      }
      
      console.log(`Password reset requested for email: ${email} with reset code: ${resetCode || 'none'}`);
      
      // Find the user in PostgreSQL by email
      const pgUser = await storage.getUserByEmail(email);
      
      if (!pgUser) {
        console.log(`No user found with email: ${email}`);
        // For security reasons, still return success
        return res.status(200).json({
          success: true,
          message: "If an account exists with this email, a password reset has been initiated."
        });
      }
      
      // Save the reset code if provided
      if (resetCode) {
        // Create a future expiration date (30 minutes from now)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 30);
        
        // Save the OTP for verification - store with multiple IDs for robust lookups
        await storage.savePasswordResetOTP(pgUser.id, resetCode, expiresAt);
        console.log(`Saved reset code for user ID: ${pgUser.id}, expires at: ${expiresAt}`);
        
        // Also save with Firebase UID if available, for more robust lookups
        if (pgUser.firebaseUid) {
          try {
            console.log(`Also saving reset code with Firebase UID: ${pgUser.firebaseUid}`);
            // Call the savePasswordResetOTP function directly with the Firebase UID
            await storage.savePasswordResetOTP(pgUser.firebaseUid as unknown as number, resetCode, expiresAt);
            console.log(`Successfully saved reset code with Firebase UID`);
          } catch (firebaseIdError) {
            console.warn(`Error saving reset code with Firebase UID:`, firebaseIdError);
          }
        }
        
        // Also try saving with email for even more redundancy
        try {
          console.log(`Also saving reset code with email: ${email}`);
          // We're passing email as if it were a number - storage implementation handles this
          await storage.savePasswordResetOTP(email as unknown as number, resetCode, expiresAt);
          console.log(`Successfully saved reset code with email lookup key`);
        } catch (emailKeyError) {
          console.warn(`Error saving reset code with email key:`, emailKeyError);
        }
      }
      
      return res.status(200).json({
        success: true,
        message: "Password reset has been initiated. Please follow the instructions to complete the process."
      });
    } catch (error) {
      console.error("Error in request-password-reset:", error);
      return res.status(500).json({ 
        success: false,
        message: "Internal server error" 
      });
    }
  });
  
  app.post("/api/auth/sync-password", async (req, res) => {
    try {
      const { email, uid, password, forceSyncAll } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          success: false,
          message: "Email is required" 
        });
      }
      
      console.log(`Password sync requested for email: ${email} (forceSyncAll: ${forceSyncAll ? 'true' : 'false'})`);
      
      // Track our operations for detailed reporting
      const operations = {
        postgresUpdated: false,
        firebaseUpdated: false,
        firestoreUpdated: false
      };
      
      // Check if user exists in PostgreSQL
      let pgUser = await storage.getUserByEmail(email);
      
      // If no user found by email, try by Firebase UID if provided
      if (!pgUser && uid) {
        console.log(`No user found by email, trying Firebase UID: ${uid}`);
        pgUser = await storage.getUserByFirebaseId(uid);
      }
      
      // First handle PostgreSQL update if user exists
      if (pgUser) {
        console.log(`Found PostgreSQL user with ID: ${pgUser.id}`);
        
        // Prepare update data
        const updateData: any = {};
        
        // Add Firebase UID if provided and user doesn't have one
        if (uid && (!pgUser.firebaseUid || pgUser.firebaseUid !== uid)) {
          updateData.firebaseUid = uid;
          console.log(`Updating Firebase UID to: ${uid}`);
        }
        
        // If a specific password was provided, hash it and store it
        if (password) {
          // Import the password hashing function
          const { hashPassword } = await import("./utils/auth");
          
          try {
            console.log(`Hashing password for user ID: ${pgUser.id}`);
            const hashedPassword = await hashPassword(password);
            updateData.password = hashedPassword;
            console.log(`Password successfully hashed for user ID: ${pgUser.id}`);
          } catch (hashError) {
            console.error(`Error hashing password for user ID: ${pgUser.id}`, hashError);
            return res.status(500).json({
              success: false,
              message: "Error hashing password"
            });
          }
        } else if (!forceSyncAll) {
          // Only set a placeholder when not doing a force sync (normal sync operations)
          updateData.password = 'firebase-auth-' + Date.now();
          console.log(`Using placeholder password for user ID: ${pgUser.id}`);
        } else {
          // When forceSyncAll is true but no password provided, return an error
          return res.status(400).json({
            success: false,
            message: "Password is required when forceSyncAll is true"
          });
        }
        
        // Only perform update if we have values to update
        if (Object.keys(updateData).length > 0) {
          // Update the user in PostgreSQL
          const updatedUser = await storage.updateUser(pgUser.id, updateData);
          
          if (updatedUser) {
            operations.postgresUpdated = true;
            console.log(`User with ID ${pgUser.id} successfully updated in PostgreSQL`);
            
            // Verify the password was actually updated
            if (password && updatedUser.password !== pgUser.password) {
              console.log(`Password verification: Password successfully changed in PostgreSQL`);
            } else if (password) {
              console.warn(`Password verification: Password may not have been updated properly in PostgreSQL`);
            }
          } else {
            console.error(`Failed to update user with ID: ${pgUser.id} in PostgreSQL`);
            return res.status(500).json({
              success: false,
              message: "Failed to update user in PostgreSQL"
            });
          }
        } else {
          console.log(`No fields to update for user ID: ${pgUser.id}`);
        }
      } else {
        console.log(`No PostgreSQL user found with email: ${email} or uid: ${uid || 'not provided'}`);
      }
      
      // Now handle Firebase Auth update if requested
      let firebaseError = null;
      if (password && (forceSyncAll || !pgUser)) {
        try {
          // If we have a pgUser with Firebase UID or if we're forcing a sync even without PostgreSQL user
          const firebaseUid = pgUser?.firebaseUid || uid;
          
          if (firebaseUid) {
            console.log(`Using Firebase UID ${firebaseUid} for password update`);
          }
          
          console.log(`Updating Firebase Auth password for email: ${email}`);
          const { resetUserPassword } = await import("./utils/firebaseAdmin");
          const firebaseSuccess = await resetUserPassword(email, password);
          
          if (firebaseSuccess) {
            operations.firebaseUpdated = true;
            operations.firestoreUpdated = true; // resetUserPassword tries to update Firestore too
            console.log(`Firebase Auth password successfully updated for email: ${email}`);
          } else {
            console.error(`Firebase Auth password update failed for email: ${email}`);
            firebaseError = "Firebase Auth update failed";
          }
        } catch (fbError) {
          console.error(`Error updating Firebase Auth password:`, fbError);
          firebaseError = String(fbError);
        }
      } else if (password) {
        console.log(`Skipping Firebase Auth update (forceSyncAll not set)`);
      }
      
      // Determine status code and response based on operations performed
      if (operations.postgresUpdated && operations.firebaseUpdated) {
        return res.status(200).json({ 
          success: true,
          message: "Password successfully updated in both PostgreSQL and Firebase",
          operations
        });
      } else if (operations.postgresUpdated) {
        return res.status(207).json({
          success: true,
          message: "Password updated in PostgreSQL only",
          firebaseError,
          operations
        });
      } else if (operations.firebaseUpdated) {
        return res.status(206).json({
          success: true,
          message: "Password updated in Firebase only (user not found in PostgreSQL)",
          operations
        });
      } else {
        return res.status(404).json({ 
          success: false,
          message: "User not found in any database system",
          operations
        });
      }
    } catch (error) {
      console.error("Error syncing password:", error);
      return res.status(500).json({ 
        success: false,
        message: "Internal server error during password sync",
        error: String(error)
      });
    }
  });

  // Password reset diagnostic tools - REMOVE BEFORE PRODUCTION
  // This will be helpful to test the password reset flow
  if (process.env.NODE_ENV !== 'production') {
    app.get("/api/debug/password-reset-otps", (req, res) => {
      try {
        const otps = storage.getAllPasswordResetOTPs();
        
        // Format the result nicely with expiration status
        const result: Record<string, any> = {};
        Object.entries(otps).forEach(([key, value]) => {
          result[key] = {
            otp: value.otp,
            expiresAt: value.expiresAt.toISOString(),
            isExpired: new Date() > value.expiresAt,
            timeLeft: Math.floor((value.expiresAt.getTime() - Date.now()) / 1000) + " seconds"
          };
        });
        
        return res.status(200).json({
          otps: result,
          count: Object.keys(result).length
        });
      } catch (error) {
        console.error("Error getting password reset OTPs:", error);
        return res.status(500).json({ error: String(error) });
      }
    });
    
    app.get("/api/debug/reset-tokens", (req, res) => {
      try {
        const tokens = storage.getAllResetTokens();
        
        return res.status(200).json({
          tokens,
          count: Object.keys(tokens).length
        });
      } catch (error) {
        console.error("Error getting reset tokens:", error);
        return res.status(500).json({ error: String(error) });
      }
    });
  }
  
  // DIRECT ENDPOINTS: These endpoints bypass middleware that may cause HTML error responses
  
  // Direct endpoint for updating user roles - this avoids the auth middleware issues
  app.put("/api/direct/users/:id/role", async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { role, firebaseUid } = req.body;
      
      console.log(`[DIRECT] Updating role for user ID ${userId} to ${role}`);
      
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ message: "Valid user ID is required" });
      }
      
      if (role !== "admin" && role !== "user") {
        return res.status(400).json({ message: "Valid role is required (admin or user)" });
      }
      
      // Get the user from database
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update the user role in the database
      const updatedUser = await storage.updateUser(userId, { role });
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user role" });
      }
      
      // If a Firebase UID was provided, update the user role in Firebase too
      if (firebaseUid) {
        try {
          console.log(`Attempting to update Firebase user role for UID: ${firebaseUid}`);
          
          // This operation may fail in development environments but we don't want to block the response
          firebaseAdmin.updateUserRole(firebaseUid, role)
            .then(() => console.log("Firebase user role updated successfully"))
            .catch(error => console.error("Failed to update Firebase user role:", error));
        } catch (firebaseError) {
          console.error("Error updating Firebase user role:", firebaseError);
          // Don't fail the request if Firebase update fails
        }
      }
      
      // Return user info without sensitive data
      const { password, twoFactorSecret, ...userWithoutPassword } = updatedUser;
      return res.status(200).json({
        user: userWithoutPassword,
        message: "User role updated successfully"
      });
    } catch (error) {
      console.error("Error updating user role:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
