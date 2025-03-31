import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loginSchema, userSchema, twoFactorVerifySchema, insertProductSchema, insertCategorySchema, insertReviewSchema, insertOrderSchema, insertHeroBannerSchema, insertTestimonialSchema } from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";
import { verifyRecaptcha } from "./utils/recaptcha";
import { setupTwoFactor, verifyToken } from "./utils/twoFactor";
import * as firebaseAdmin from "./utils/firebase";

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
  
  const user = await storage.getUser(req.user.id);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  
  next();
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
      const { email, password, recaptchaToken } = validation.data;
      
      if (!recaptchaToken) {
        return res.status(400).json({ message: "reCAPTCHA verification is required" });
      }
      
      // Verify reCAPTCHA token
      const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
      if (!isRecaptchaValid) {
        return res.status(400).json({ message: "reCAPTCHA verification failed" });
      }
      
      const user = await storage.getUserByEmail(email);
      
      if (!user || user.password !== password) {
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
        twoFactorEnabled: false
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
      
      const existingUser = await storage.getUserByEmail(validation.data.email);
      if (existingUser) {
        return res.status(409).json({ message: "Email already in use" });
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
      
      // First check if user exists by Firebase UID
      let user = await storage.getUserByFirebaseId(uid);
      
      // If no user found by Firebase UID, check by email
      if (!user) {
        user = await storage.getUserByEmail(email);
      }
      
      if (!user) {
        // Create a new user if they don't exist
        const username = displayName?.split(' ')[0]?.toLowerCase() || email.split('@')[0];
        user = await storage.createUser({
          username: username,
          email: email,
          password: `google_${uid}`,  // Use a placeholder password as it won't be used
          fullName: displayName,
          role: "user",
          firebaseUid: uid,
          photoURL: photoURL
        });
        
        console.log(`Created new user from Google login: ${username} (${email})`);
      } else if (!user.firebaseUid) {
        // If user exists but doesn't have Firebase UID, update it
        user = await storage.updateUser(user.id, { 
          firebaseUid: uid,
          photoURL: photoURL
        });
        
        if (user) {
          console.log(`Updated existing user with Firebase UID: ${user.username} (${email})`);
        }
      }
      
      // Don't send the password in the response
      if (user) {
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      } else {
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
        // Import Firebase function
        const { getCategoryById } = await import("../client/src/lib/firebaseService");
        console.log(`Attempting to fetch category ${id} from Firebase`);
        
        // Try to get category from Firebase
        const firebaseCategory = await getCategoryById(id);
        
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
        // Import Firebase function
        const { updateCategory } = await import("../client/src/lib/firebaseService");
        console.log(`Attempting to update category ${id} in Firebase`);
        
        // Prepare the category data with proper type handling
        const categoryData: Partial<any> = {};
        
        // Only include fields that were provided in the request
        if ('name' in validation.data) categoryData.name = validation.data.name;
        if ('description' in validation.data) categoryData.description = validation.data.description || "";
        if ('image' in validation.data) categoryData.image = validation.data.image;
        if ('featured' in validation.data) categoryData.featured = !!validation.data.featured;
        
        // Try to update the category in Firebase
        const firebaseCategory = await updateCategory(id, categoryData);
        
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
        // Import Firebase function
        const { deleteCategory } = await import("../client/src/lib/firebaseService");
        console.log(`Attempting to delete category ${id} from Firebase`);
        
        // Try to delete from Firebase
        const success = await deleteCategory(id);
        
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
          const firebaseService = await import("../client/src/lib/firebaseService");
          console.log("Imported Firebase service for products");
          
          // Fetch base products based on primary filter from Firebase
          if (category) {
            const categoryId = Number(category);
            if (isNaN(categoryId)) {
              return res.status(400).json({ message: "Invalid category ID" });
            }
            console.log(`Fetching products for category ${categoryId} from Firebase`);
            products = await firebaseService.getProductsByCategory(categoryId);
          } else if (featured === 'true') {
            console.log("Fetching featured products from Firebase");
            products = await firebaseService.getFeaturedProducts();
          } else if (trending === 'true') {
            console.log("Fetching trending products from Firebase");
            products = await firebaseService.getTrendingProducts();
          } else {
            console.log("Fetching all products from Firebase");
            products = await firebaseService.getAllProducts();
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
        // Import Firebase function
        const { getProductById } = await import("../client/src/lib/firebaseService");
        console.log(`Attempting to fetch product ${id} from Firebase`);
        
        // Try to get product from Firebase
        const firebaseProduct = await getProductById(id);
        
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
        // Import Firebase function
        const { createProduct } = await import("../client/src/lib/firebaseService");
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
          colors: Array.isArray(validation.data.colors) ? validation.data.colors : [],
          stock: validation.data.stock || 0,
          featured: !!validation.data.featured,
          trending: !!validation.data.trending
        };
        
        // Try to create the product in Firebase
        const firebaseProduct = await createProduct(productData);
        
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
        // Import Firebase function
        const { updateProduct } = await import("../client/src/lib/firebaseService");
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
        if ('colors' in validation.data) productData.colors = Array.isArray(validation.data.colors) ? validation.data.colors : [];
        if ('stock' in validation.data) productData.stock = validation.data.stock || 0;
        if ('featured' in validation.data) productData.featured = !!validation.data.featured;
        if ('trending' in validation.data) productData.trending = !!validation.data.trending;
        
        // Try to update the product in Firebase
        const firebaseProduct = await updateProduct(id, productData);
        
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
        // Import Firebase function
        const { deleteProduct } = await import("../client/src/lib/firebaseService");
        console.log(`Attempting to delete product ${id} from Firebase`);
        
        // Try to delete from Firebase
        const success = await deleteProduct(id);
        
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

  app.get("/api/admin/orders", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error("Get all orders error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      console.log("Creating order with data:", req.body);
      
      // Get userId if authenticated, otherwise create as guest order
      let userId = req.user?.id;
      
      // If user isn't authenticated, check if user ID was passed in the body (for guest checkout)
      if (!userId && req.body.userId) {
        userId = req.body.userId;
      }
      
      const orderData = {
        ...req.body,
        // Set userId to null for guest orders if not authenticated
        userId: userId || null
      };
      
      console.log("Processed order data:", orderData);
      
      const validation = insertOrderSchema.safeParse(orderData);
      
      if (!validation.success) {
        console.error("Order validation failed:", validation.error.flatten().fieldErrors);
        return res.status(400).json({ 
          message: "Invalid order data", 
          errors: validation.error.flatten().fieldErrors 
        });
      }
      
      console.log("Order validation successful, creating order");
      const order = await storage.createOrder(validation.data);
      console.log("Order created successfully:", order.id);
      
      res.status(201).json(order);
    } catch (error) {
      console.error("Create order error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/admin/orders/:id/status", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }
      
      const { status } = req.body;
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ message: "Status is required" });
      }
      
      const order = await storage.updateOrderStatus(id, status);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json(order);
    } catch (error) {
      console.error("Update order status error:", error);
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
      const { amount } = req.body;
      if (!amount || typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }
      
      // Log the request to help with debugging
      console.log(`Creating payment intent for amount: $${amount}`);
      
      if (!process.env.STRIPE_SECRET_KEY) {
        console.error("⚠️ STRIPE_SECRET_KEY is not set. Payment intent creation will fail.");
        return res.status(500).json({ message: "Stripe API key is not configured" });
      }
      
      try {
        // Create a payment intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: "usd",
          payment_method_types: ['card'],
          metadata: {
            integration_check: 'accept_a_payment',
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
      
      // Recent orders
      const recentOrders = orders
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
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
      
      res.json({
        totalRevenue,
        totalOrders,
        totalUsers,
        totalProducts,
        recentOrders,
        topProducts: resolvedTopProducts,
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
  app.put("/api/admin/users/:id/role", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { role } = req.body;
      
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
      
      // Update role in Firebase if we have a Firebase UID
      if (user.firebaseUid) {
        try {
          // We need to use a Firebase Admin SDK, for now we'll add a placeholder for future implementation
          console.log(`Firebase role update would happen here for user ${user.firebaseUid}`);
          
          // The actual implementation would import admin SDK and update custom claims
          // const admin = require('firebase-admin');
          // await admin.auth().setCustomUserClaims(user.firebaseUid, { role });
        } catch (firebaseError) {
          console.error("Firebase role update error:", firebaseError);
          // Continue anyway as we've already updated the database
        }
      }
      
      const { password, twoFactorSecret, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update user role error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Get user details including orders, cart, wishlist
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
      
      // Get user's orders
      const orders = await storage.getUserOrders(userId);
      
      // Calculate total spent
      const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
      
      // Get wishlist items (if implemented)
      let wishlistItems = [];
      if (user.wishlistItems && Array.isArray(user.wishlistItems)) {
        wishlistItems = user.wishlistItems;
      }
      
      // Don't return sensitive information
      const { password, twoFactorSecret, ...userWithoutPassword } = user;
      
      res.json({
        user: userWithoutPassword,
        orders,
        wishlistItems,
        stats: {
          totalSpent,
          totalOrders: orders.length,
          totalWishlistItems: wishlistItems.length
        }
      });
    } catch (error) {
      console.error("Get user details error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

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

  const httpServer = createServer(app);
  return httpServer;
}
