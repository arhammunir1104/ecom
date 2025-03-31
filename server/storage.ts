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
      trackingNumber: orderData.trackingNumber || null
    };
    this.orders.set(id, order);
    return order;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    const order = await this.getOrder(id);
    if (!order) return undefined;
    
    const updatedOrder = { ...order, status };
    this.orders.set(id, updatedOrder);
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

  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    try {
      const [updatedOrder] = await db
        .update(orders)
        .set({ status })
        .where(eq(orders.id, id))
        .returning();
      return updatedOrder;
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
}

// Import required operators
import { eq, or, ilike } from "drizzle-orm";
import { db } from "./db";

// Uncomment to use DatabaseStorage
export const storage = new DatabaseStorage();

// Comment out to disable MemStorage
// export const storage = new MemStorage();
