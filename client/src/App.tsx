import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";

// Layouts
import MainLayout from "./components/layouts/MainLayout";
import AdminLayout from "./components/layouts/AdminLayout";

// Pages
import Home from "./pages/home";
import Shop from "./pages/shop";
import ProductDetails from "./pages/product-details";
import Cart from "./pages/cart";
import Checkout from "./pages/checkout";
import Categories from "./pages/categories";
import Orders from "./pages/orders";
import Login from "./pages/auth/login";
import Signup from "./pages/auth/signup";
import UserProfile from "./pages/user-profile";
import NotFound from "@/pages/not-found";

// Admin Pages
import AdminDashboard from "./pages/admin/dashboard";
import AdminProducts from "./pages/admin/products";
import AdminAddProduct from "./pages/admin/add-product";
import AdminCategories from "./pages/admin/categories";
import AdminAddCategory from "./pages/admin/add-category";
import AdminUsers from "./pages/admin/users";
import AdminHeroBanners from "./pages/admin/hero-banners";

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/" component={() => (
        <MainLayout>
          <Home />
        </MainLayout>
      )} />
      <Route path="/shop" component={() => (
        <MainLayout>
          <Shop />
        </MainLayout>
      )} />
      <Route path="/product/:id" component={(params) => (
        <MainLayout>
          <ProductDetails id={Number(params.id)} />
        </MainLayout>
      )} />
      <Route path="/cart" component={() => (
        <MainLayout>
          <Cart />
        </MainLayout>
      )} />
      <Route path="/checkout" component={() => (
        <MainLayout>
          <Checkout />
        </MainLayout>
      )} />
      <Route path="/categories/:id?" component={(params) => (
        <MainLayout>
          <Categories id={params.id ? Number(params.id) : undefined} />
        </MainLayout>
      )} />
      <Route path="/login" component={() => (
        <MainLayout>
          <Login />
        </MainLayout>
      )} />
      <Route path="/signup" component={() => (
        <MainLayout>
          <Signup />
        </MainLayout>
      )} />

      {/* User Authenticated Routes */}
      <Route path="/profile" component={() => (
        <MainLayout>
          <UserProfile />
        </MainLayout>
      )} />
      <Route path="/orders" component={() => (
        <MainLayout>
          <Orders />
        </MainLayout>
      )} />

      {/* Admin Routes */}
      <Route path="/admin" component={() => (
        <AdminLayout>
          <AdminDashboard />
        </AdminLayout>
      )} />
      <Route path="/admin/products" component={() => (
        <AdminLayout>
          <AdminProducts />
        </AdminLayout>
      )} />
      <Route path="/admin/products/add" component={() => (
        <AdminLayout>
          <AdminAddProduct />
        </AdminLayout>
      )} />
      <Route path="/admin/categories" component={() => (
        <AdminLayout>
          <AdminCategories />
        </AdminLayout>
      )} />
      <Route path="/admin/categories/add" component={() => (
        <AdminLayout>
          <AdminAddCategory />
        </AdminLayout>
      )} />
      <Route path="/admin/users" component={() => (
        <AdminLayout>
          <AdminUsers />
        </AdminLayout>
      )} />
      <Route path="/admin/hero-banners" component={() => (
        <AdminLayout>
          <AdminHeroBanners />
        </AdminLayout>
      )} />

      {/* Fallback to 404 */}
      <Route component={() => (
        <MainLayout>
          <NotFound />
        </MainLayout>
      )} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartProvider>
            <Router />
            <Toaster />
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
