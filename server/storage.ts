import {
  users, categories, products, reviews, orders, heroBanners, testimonials,
  type User, type InsertUser,
  type Category, type InsertCategory,
  type Product, type InsertProduct,
  type Review, type InsertReview,
  type Order, type InsertOrder,
  type HeroBanner, type InsertHeroBanner,
  type Testimonial, type InsertTestimonial
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByFirebaseId(firebaseUid: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
  updateUserStripeInfo(id: number, stripeInfo: { customerId: string }): Promise<User | undefined>;
  updateUserTwoFactorSecret(id: number, secret: string): Promise<User | undefined>;
  enableTwoFactor(id: number): Promise<User | undefined>;
  disableTwoFactor(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  
  // Password reset methods
  savePasswordResetOTP(userId: number, otp: string, expiresAt: Date): Promise<void>;
  verifyPasswordResetOTP(userId: number | string, otp: string): Promise<boolean>;
  getAllPasswordResetOTPs(): Record<string, { otp: string, expiresAt: Date }>;
  saveResetToken(userId: number | string, token: string): Promise<void>;
  verifyResetToken(userId: number | string, token: string): Promise<boolean>;
  clearResetToken(userId: number | string): Promise<void>;
  getAllResetTokens(): Record<string, string>; // For debugging

  // Category methods
  getCategory(id: number): Promise<Category | undefined>;
  getCategoryByName(name: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, categoryData: Partial<Category>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;
  getAllCategories(): Promise<Category[]>;
  getFeaturedCategories(): Promise<Category[]>;

  // Product methods
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, productData: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  getAllProducts(): Promise<Product[]>;
  getProductsByCategory(categoryId: number): Promise<Product[]>;
  getFeaturedProducts(): Promise<Product[]>;
  getTrendingProducts(): Promise<Product[]>;
  searchProducts(query: string): Promise<Product[]>;

  // Review methods
  getReview(id: number): Promise<Review | undefined>;
  createReview(review: InsertReview): Promise<Review>;
  getProductReviews(productId: number): Promise<Review[]>;
  getUserReviews(userId: number): Promise<Review[]>;

  // Order methods
  getOrder(id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;
  getUserOrders(userId: number): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;

  // Hero Banner methods
  getHeroBanner(id: number): Promise<HeroBanner | undefined>;
  createHeroBanner(banner: InsertHeroBanner): Promise<HeroBanner>;
  updateHeroBanner(id: number, bannerData: Partial<HeroBanner>): Promise<HeroBanner | undefined>;
  deleteHeroBanner(id: number): Promise<boolean>;
  getActiveHeroBanners(): Promise<HeroBanner[]>;

  // Testimonial methods
  getTestimonial(id: number): Promise<Testimonial | undefined>;
  createTestimonial(testimonial: InsertTestimonial): Promise<Testimonial>;
  getFeaturedTestimonials(): Promise<Testimonial[]>;
  getAllTestimonials(): Promise<Testimonial[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private categories: Map<number, Category>;
  private products: Map<number, Product>;
  private reviews: Map<number, Review>;
  private orders: Map<number, Order>;
  private heroBanners: Map<number, HeroBanner>;
  private testimonials: Map<number, Testimonial>;
  
  // Maps to store password reset related data
  private passwordResetOTPs: Map<string | number, { otp: string, expiresAt: Date }>;
  private passwordResetTokens: Map<string | number, string>;
  
  private currentUserId: number;
  private currentCategoryId: number;
  private currentProductId: number;
  private currentReviewId: number;
  private currentOrderId: number;
  private currentHeroBannerId: number;
  private currentTestimonialId: number;

  constructor() {
    this.users = new Map();
    this.categories = new Map();
    this.products = new Map();
    this.reviews = new Map();
    this.orders = new Map();
    this.heroBanners = new Map();
    this.testimonials = new Map();
    
    // Initialize password reset maps
    this.passwordResetOTPs = new Map();
    this.passwordResetTokens = new Map();
    
    this.currentUserId = 1;
    this.currentCategoryId = 1;
    this.currentProductId = 1;
    this.currentReviewId = 1;
    this.currentOrderId = 1;
    this.currentHeroBannerId = 1;
    this.currentTestimonialId = 1;

    // Initialize with sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Sample categories
    const categories = [
      { name: "Dresses", image: "https://images.unsplash.com/photo-1551232864-3f0890e580d9", description: "Elegant dresses for every occasion", featured: true },
      { name: "Tops", image: "https://images.unsplash.com/photo-1555069519-127aadedf1ee", description: "Stylish tops for the modern woman", featured: true },
      { name: "Bottoms", image: "https://images.unsplash.com/photo-1509551388413-e18d0ac5d495", description: "Comfortable and stylish bottoms", featured: true },
      { name: "Accessories", image: "https://images.unsplash.com/photo-1537832816519-689ad163238b", description: "Elegant accessories to complete your look", featured: true }
    ];
    
    categories.forEach(category => this.createCategory(category));

    // Sample products
    const products = [
      {
        name: "Pink Floral Summer Dress",
        description: "A beautiful pink floral dress perfect for summer occasions.",
        price: 89.99,
        categoryId: 1,
        images: ["https://images.unsplash.com/photo-1566174053879-31528523f8ae"],
        sizes: ["XS", "S", "M", "L", "XL"],
        colors: ["Pink", "White"],
        stock: 20,
        featured: true,
        trending: false
      },
      {
        name: "Elegant White Blouse",
        description: "A versatile white blouse that can be dressed up or down.",
        price: 59.99,
        categoryId: 2,
        images: ["https://images.unsplash.com/photo-1485968579580-b6d095142e6e"],
        sizes: ["S", "M", "L"],
        colors: ["White", "Beige"],
        stock: 15,
        featured: true,
        trending: false
      },
      {
        name: "High-Waisted Beige Pants",
        description: "Comfortable high-waisted pants perfect for office or casual wear.",
        price: 75.99,
        categoryId: 3,
        images: ["https://images.unsplash.com/photo-1583846717393-dc2412c95ed7"],
        sizes: ["XS", "S", "M", "L"],
        colors: ["Beige", "Black", "Navy"],
        stock: 12,
        featured: true,
        trending: false
      },
      {
        name: "Elegant Pearl Necklace",
        description: "A timeless pearl necklace to elevate any outfit.",
        price: 129.99,
        categoryId: 4,
        images: ["https://images.unsplash.com/photo-1576402187878-974f70c890a5"],
        sizes: ["One Size"],
        colors: ["Pearl White"],
        stock: 8,
        featured: true,
        trending: false
      },
      {
        name: "Pastel Pink Midi Dress",
        description: "A stunning pastel pink midi dress for special occasions.",
        price: 99.99,
        discountPrice: 79.99,
        categoryId: 1,
        images: ["https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f"],
        sizes: ["XS", "S", "M", "L"],
        colors: ["Pink", "Lavender"],
        stock: 10,
        featured: false,
        trending: true
      },
      {
        name: "Classic Beige Blazer",
        description: "A timeless beige blazer that works for any professional setting.",
        price: 149.99,
        categoryId: 2,
        images: ["https://images.unsplash.com/photo-1581044777550-4cfa60707c03"],
        sizes: ["S", "M", "L", "XL"],
        colors: ["Beige", "Black"],
        stock: 7,
        featured: false,
        trending: true
      },
      {
        name: "Gold Statement Earrings",
        description: "Beautiful gold statement earrings to complete your look.",
        price: 79.99,
        discountPrice: 59.99,
        categoryId: 4,
        images: ["https://images.unsplash.com/photo-1551028719-00167b16eac5"],
        sizes: ["One Size"],
        colors: ["Gold"],
        stock: 15,
        featured: false,
        trending: true
      }
    ];
    
    products.forEach(product => this.createProduct(product));

    // Sample hero banners
    const heroBanners = [
      {
        title: "Autumn Collection 2024",
        subtitle: "Discover this season's most elegant and sophisticated designs crafted for the modern woman.",
        image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b",
        buttonText: "Shop Now",
        buttonLink: "/shop",
        active: true
      }
    ];
    
    heroBanners.forEach(banner => this.createHeroBanner(banner));

    // Sample testimonials
    const testimonials = [
      {
        name: "Emily Johnson",
        image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
        comment: "I absolutely love my new summer dress! The fabric is so comfortable and the fit is perfect. I've received so many compliments when wearing it.",
        rating: 5,
        featured: true
      },
      {
        name: "Sophia Martinez",
        image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2",
        comment: "The blazer I purchased is so versatile and well-made. I can dress it up for work or wear it casually on weekends. Definitely worth the investment!",
        rating: 5,
        featured: true
      },
      {
        name: "Rebecca Taylor",
        image: "https://images.unsplash.com/photo-1553867745-6e038d085e86",
        comment: "I'm extremely pleased with my purchase. The website made it easy to find exactly what I was looking for, and the shipping was fast. Will definitely shop here again.",
        rating: 4.5,
        featured: true
      }
    ];
    
    testimonials.forEach(testimonial => this.createTestimonial(testimonial));

    // Add admin user
    this.createUser({
      username: "admin",
      email: "admin@feminineelegance.com",
      password: "admin123", // In a real app, this would be securely hashed
      fullName: "Admin User",
      role: "admin"
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email
    );
  }
  
  async getUserByFirebaseId(firebaseUid: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.firebaseUid === firebaseUid
    );
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const createdAt = new Date();
    
    // Define default values for required fields if not provided
    const user: User = { 
      id, 
      username: userData.username,
      email: userData.email,
      password: userData.password,
      fullName: userData.fullName || null,
      role: userData.role || "user", // Default to user role if not specified
      address: userData.address || null,
      phone: userData.phone || null,
      createdAt,
      wishlistItems: [],
      stripeCustomerId: null,
      twoFactorSecret: null,
      twoFactorEnabled: false,
      firebaseUid: userData.firebaseUid || null,
      photoURL: userData.photoURL || null
    };
    
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserStripeInfo(id: number, stripeInfo: { customerId: string }): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, stripeCustomerId: stripeInfo.customerId };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserTwoFactorSecret(id: number, secret: string): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, twoFactorSecret: secret };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async enableTwoFactor(id: number): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, twoFactorEnabled: true };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async disableTwoFactor(id: number): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, twoFactorEnabled: false, twoFactorSecret: null };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Password reset methods
  async savePasswordResetOTP(userId: number, otp: string, expiresAt: Date): Promise<void> {
    console.log(`Saving password reset OTP for user ID: ${userId}, OTP: ${otp}, expires: ${expiresAt}`);
    // Store the OTP both as number and string key to ensure lookup works in both formats
    this.passwordResetOTPs.set(userId, { otp, expiresAt });
    this.passwordResetOTPs.set(userId.toString(), { otp, expiresAt });
  }

  async verifyPasswordResetOTP(userId: number | string, otp: string): Promise<boolean> {
    try {
      // Convert userId to string for consistent lookup
      const userIdStr = String(userId);
      console.log(`Verifying OTP for user ID: ${userIdStr}, OTP: ${otp}`);
      
      // Dump all keys for debugging
      const allKeys: string[] = [];
      this.passwordResetOTPs.forEach((value, key) => {
        allKeys.push(String(key));
      });
      console.log(`Available OTP keys: [${allKeys.join(', ')}]`);
      
      // Debug: Log all current OTPs in the system
      const allOtps = this.getAllPasswordResetOTPs();
      console.log(`Current OTPs in system:`, allOtps);
      
      // First try with the userId as string
      let resetData = this.passwordResetOTPs.get(userIdStr);
      let matchKey = userIdStr;
      
      // If not found and userId is a string that represents a number, try with the number
      if (!resetData && typeof userId === 'string' && !isNaN(Number(userId))) {
        const numericId = Number(userId);
        resetData = this.passwordResetOTPs.get(numericId);
        if (resetData) matchKey = String(numericId);
        console.log(`Tried numeric ID ${numericId}, found data: ${!!resetData}`);
      }
      
      // If not found and userId is a number, try with string version
      if (!resetData && typeof userId === 'number') {
        const stringId = String(userId);
        resetData = this.passwordResetOTPs.get(stringId);
        if (resetData) matchKey = stringId;
        console.log(`Tried string ID "${stringId}", found data: ${!!resetData}`);
      }
      
      // If still not found, try with email if the userId looks like an email
      if (!resetData && typeof userId === 'string' && userId.includes('@')) {
        console.log(`Trying email lookup for: ${userId}`);
        resetData = this.passwordResetOTPs.get(userId);
        if (resetData) matchKey = userId;
      }
      
      // Last resort: scan through all stored OTPs to find one with matching OTP value
      if (!resetData) {
        console.log(`No OTP found yet. Trying fallback lookup by OTP value.`);
        let matchedKey: string | number | null = null;
        
        this.passwordResetOTPs.forEach((value, key) => {
          if (value.otp === otp) {
            console.log(`Found matching OTP with key: ${key}`);
            resetData = value;
            matchKey = String(key);
            matchedKey = key;
          }
        });
        
        if (matchedKey) {
          console.log(`Using matched key from scan: ${matchedKey}`);
        }
      }
      
      if (!resetData) {
        console.log(`No OTP found for user ID: ${userIdStr} or OTP: ${otp}`);
        return false;
      }
      
      console.log(`Found OTP for key: ${matchKey}, stored OTP: ${resetData.otp}, provided OTP: ${otp}`);
      
      // Check if OTP is expired
      if (new Date() > resetData.expiresAt) {
        console.log(`OTP expired for key: ${matchKey}`);
        this.passwordResetOTPs.delete(userId);
        this.passwordResetOTPs.delete(userIdStr);
        if (typeof userId === 'string' && !isNaN(Number(userId))) {
          this.passwordResetOTPs.delete(Number(userId));
        }
        return false;
      }
      
      // Validate OTP
      const isValid = resetData.otp === otp;
      console.log(`OTP validation result: ${isValid}`);
      
      // Delete OTP after use if valid
      if (isValid) {
        // Delete all entries with this OTP to clean up storage completely
        const keysToDelete: (string | number)[] = [];
        
        this.passwordResetOTPs.forEach((value, key) => {
          if (value.otp === otp) {
            console.log(`Will delete OTP entry with key: ${key}`);
            keysToDelete.push(key);
          }
        });
        
        // Actually delete all the keys
        keysToDelete.forEach(key => {
          this.passwordResetOTPs.delete(key);
        });
        
        // Also delete the specific keys we know about
        this.passwordResetOTPs.delete(userId);
        this.passwordResetOTPs.delete(userIdStr);
        if (typeof userId === 'string' && !isNaN(Number(userId))) {
          this.passwordResetOTPs.delete(Number(userId));
        }
        
        console.log(`Deleted ${keysToDelete.length} OTP entries after successful verification`);
      }
      
      return isValid;
    } catch (error) {
      console.error("Error in verifyPasswordResetOTP:", error);
      return false;
    }
  }
  
  // For debugging purposes - returns all OTPs in the system
  getAllPasswordResetOTPs(): Record<string, { otp: string, expiresAt: Date }> {
    try {
      const result: Record<string, { otp: string, expiresAt: Date }> = {};
      this.passwordResetOTPs.forEach((value, key) => {
        result[String(key)] = value;
      });
      return result;
    } catch (error) {
      console.error("Error getting all OTPs:", error);
      return {};
    }
  }

  async saveResetToken(userId: number | string, token: string): Promise<void> {
    // Save token with both numeric and string keys for consistency
    if (typeof userId === 'number') {
      this.passwordResetTokens.set(userId, token);
      this.passwordResetTokens.set(userId.toString(), token);
    } else {
      this.passwordResetTokens.set(userId, token);
      if (!isNaN(Number(userId))) {
        this.passwordResetTokens.set(Number(userId), token);
      }
    }
    console.log(`Reset token saved for user ID: ${userId}`);
  }

  async verifyResetToken(userId: number | string, token: string): Promise<boolean> {
    try {
      // Convert userId to string for logging
      const userIdStr = String(userId);
      console.log(`Verifying reset token for user ID: ${userIdStr}`);
      
      // First try with the ID as provided
      let savedToken = this.passwordResetTokens.get(userId);
      
      // If not found and userId is a string that represents a number, try with the number
      if (!savedToken && typeof userId === 'string' && !isNaN(Number(userId))) {
        const numericId = Number(userId);
        savedToken = this.passwordResetTokens.get(numericId);
        console.log(`Tried numeric ID ${numericId}, found token: ${!!savedToken}`);
      }
      
      // If not found and userId is a number, try with string version
      if (!savedToken && typeof userId === 'number') {
        savedToken = this.passwordResetTokens.get(String(userId));
        console.log(`Tried string ID "${String(userId)}", found token: ${!!savedToken}`);
      }
      
      if (!savedToken) {
        console.log(`No reset token found for user ID: ${userIdStr}`);
        
        // Log all tokens for debugging
        let allTokens = "Saved tokens: ";
        this.passwordResetTokens.forEach((value, key) => {
          allTokens += `${key} (${typeof key}), `;
        });
        console.log(allTokens);
        
        return false;
      }
      
      console.log(`Found reset token for user ID: ${userIdStr}`);
      const isTokenValid = savedToken === token;
      console.log(`Token validation result: ${isTokenValid}`);
      
      return isTokenValid;
    } catch (error) {
      console.error("Error in verifyResetToken:", error);
      return false;
    }
  }

  async clearResetToken(userId: number | string): Promise<void> {
    // Delete both numeric and string versions of the token
    if (typeof userId === 'number') {
      this.passwordResetTokens.delete(userId);
      this.passwordResetTokens.delete(userId.toString());
    } else {
      this.passwordResetTokens.delete(userId);
      if (!isNaN(Number(userId))) {
        this.passwordResetTokens.delete(Number(userId));
      }
    }
    console.log(`Reset token cleared for user ID: ${userId}`);
  }
  
  // For debugging purposes - returns all reset tokens in the system
  getAllResetTokens(): Record<string, string> {
    try {
      const result: Record<string, string> = {};
      this.passwordResetTokens.forEach((value, key) => {
        result[String(key)] = value;
      });
      return result;
    } catch (error) {
      console.error("Error getting all reset tokens:", error);
      return {};
    }
  }

  // Category methods
  async getCategory(id: number): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    return Array.from(this.categories.values()).find(
      (category) => category.name.toLowerCase() === name.toLowerCase()
    );
  }

  async createCategory(categoryData: InsertCategory): Promise<Category> {
    const id = this.currentCategoryId++;
    const category: Category = { 
      id,
      name: categoryData.name,
      image: categoryData.image || null,
      description: categoryData.description || null,
      featured: categoryData.featured || null
    };
    this.categories.set(id, category);
    return category;
  }

  async updateCategory(id: number, categoryData: Partial<Category>): Promise<Category | undefined> {
    const category = await this.getCategory(id);
    if (!category) return undefined;
    
    const updatedCategory = { ...category, ...categoryData };
    this.categories.set(id, updatedCategory);
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<boolean> {
    return this.categories.delete(id);
  }

  async getAllCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async getFeaturedCategories(): Promise<Category[]> {
    return Array.from(this.categories.values()).filter(
      (category) => category.featured
    );
  }

  // Product methods
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
    const id = this.currentProductId++;
    const createdAt = new Date();
    const product: Product = { 
      id,
      name: productData.name,
      description: productData.description,
      price: productData.price,
      createdAt,
      categoryId: productData.categoryId || null,
      discountPrice: productData.discountPrice || null,
      featured: productData.featured || null,
      trending: productData.trending || null,
      images: productData.images || [],
      sizes: productData.sizes || [],
      colors: productData.colors || [],
      stock: productData.stock || 0
    };
    this.products.set(id, product);
    return product;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | undefined> {
    const product = await this.getProduct(id);
    if (!product) return undefined;
    
    const updatedProduct = { ...product, ...productData };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }

  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getProductsByCategory(categoryId: number): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (product) => product.categoryId === categoryId
    );
  }

  async getFeaturedProducts(): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (product) => product.featured
    );
  }

  async getTrendingProducts(): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (product) => product.trending
    );
  }

  async searchProducts(query: string): Promise<Product[]> {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.products.values()).filter(
      (product) => 
        product.name.toLowerCase().includes(lowercaseQuery) ||
        product.description.toLowerCase().includes(lowercaseQuery)
    );
  }

  // Review methods
  async getReview(id: number): Promise<Review | undefined> {
    return this.reviews.get(id);
  }

  async createReview(reviewData: InsertReview): Promise<Review> {
    const id = this.currentReviewId++;
    const createdAt = new Date();
    const review: Review = {
      id,
      createdAt,
      productId: reviewData.productId,
      userId: reviewData.userId,
      rating: reviewData.rating,
      comment: reviewData.comment || null,
      images: reviewData.images || []
    };
    this.reviews.set(id, review);
    return review;
  }

  async getProductReviews(productId: number): Promise<Review[]> {
    return Array.from(this.reviews.values()).filter(
      (review) => review.productId === productId
    );
  }

  async getUserReviews(userId: number): Promise<Review[]> {
    return Array.from(this.reviews.values()).filter(
      (review) => review.userId === userId
    );
  }

  // Order methods
  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async createOrder(orderData: InsertOrder): Promise<Order> {
    const id = this.currentOrderId++;
    const createdAt = new Date();
    const order: Order = {
      id,
      createdAt,
      status: orderData.status || 'pending',
      userId: orderData.userId || null,
      items: orderData.items || [],
      totalAmount: orderData.totalAmount,
      shippingAddress: orderData.shippingAddress || {},
      paymentStatus: orderData.paymentStatus || 'pending',
      paymentIntent: orderData.paymentIntent || null,
      trackingNumber: orderData.trackingNumber || null,
      updatedAt: null,
      firebaseOrderId: orderData.firebaseOrderId || null
    };
    this.orders.set(id, order);
    return order;
  }

  async updateOrderStatus(id: string | number, status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'): Promise<Order | undefined> {
    // If id is a string, try to convert it to a number if possible (for database storage)
    const orderId = typeof id === 'string' && !isNaN(Number(id)) ? Number(id) : id;
    
    // For string IDs that can't be converted to numbers (like Firebase IDs), 
    // we'll need to implement a lookup by a custom field. For this example, we'll
    // use a simple approach and just check all orders
    if (typeof orderId === 'string') {
      // This is a Firebase ID or other string ID
      // In a real implementation, we would add a proper lookup
      console.log(`Looking for order with string ID ${orderId}`);
      
      // Just returning undefined for now as we don't yet have a string ID lookup
      // This will be handled by the Firebase direct update in the routes.ts
      return undefined;
    }
    
    // Standard numeric ID lookup
    const order = await this.getOrder(orderId as number);
    if (!order) return undefined;
    
    const updatedOrder = { ...order, status, updatedAt: new Date() };
    this.orders.set(orderId as number, updatedOrder);
    return updatedOrder;
  }

  async getUserOrders(userId: number): Promise<Order[]> {
    // If userId is provided, filter by userId, otherwise return an empty array
    if (!userId) return [];
    
    return Array.from(this.orders.values()).filter(
      (order) => order.userId === userId
    );
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  // Hero Banner methods
  async getHeroBanner(id: number): Promise<HeroBanner | undefined> {
    return this.heroBanners.get(id);
  }

  async createHeroBanner(bannerData: InsertHeroBanner): Promise<HeroBanner> {
    const id = this.currentHeroBannerId++;
    const banner: HeroBanner = {
      id,
      title: bannerData.title,
      image: bannerData.image,
      subtitle: bannerData.subtitle || null,
      buttonText: bannerData.buttonText || null,
      buttonLink: bannerData.buttonLink || null,
      active: bannerData.active || null,
      startDate: bannerData.startDate || null,
      endDate: bannerData.endDate || null
    };
    this.heroBanners.set(id, banner);
    return banner;
  }

  async updateHeroBanner(id: number, bannerData: Partial<HeroBanner>): Promise<HeroBanner | undefined> {
    const banner = await this.getHeroBanner(id);
    if (!banner) return undefined;
    
    const updatedBanner = { ...banner, ...bannerData };
    this.heroBanners.set(id, updatedBanner);
    return updatedBanner;
  }

  async deleteHeroBanner(id: number): Promise<boolean> {
    return this.heroBanners.delete(id);
  }

  async getActiveHeroBanners(): Promise<HeroBanner[]> {
    const now = new Date();
    return Array.from(this.heroBanners.values()).filter(
      (banner) => {
        if (!banner.active) return false;
        
        const startDateValid = !banner.startDate || new Date(banner.startDate) <= now;
        const endDateValid = !banner.endDate || new Date(banner.endDate) >= now;
        
        return startDateValid && endDateValid;
      }
    );
  }

  // Testimonial methods
  async getTestimonial(id: number): Promise<Testimonial | undefined> {
    return this.testimonials.get(id);
  }

  async createTestimonial(testimonialData: InsertTestimonial): Promise<Testimonial> {
    const id = this.currentTestimonialId++;
    const testimonial: Testimonial = {
      id,
      name: testimonialData.name,
      comment: testimonialData.comment,
      rating: testimonialData.rating,
      image: testimonialData.image || null,
      featured: testimonialData.featured || null
    };
    this.testimonials.set(id, testimonial);
    return testimonial;
  }

  async getFeaturedTestimonials(): Promise<Testimonial[]> {
    return Array.from(this.testimonials.values()).filter(
      (testimonial) => testimonial.featured
    );
  }

  async getAllTestimonials(): Promise<Testimonial[]> {
    return Array.from(this.testimonials.values());
  }
}

// Database implementation
export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error("Database error in getUser:", error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    } catch (error) {
      console.error("Database error in getUserByEmail:", error);
      return undefined;
    }
  }
  
  async getUserByFirebaseId(firebaseUid: string): Promise<User | undefined> {
    try {
      console.log("Looking for user with Firebase UID:", firebaseUid);
      const [user] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid));
      console.log("Database result:", user);
      return user;
    } catch (error) {
      console.error("Database error in getUserByFirebaseId:", error);
      return undefined;
    }
  }

  async createUser(userData: InsertUser): Promise<User> {
    try {
      const [user] = await db.insert(users).values(userData).returning();
      return user;
    } catch (error) {
      console.error("Database error in createUser:", error);
      throw error;
    }
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set(userData)
        .where(eq(users.id, id))
        .returning();
      return updatedUser;
    } catch (error) {
      console.error("Database error in updateUser:", error);
      return undefined;
    }
  }

  async updateUserStripeInfo(id: number, stripeInfo: { customerId: string }): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({ stripeCustomerId: stripeInfo.customerId })
        .where(eq(users.id, id))
        .returning();
      return updatedUser;
    } catch (error) {
      console.error("Database error in updateUserStripeInfo:", error);
      return undefined;
    }
  }

  async updateUserTwoFactorSecret(id: number, secret: string): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({ twoFactorSecret: secret })
        .where(eq(users.id, id))
        .returning();
      return updatedUser;
    } catch (error) {
      console.error("Database error in updateUserTwoFactorSecret:", error);
      return undefined;
    }
  }

  async enableTwoFactor(id: number): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({ twoFactorEnabled: true })
        .where(eq(users.id, id))
        .returning();
      return updatedUser;
    } catch (error) {
      console.error("Database error in enableTwoFactor:", error);
      return undefined;
    }
  }

  async disableTwoFactor(id: number): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({ twoFactorEnabled: false, twoFactorSecret: null })
        .where(eq(users.id, id))
        .returning();
      return updatedUser;
    } catch (error) {
      console.error("Database error in disableTwoFactor:", error);
      return undefined;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error) {
      console.error("Database error in getAllUsers:", error);
      return [];
    }
  }
  
  // Password reset methods - need to create tables or add to schema for production usage
  // For now, we'll implement these in a way that will work for demonstration purposes
  private passwordResetOTPs = new Map<string | number, { otp: string, expiresAt: Date }>();
  private passwordResetTokens = new Map<string | number, string>();
  
  async savePasswordResetOTP(userId: number, otp: string, expiresAt: Date): Promise<void> {
    try {
      console.log(`Saving password reset OTP for user ID: ${userId}, OTP: ${otp}, expires: ${expiresAt}`);
      // Store OTP with both numeric and string keys for consistency with MemStorage
      this.passwordResetOTPs.set(userId, { otp, expiresAt });
      this.passwordResetOTPs.set(userId.toString(), { otp, expiresAt });
    } catch (error) {
      console.error("Error in savePasswordResetOTP:", error);
    }
  }

  async verifyPasswordResetOTP(userId: number | string, otp: string): Promise<boolean> {
    try {
      // Convert userId to string for consistent lookup
      const userIdStr = String(userId);
      console.log(`Verifying OTP for user ID: ${userIdStr}`);
      
      // First try with the user ID as is
      let resetData = this.passwordResetOTPs.get(userId);
      
      // If not found and userId is a string that represents a number, try with the number
      if (!resetData && typeof userId === 'string' && !isNaN(Number(userId))) {
        const numericId = Number(userId);
        resetData = this.passwordResetOTPs.get(numericId);
        console.log(`Tried numeric ID ${numericId}, found data: ${!!resetData}`);
      }
      
      // If not found and userId is a number, try with string version
      if (!resetData && typeof userId === 'number') {
        resetData = this.passwordResetOTPs.get(String(userId));
        console.log(`Tried string ID "${String(userId)}", found data: ${!!resetData}`);
      }
      
      if (!resetData) {
        console.log(`No OTP found for user ID: ${userIdStr}`);
        return false;
      }
      
      console.log(`Found OTP for user ID: ${userIdStr}, stored OTP: ${resetData.otp}, provided OTP: ${otp}`);
      
      // Check if OTP is expired
      if (new Date() > resetData.expiresAt) {
        console.log(`OTP expired for user ID: ${userIdStr}`);
        this.passwordResetOTPs.delete(userId);
        return false;
      }
      
      // Validate OTP
      const isValid = resetData.otp === otp;
      console.log(`OTP validation result for user ID: ${userIdStr}: ${isValid}`);
      
      // Delete OTP after use
      if (isValid) {
        if (typeof userId === 'string' && !isNaN(Number(userId))) {
          this.passwordResetOTPs.delete(Number(userId));
        }
        this.passwordResetOTPs.delete(userId);
        console.log(`Deleted OTP for user ID: ${userIdStr} after successful verification`);
      }
      
      return isValid;
    } catch (error) {
      console.error("Error in verifyPasswordResetOTP:", error);
      return false;
    }
  }
  
  // For debugging purposes - returns all OTPs in the system
  getAllPasswordResetOTPs(): Record<string, { otp: string, expiresAt: Date }> {
    try {
      const result: Record<string, { otp: string, expiresAt: Date }> = {};
      this.passwordResetOTPs.forEach((value, key) => {
        result[String(key)] = value;
      });
      return result;
    } catch (error) {
      console.error("Error getting all OTPs:", error);
      return {};
    }
  }
  
  // For debugging purposes - returns all reset tokens in the system
  getAllResetTokens(): Record<string, string> {
    try {
      const result: Record<string, string> = {};
      this.passwordResetTokens.forEach((value, key) => {
        result[String(key)] = value;
      });
      return result;
    } catch (error) {
      console.error("Error getting all reset tokens:", error);
      return {};
    }
  }

  async saveResetToken(userId: number | string, token: string): Promise<void> {
    try {
      // Save token with both numeric and string keys for consistency
      if (typeof userId === 'number') {
        this.passwordResetTokens.set(userId, token);
        this.passwordResetTokens.set(userId.toString(), token);
      } else {
        this.passwordResetTokens.set(userId, token);
        if (!isNaN(Number(userId))) {
          this.passwordResetTokens.set(Number(userId), token);
        }
      }
      console.log(`Reset token saved for user ID: ${userId}`);
    } catch (error) {
      console.error("Error in saveResetToken:", error);
    }
  }

  async verifyResetToken(userId: number | string, token: string): Promise<boolean> {
    try {
      // Convert userId to string for logging
      const userIdStr = String(userId);
      console.log(`Verifying reset token for user ID: ${userIdStr}`);
      
      // First try with the ID as provided
      let savedToken = this.passwordResetTokens.get(userId);
      
      // If not found and userId is a string that represents a number, try with the number
      if (!savedToken && typeof userId === 'string' && !isNaN(Number(userId))) {
        const numericId = Number(userId);
        savedToken = this.passwordResetTokens.get(numericId);
        console.log(`Tried numeric ID ${numericId}, found token: ${!!savedToken}`);
      }
      
      // If not found and userId is a number, try with string version
      if (!savedToken && typeof userId === 'number') {
        savedToken = this.passwordResetTokens.get(String(userId));
        console.log(`Tried string ID "${String(userId)}", found token: ${!!savedToken}`);
      }
      
      if (!savedToken) {
        console.log(`No reset token found for user ID: ${userIdStr}`);
        
        // Log all tokens for debugging
        let allTokens = "Saved tokens: ";
        this.passwordResetTokens.forEach((value, key) => {
          allTokens += `${key} (${typeof key}), `;
        });
        console.log(allTokens);
        
        return false;
      }
      
      console.log(`Found reset token for user ID: ${userIdStr}`);
      const isTokenValid = savedToken === token;
      console.log(`Token validation result: ${isTokenValid}`);
      
      return isTokenValid;
    } catch (error) {
      console.error("Error in verifyResetToken:", error);
      return false;
    }
  }

  async clearResetToken(userId: number | string): Promise<void> {
    try {
      // Delete both numeric and string versions of the token
      if (typeof userId === 'number') {
        this.passwordResetTokens.delete(userId);
        this.passwordResetTokens.delete(userId.toString());
      } else {
        this.passwordResetTokens.delete(userId);
        if (!isNaN(Number(userId))) {
          this.passwordResetTokens.delete(Number(userId));
        }
      }
      console.log(`Reset token cleared for user ID: ${userId}`);
    } catch (error) {
      console.error("Error in clearResetToken:", error);
    }
  }

  // We'll implement the bare minimum to get the admin panel working
  // Category methods
  async getCategory(id: number): Promise<Category | undefined> {
    try {
      const [category] = await db.select().from(categories).where(eq(categories.id, id));
      return category;
    } catch (error) {
      console.error("Database error in getCategory:", error);
      return undefined;
    }
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    try {
      const [category] = await db.select().from(categories).where(eq(categories.name, name));
      return category;
    } catch (error) {
      console.error("Database error in getCategoryByName:", error);
      return undefined;
    }
  }

  async createCategory(categoryData: InsertCategory): Promise<Category> {
    try {
      const [category] = await db.insert(categories).values(categoryData).returning();
      return category;
    } catch (error) {
      console.error("Database error in createCategory:", error);
      throw error;
    }
  }

  async updateCategory(id: number, categoryData: Partial<Category>): Promise<Category | undefined> {
    try {
      const [updatedCategory] = await db
        .update(categories)
        .set(categoryData)
        .where(eq(categories.id, id))
        .returning();
      return updatedCategory;
    } catch (error) {
      console.error("Database error in updateCategory:", error);
      return undefined;
    }
  }

  async deleteCategory(id: number): Promise<boolean> {
    try {
      await db.delete(categories).where(eq(categories.id, id));
      return true;
    } catch (error) {
      console.error("Database error in deleteCategory:", error);
      return false;
    }
  }

  async getAllCategories(): Promise<Category[]> {
    try {
      return await db.select().from(categories);
    } catch (error) {
      console.error("Database error in getAllCategories:", error);
      return [];
    }
  }

  async getFeaturedCategories(): Promise<Category[]> {
    try {
      return await db.select().from(categories).where(eq(categories.featured, true));
    } catch (error) {
      console.error("Database error in getFeaturedCategories:", error);
      return [];
    }
  }

  // Implementing stubs for the rest of the methods - we'll add real implementations later
  // Product methods
  async getProduct(id: number): Promise<Product | undefined> {
    try {
      const [product] = await db.select().from(products).where(eq(products.id, id));
      return product;
    } catch (error) {
      console.error("Database error in getProduct:", error);
      return undefined;
    }
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
    try {
      const [product] = await db.insert(products).values(productData).returning();
      return product;
    } catch (error) {
      console.error("Database error in createProduct:", error);
      throw error;
    }
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | undefined> {
    try {
      const [updatedProduct] = await db
        .update(products)
        .set(productData)
        .where(eq(products.id, id))
        .returning();
      return updatedProduct;
    } catch (error) {
      console.error("Database error in updateProduct:", error);
      return undefined;
    }
  }

  async deleteProduct(id: number): Promise<boolean> {
    try {
      await db.delete(products).where(eq(products.id, id));
      return true;
    } catch (error) {
      console.error("Database error in deleteProduct:", error);
      return false;
    }
  }

  async getAllProducts(): Promise<Product[]> {
    try {
      return await db.select().from(products);
    } catch (error) {
      console.error("Database error in getAllProducts:", error);
      return [];
    }
  }

  async getProductsByCategory(categoryId: number): Promise<Product[]> {
    try {
      return await db.select().from(products).where(eq(products.categoryId, categoryId));
    } catch (error) {
      console.error("Database error in getProductsByCategory:", error);
      return [];
    }
  }

  async getFeaturedProducts(): Promise<Product[]> {
    try {
      return await db.select().from(products).where(eq(products.featured, true));
    } catch (error) {
      console.error("Database error in getFeaturedProducts:", error);
      return [];
    }
  }

  async getTrendingProducts(): Promise<Product[]> {
    try {
      return await db.select().from(products).where(eq(products.trending, true));
    } catch (error) {
      console.error("Database error in getTrendingProducts:", error);
      return [];
    }
  }

  async searchProducts(query: string): Promise<Product[]> {
    try {
      return await db
        .select()
        .from(products)
        .where(
          or(
            ilike(products.name, `%${query}%`),
            ilike(products.description, `%${query}%`)
          )
        );
    } catch (error) {
      console.error("Database error in searchProducts:", error);
      return [];
    }
  }

  // Minimal implementations for other methods to satisfy the interface
  async getReview(id: number): Promise<Review | undefined> {
    try {
      const [review] = await db.select().from(reviews).where(eq(reviews.id, id));
      return review;
    } catch (error) {
      console.error("Database error in getReview:", error);
      return undefined;
    }
  }

  async createReview(reviewData: InsertReview): Promise<Review> {
    try {
      const [review] = await db.insert(reviews).values(reviewData).returning();
      return review;
    } catch (error) {
      console.error("Database error in createReview:", error);
      throw error;
    }
  }

  async getProductReviews(productId: number): Promise<Review[]> {
    try {
      return await db.select().from(reviews).where(eq(reviews.productId, productId));
    } catch (error) {
      console.error("Database error in getProductReviews:", error);
      return [];
    }
  }

  async getUserReviews(userId: number): Promise<Review[]> {
    try {
      return await db.select().from(reviews).where(eq(reviews.userId, userId));
    } catch (error) {
      console.error("Database error in getUserReviews:", error);
      return [];
    }
  }

  async getOrder(id: number): Promise<Order | undefined> {
    try {
      const [order] = await db.select().from(orders).where(eq(orders.id, id));
      return order;
    } catch (error) {
      console.error("Database error in getOrder:", error);
      return undefined;
    }
  }

  async createOrder(orderData: InsertOrder): Promise<Order> {
    try {
      const [order] = await db.insert(orders).values(orderData).returning();
      return order;
    } catch (error) {
      console.error("Database error in createOrder:", error);
      throw error;
    }
  }

  async updateOrderStatus(id: string | number, status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'): Promise<Order | undefined> {
    try {
      // If id is a string and starts with a non-numeric character, it's likely a Firebase ID
      if (typeof id === 'string' && isNaN(Number(id))) {
        // This is a Firebase ID, check if we have a record with this Firebase ID
        const [order] = await db
          .select()
          .from(orders)
          .where(eq(orders.firebaseOrderId, id))
          .limit(1);
        
        if (order) {
          // If we found an order with this Firebase ID, update it
          const [updatedOrder] = await db
            .update(orders)
            .set({ 
              status, 
              updatedAt: new Date() 
            })
            .where(eq(orders.id, order.id))
            .returning();
          return updatedOrder;
        } else {
          console.log(`No order found with Firebase ID: ${id}`);
          return undefined;
        }
      } else {
        // Convert to number if it's a string
        const numericId = typeof id === 'string' ? Number(id) : id;
        
        // Standard update by numeric ID
        const [updatedOrder] = await db
          .update(orders)
          .set({ 
            status, 
            updatedAt: new Date() 
          })
          .where(eq(orders.id, numericId))
          .returning();
        return updatedOrder;
      }
    } catch (error) {
      console.error("Database error in updateOrderStatus:", error);
      return undefined;
    }
  }

  async getUserOrders(userId: number): Promise<Order[]> {
    try {
      return await db.select().from(orders).where(eq(orders.userId, userId));
    } catch (error) {
      console.error("Database error in getUserOrders:", error);
      return [];
    }
  }

  async getAllOrders(): Promise<Order[]> {
    try {
      return await db.select().from(orders);
    } catch (error) {
      console.error("Database error in getAllOrders:", error);
      return [];
    }
  }

  async getHeroBanner(id: number): Promise<HeroBanner | undefined> {
    try {
      const [banner] = await db.select().from(heroBanners).where(eq(heroBanners.id, id));
      return banner;
    } catch (error) {
      console.error("Database error in getHeroBanner:", error);
      return undefined;
    }
  }

  async createHeroBanner(bannerData: InsertHeroBanner): Promise<HeroBanner> {
    try {
      const [banner] = await db.insert(heroBanners).values(bannerData).returning();
      return banner;
    } catch (error) {
      console.error("Database error in createHeroBanner:", error);
      throw error;
    }
  }

  async updateHeroBanner(id: number, bannerData: Partial<HeroBanner>): Promise<HeroBanner | undefined> {
    try {
      const [updatedBanner] = await db
        .update(heroBanners)
        .set(bannerData)
        .where(eq(heroBanners.id, id))
        .returning();
      return updatedBanner;
    } catch (error) {
      console.error("Database error in updateHeroBanner:", error);
      return undefined;
    }
  }

  async deleteHeroBanner(id: number): Promise<boolean> {
    try {
      await db.delete(heroBanners).where(eq(heroBanners.id, id));
      return true;
    } catch (error) {
      console.error("Database error in deleteHeroBanner:", error);
      return false;
    }
  }

  async getActiveHeroBanners(): Promise<HeroBanner[]> {
    try {
      return await db.select().from(heroBanners).where(eq(heroBanners.active, true));
    } catch (error) {
      console.error("Database error in getActiveHeroBanners:", error);
      return [];
    }
  }

  async getTestimonial(id: number): Promise<Testimonial | undefined> {
    try {
      const [testimonial] = await db.select().from(testimonials).where(eq(testimonials.id, id));
      return testimonial;
    } catch (error) {
      console.error("Database error in getTestimonial:", error);
      return undefined;
    }
  }

  async createTestimonial(testimonialData: InsertTestimonial): Promise<Testimonial> {
    try {
      const [testimonial] = await db.insert(testimonials).values(testimonialData).returning();
      return testimonial;
    } catch (error) {
      console.error("Database error in createTestimonial:", error);
      throw error;
    }
  }

  async getFeaturedTestimonials(): Promise<Testimonial[]> {
    try {
      return await db.select().from(testimonials).where(eq(testimonials.featured, true));
    } catch (error) {
      console.error("Database error in getFeaturedTestimonials:", error);
      return [];
    }
  }

  async getAllTestimonials(): Promise<Testimonial[]> {
    try {
      return await db.select().from(testimonials);
    } catch (error) {
      console.error("Database error in getAllTestimonials:", error);
      return [];
    }
  }
  
  // The getAllResetTokens method is already implemented above
  // No need for a duplicate implementation
}

// Import required operators
import { eq, or, ilike } from "drizzle-orm";
import { db } from "./db";

// Uncomment to use DatabaseStorage
export const storage = new DatabaseStorage();

// Comment out to disable MemStorage
// export const storage = new MemStorage();
