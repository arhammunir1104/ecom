import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Menu, Search, ShoppingBag, Heart, User, Phone, Mail, X } from "lucide-react";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, isAuthenticated, logout, isAdmin } = useAuth();
  const { getCartCount } = useCart();
  const [, navigate] = useLocation();

  // Track scrolling to add shadow to navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery)}`);
      setIsMobileSearchOpen(false);
    }
  };

  return (
    <header className={`sticky top-0 z-50 bg-white transition-shadow ${isScrolled ? 'shadow-sm' : ''}`}>
      <div className="container mx-auto px-4">
        {/* Top bar with contact info and shipping */}
        <div className="hidden md:flex justify-between py-2 text-xs border-b border-gray-100">
          <div className="flex items-center space-x-6">
            <span className="flex items-center">
              <Phone className="w-3 h-3 text-purple mr-1.5" />
              +1 (800) 555-1234
            </span>
            <span className="flex items-center">
              <Mail className="w-3 h-3 text-purple mr-1.5" />
              support@softgirlfashion.com
            </span>
          </div>
          <div className="flex items-center">
            <a href="#" className="hover:text-purple transition">Free shipping on orders over $99</a>
          </div>
        </div>
        
        {/* Main navigation */}
        <nav className="flex justify-between items-center py-4">
          {/* Mobile menu button */}
          <div className="flex items-center">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden mr-2">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[350px]">
                <div className="flex flex-col h-full">
                  <div className="py-4 border-b">
                    <Link href="/" className="font-playfair text-2xl font-bold tracking-wider text-purple">
                      Soft<span className="text-pink-light">Girl</span>Fashion
                    </Link>
                  </div>
                  <nav className="flex-1 py-4">
                    <ul className="space-y-2">
                      <li>
                        <SheetClose asChild>
                          <Link href="/" className="flex py-2 px-4 hover:bg-pink-lighter rounded-md transition-colors">
                            Home
                          </Link>
                        </SheetClose>
                      </li>
                      <li>
                        <SheetClose asChild>
                          <Link href="/shop" className="flex py-2 px-4 hover:bg-pink-lighter rounded-md transition-colors">
                            Shop
                          </Link>
                        </SheetClose>
                      </li>
                      <li>
                        <SheetClose asChild>
                          <Link href="/categories" className="flex py-2 px-4 hover:bg-pink-lighter rounded-md transition-colors">
                            Collections
                          </Link>
                        </SheetClose>
                      </li>
                      <li className="border-t my-2 pt-2">
                        {isAuthenticated ? (
                          <>
                            <SheetClose asChild>
                              <Link href="/profile" className="flex py-2 px-4 hover:bg-pink-lighter rounded-md transition-colors">
                                <User className="mr-2 h-5 w-5" />
                                My Account
                              </Link>
                            </SheetClose>
                            <SheetClose asChild>
                              <Link href="/orders" className="flex py-2 px-4 hover:bg-pink-lighter rounded-md transition-colors">
                                Orders
                              </Link>
                            </SheetClose>
                            {isAdmin && (
                              <SheetClose asChild>
                                <Link href="/admin" className="flex py-2 px-4 hover:bg-pink-lighter rounded-md transition-colors">
                                  Admin Dashboard
                                </Link>
                              </SheetClose>
                            )}
                            <button 
                              onClick={() => logout()}
                              className="w-full text-left py-2 px-4 hover:bg-pink-lighter rounded-md transition-colors"
                            >
                              Logout
                            </button>
                          </>
                        ) : (
                          <>
                            <SheetClose asChild>
                              <Link href="/login" className="flex py-2 px-4 hover:bg-pink-lighter rounded-md transition-colors">
                                Login
                              </Link>
                            </SheetClose>
                            <SheetClose asChild>
                              <Link href="/signup" className="flex py-2 px-4 hover:bg-pink-lighter rounded-md transition-colors">
                                Sign Up
                              </Link>
                            </SheetClose>
                          </>
                        )}
                      </li>
                    </ul>
                  </nav>
                  <div className="py-4 border-t">
                    <div className="flex items-center space-x-4 px-4">
                      <a href="#" className="text-gray-600 hover:text-purple transition">
                        <i className="fab fa-facebook-f"></i>
                      </a>
                      <a href="#" className="text-gray-600 hover:text-purple transition">
                        <i className="fab fa-instagram"></i>
                      </a>
                      <a href="#" className="text-gray-600 hover:text-purple transition">
                        <i className="fab fa-pinterest-p"></i>
                      </a>
                      <a href="#" className="text-gray-600 hover:text-purple transition">
                        <i className="fab fa-tiktok"></i>
                      </a>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            
            {/* Logo */}
            <Link href="/" className="font-playfair text-2xl md:text-3xl font-bold tracking-wider text-purple">
              Soft<span className="text-pink-light">Girl</span>Fashion
            </Link>
          </div>
          
          {/* Desktop navigation links - positioned as a fixed layout with proper spacing */}
          <div className="hidden md:flex items-center gap-8 absolute left-1/2 transform -translate-x-1/2">
            <Link href="/" className="font-medium hover:text-purple transition">Home</Link>
            <Link href="/shop" className="font-medium hover:text-purple transition">Shop</Link>
            <Link href="/categories" className="font-medium hover:text-purple transition">Collections</Link>
            <Link href="/shop?trending=true" className="font-medium hover:text-purple transition">New Arrivals</Link>
            <Link href="/shop?sale=true" className="font-medium hover:text-purple transition">Sale</Link>
          </div>
          
          {/* Icons */}
          <div className="flex items-center space-x-4">
            {isMobileSearchOpen ? (
              <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg p-4 w-full max-w-md">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Search</h3>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setIsMobileSearchOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <Input
                      type="search"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-grow"
                    />
                    <Button type="submit">Search</Button>
                  </form>
                </div>
              </div>
            ) : (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsMobileSearchOpen(true)}
                className="hover:text-purple transition sm:block"
              >
                <Search className="h-5 w-5" />
                <span className="sr-only">Search</span>
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:text-purple transition">
                  <User className="h-5 w-5" />
                  <span className="sr-only">User menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {isAuthenticated ? (
                  <>
                    <DropdownMenuLabel>
                      {user?.fullName || user?.username}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile">My Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/orders">My Orders</Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin">Admin Dashboard</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => logout()}>
                      Logout
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/login">Login</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/signup">Sign Up</Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button variant="ghost" size="icon" className="hover:text-purple transition">
              <Heart className="h-5 w-5" />
              <span className="sr-only">Wishlist</span>
            </Button>
            
            <Link href="/cart">
              <Button variant="ghost" size="icon" className="hover:text-purple transition relative">
                <ShoppingBag className="h-5 w-5" />
                <span className="sr-only">Cart</span>
                {getCartCount() > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-purple text-white rounded-full w-5 h-5 flex items-center justify-center p-0 text-xs">
                    {getCartCount()}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
