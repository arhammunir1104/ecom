import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loginSchema, userSchema, insertProductSchema, insertCategorySchema, insertReviewSchema, insertOrderSchema, insertHeroBannerSchema, insertTestimonialSchema } from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2023-10-16",
});

// Middleware for checking if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  // In a real application, this would check the session or token
  // For now, we'll use a simple user ID in the request headers
  const userId = req.headers["user-id"];
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  req.user = { id: Number(userId) };
  next();
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
      
      const { email, password } = validation.data;
      const user = await storage.getUserByEmail(email);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // In a real app, we'd generate a JWT or session here
      return res.json({ 
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role
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
      
      const existingUser = await storage.getUserByEmail(validation.data.email);
      if (existingUser) {
        return res.status(409).json({ message: "Email already in use" });
      }
      
      const user = await storage.createUser({
        ...validation.data,
        role: "user" // Ensure new registrations are always users, not admins
      });
      
      res.status(201).json({ 
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Category routes
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/categories/featured", async (req, res) => {
    try {
      const categories = await storage.getFeaturedCategories();
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
      
      const category = await storage.getCategory(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      res.json(category);
    } catch (error) {
      console.error("Get category error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/categories", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validation = insertCategorySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      const category = await storage.createCategory(validation.data);
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
      
      const validation = insertCategorySchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      const category = await storage.updateCategory(id, validation.data);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
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
      
      const success = await storage.deleteCategory(id);
      if (!success) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error("Delete category error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Product routes
  app.get("/api/products", async (req, res) => {
    try {
      let products;
      const { category, search, featured, trending } = req.query;
      
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
      
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Get product error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/products", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validation = insertProductSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      const product = await storage.createProduct(validation.data);
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
      
      const validation = insertProductSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      const product = await storage.updateProduct(id, validation.data);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
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
      
      const success = await storage.deleteProduct(id);
      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }
      
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
        userId: req.user.id
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
  app.get("/api/orders", isAuthenticated, async (req, res) => {
    try {
      const orders = await storage.getUserOrders(req.user.id);
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

  app.post("/api/orders", isAuthenticated, async (req, res) => {
    try {
      const validation = insertOrderSchema.safeParse({
        ...req.body,
        userId: req.user.id
      });
      
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      const order = await storage.createOrder(validation.data);
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

  // Stripe payment intent for checkout
  app.post("/api/create-payment-intent", isAuthenticated, async (req, res) => {
    try {
      const { amount } = req.body;
      if (!amount || typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
      });
      
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Create payment intent error:", error);
      res.status(500).json({ message: error.message || "Error creating payment intent" });
    }
  });

  // User profile route
  app.get("/api/profile", isAuthenticated, async (req, res) => {
    try {
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

  const httpServer = createServer(app);
  return httpServer;
}
