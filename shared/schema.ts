import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users Table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  address: text("address"),
  phone: text("phone"),
  role: text("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  wishlistItems: jsonb("wishlist_items").default([]),
  stripeCustomerId: text("stripe_customer_id"),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  firebaseUid: text("firebase_uid").unique(),
  photoURL: text("photo_url"),
});

// Categories Table
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  image: text("image"),
  description: text("description"),
  featured: boolean("featured").default(false),
});

// Products Table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: doublePrecision("price").notNull(),
  discountPrice: doublePrecision("discount_price"),
  categoryId: integer("category_id").references(() => categories.id),
  images: jsonb("images").notNull().default([]),
  sizes: jsonb("sizes").notNull().default([]),
  colors: jsonb("colors").notNull().default([]),
  stock: integer("stock").notNull().default(0),
  featured: boolean("featured").default(false),
  trending: boolean("trending").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Reviews Table
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  images: jsonb("images").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Orders Table
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  items: jsonb("items").notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  shippingAddress: jsonb("shipping_address").notNull(),
  status: text("status", { enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] }).default("pending").notNull(),
  paymentStatus: text("payment_status", { enum: ['pending', 'paid', 'failed', 'refunded'] }).default("pending").notNull(),
  paymentIntent: text("payment_intent"),
  trackingNumber: text("tracking_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
  firebaseOrderId: text("firebase_order_id"), // To link with Firebase orders
});

// Hero Banners Table
export const heroBanners = pgTable("hero_banners", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  image: text("image").notNull(),
  buttonText: text("button_text"),
  buttonLink: text("button_link"),
  active: boolean("active").default(true),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
});

// Testimonials Table
export const testimonials = pgTable("testimonials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  image: text("image"),
  comment: text("comment").notNull(),
  rating: integer("rating").notNull(),
  featured: boolean("featured").default(false),
});

// Password Reset OTP Table
export const passwordResetOTP = pgTable("password_reset_otp", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  otp: text("otp").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true, 
  wishlistItems: true, 
  stripeCustomerId: true,
  twoFactorSecret: true,
  twoFactorEnabled: true 
});
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
export const insertHeroBannerSchema = createInsertSchema(heroBanners).omit({ id: true });
export const insertTestimonialSchema = createInsertSchema(testimonials).omit({ id: true });
export const insertPasswordResetOTPSchema = createInsertSchema(passwordResetOTP).omit({ id: true, createdAt: true });

// Extended Schemas with Validations
export const userSchema = insertUserSchema.extend({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  recaptchaToken: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
  recaptchaToken: z.string().optional(),
  firebaseUid: z.string().optional(), // Add firebaseUid for Firebase Authentication
});

export const twoFactorVerifySchema = z.object({
  token: z.string().min(6, "Token must be at least 6 digits"),
});

// Password Reset Schemas
export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  recaptchaToken: z.string().optional(),
});

export const verifyOTPSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Confirm password must be at least 6 characters"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const productSchema = insertProductSchema.extend({
  name: z.string().min(3, "Product name must be at least 3 characters"),
  price: z.number().positive("Price must be a positive number"),
  categoryId: z.number().positive("Please select a category"),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserWithValidation = z.infer<typeof userSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type TwoFactorVerification = z.infer<typeof twoFactorVerifySchema>;

// Password Reset Types
export type ForgotPassword = z.infer<typeof forgotPasswordSchema>;
export type VerifyOTP = z.infer<typeof verifyOTPSchema>;
export type ResetPassword = z.infer<typeof resetPasswordSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductWithValidation = z.infer<typeof productSchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type HeroBanner = typeof heroBanners.$inferSelect;
export type InsertHeroBanner = z.infer<typeof insertHeroBannerSchema>;

export type Testimonial = typeof testimonials.$inferSelect;
export type InsertTestimonial = z.infer<typeof insertTestimonialSchema>;

export type PasswordResetOTP = typeof passwordResetOTP.$inferSelect;
export type InsertPasswordResetOTP = z.infer<typeof insertPasswordResetOTPSchema>;
