import { createContext, useState, useEffect, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";

// Type definitions
export interface CartItem {
  productId: number;
  quantity: number;
}

interface CartContextType {
  cart: Record<number, number>; // productId -> quantity
  addToCart: (productId: number, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
}

// Create context
export const CartContext = createContext<CartContextType>({
  cart: {},
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  getCartTotal: () => 0,
  getCartCount: () => 0,
});

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider = ({ children }: CartProviderProps) => {
  const [cart, setCart] = useState<Record<number, number>>({});
  const { toast } = useToast();

  // Load cart from localStorage on initial render
  useEffect(() => {
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error("Error parsing cart from localStorage:", e);
        localStorage.removeItem("cart");
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = (productId: number, quantity = 1) => {
    setCart(prevCart => {
      const newCart = { ...prevCart };
      newCart[productId] = (newCart[productId] || 0) + quantity;
      return newCart;
    });

    toast({
      title: "Added to Cart",
      description: `Item added to your shopping cart.`,
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prevCart => {
      const newCart = { ...prevCart };
      delete newCart[productId];
      return newCart;
    });

    toast({
      title: "Removed from Cart",
      description: "Item removed from your shopping cart.",
    });
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prevCart => ({
      ...prevCart,
      [productId]: quantity,
    }));
  };

  const clearCart = () => {
    setCart({});
    toast({
      title: "Cart Cleared",
      description: "All items have been removed from your cart.",
    });
  };

  const getCartCount = () => {
    return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  };

  const getCartTotal = () => {
    // This is a placeholder since we need product data to calculate the total
    // The actual calculation would happen in the cart component with product data
    return 0;
  };

  const value = {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartCount,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
