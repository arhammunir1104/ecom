import { createContext, useState, useEffect, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  getUserCart, 
  addToCart as addToFirestoreCart, 
  removeFromCart as removeFromFirestoreCart, 
  updateCartItemQuantity, 
  clearCart as clearFirestoreCart,
  CartItem as FirestoreCartItem
} from "@/lib/firebaseService";

// Type definitions
export interface CartItem {
  productId: number;
  quantity: number;
  name: string;
  price: number;
  image?: string;
}

interface CartContextType {
  cart: Record<string, CartItem>; // productId (string) -> CartItem
  addToCart: (product: { id: number; name: string; price: number; image?: string }, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
  isLoading: boolean;
}

// Create context with default values
export const CartContext = createContext<CartContextType>({
  cart: {},
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  getCartTotal: () => 0,
  getCartCount: () => 0,
  isLoading: false
});

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider = ({ children }: CartProviderProps) => {
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [userFirebaseId, setUserFirebaseId] = useState<string | null>(null);

  // Check if user is authenticated on initial load
  useEffect(() => {
    const storedUid = localStorage.getItem("firebaseUid");
    if (storedUid) {
      setUserFirebaseId(storedUid);
    }
    
    // Listen for changes to firebaseUid in localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "firebaseUid" && e.newValue !== userFirebaseId) {
        if (e.newValue) {
          // User logged in, load their cart
          setUserFirebaseId(e.newValue);
        } else {
          // User logged out, reset to local storage cart
          setUserFirebaseId(null);
          loadLocalCart();
        }
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Load cart from localStorage or Firestore on initial render
  useEffect(() => {
    setIsLoading(true);
    if (userFirebaseId) {
      // User is authenticated, load from Firestore
      loadFirestoreCart(userFirebaseId).finally(() => setIsLoading(false));
    } else {
      // User is not authenticated, load from localStorage
      loadLocalCart();
      setIsLoading(false);
    }
  }, [userFirebaseId]);

  // Load cart from localStorage
  const loadLocalCart = () => {
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        setCart(parsedCart);
      } catch (e) {
        console.error("Error parsing cart from localStorage:", e);
        localStorage.removeItem("cart");
        setCart({});
      }
    } else {
      setCart({});
    }
  };

  // Load cart from Firestore
  const loadFirestoreCart = async (uid: string) => {
    try {
      const firestoreCart = await getUserCart(uid);
      
      if (firestoreCart && firestoreCart.items) {
        console.log("Loaded cart from Firestore:", firestoreCart.items);
        setCart(firestoreCart.items);
      } else {
        // No cart exists in Firestore yet, use the local cart
        loadLocalCart();
      }
    } catch (error) {
      console.error("Error loading cart from Firestore:", error);
      // Fall back to local cart
      loadLocalCart();
    }
  };

  // Save cart to localStorage as backup
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem("cart", JSON.stringify(cart));
    }
  }, [cart, isLoading]);

  const addToCart = async (
    product: { id: number; name: string; price: number; image?: string },
    quantity = 1
  ) => {
    const productId = product.id.toString();
    
    try {
      // Update local state immediately for better UX
      setCart(prevCart => {
        const newCart = { ...prevCart };
        
        if (newCart[productId]) {
          // Update existing item
          newCart[productId] = {
            ...newCart[productId],
            quantity: newCart[productId].quantity + quantity
          };
        } else {
          // Add new item
          newCart[productId] = {
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity,
            image: product.image
          };
        }
        
        return newCart;
      });

      // Update Firestore if user is authenticated
      if (userFirebaseId) {
        await addToFirestoreCart(userFirebaseId, product, quantity);
      }

      toast({
        title: "Added to Cart",
        description: `${product.name} added to your shopping cart.`,
      });
    } catch (error) {
      console.error("Error adding to cart:", error);
      toast({
        title: "Error",
        description: "Failed to add item to cart. Please try again.",
        variant: "destructive"
      });
    }
  };

  const removeFromCart = async (productId: number) => {
    const productIdStr = productId.toString();
    
    try {
      // Update local state immediately for better UX
      setCart(prevCart => {
        const newCart = { ...prevCart };
        delete newCart[productIdStr];
        return newCart;
      });

      // Update Firestore if user is authenticated
      if (userFirebaseId) {
        await removeFromFirestoreCart(userFirebaseId, productId);
      }

      toast({
        title: "Removed from Cart",
        description: "Item removed from your shopping cart.",
      });
    } catch (error) {
      console.error("Error removing from cart:", error);
      toast({
        title: "Error",
        description: "Failed to remove item from cart. Please try again.",
        variant: "destructive"
      });
    }
  };

  const updateQuantity = async (productId: number, quantity: number) => {
    const productIdStr = productId.toString();
    
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    try {
      // Update local state immediately for better UX
      setCart(prevCart => {
        const newCart = { ...prevCart };
        
        if (newCart[productIdStr]) {
          newCart[productIdStr] = {
            ...newCart[productIdStr],
            quantity
          };
        }
        
        return newCart;
      });

      // Update Firestore if user is authenticated
      if (userFirebaseId) {
        await updateCartItemQuantity(userFirebaseId, productId, quantity);
      }
    } catch (error) {
      console.error("Error updating cart quantity:", error);
      toast({
        title: "Error",
        description: "Failed to update quantity. Please try again.",
        variant: "destructive"
      });
    }
  };

  const clearCart = async () => {
    try {
      // Clear local state
      setCart({});
      
      // Clear Firestore cart if user is authenticated
      if (userFirebaseId) {
        await clearFirestoreCart(userFirebaseId);
      }
      
      toast({
        title: "Cart Cleared",
        description: "All items have been removed from your cart.",
      });
    } catch (error) {
      console.error("Error clearing cart:", error);
      toast({
        title: "Error",
        description: "Failed to clear cart. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getCartCount = () => {
    return Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  };

  const getCartTotal = () => {
    return Object.values(cart).reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const value = {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartCount,
    isLoading
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
