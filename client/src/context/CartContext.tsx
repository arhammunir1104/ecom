import { createContext, useState, useEffect, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { doc, getDoc, setDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
    if (userFirebaseId) {
      // User is authenticated, load from Firestore
      loadFirestoreCart(userFirebaseId);
    } else {
      // User is not authenticated, load from localStorage
      loadLocalCart();
    }
  }, [userFirebaseId]);

  // Load cart from localStorage
  const loadLocalCart = () => {
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error("Error parsing cart from localStorage:", e);
        localStorage.removeItem("cart");
      }
    }
  };

  // Load cart from Firestore
  const loadFirestoreCart = async (uid: string) => {
    try {
      const cartRef = doc(collection(db, "users", uid, "cart"), "current");
      const cartDoc = await getDoc(cartRef);
      
      if (cartDoc.exists()) {
        const cartData = cartDoc.data();
        console.log("Loaded cart from Firestore:", cartData);
        
        // Convert string keys back to numbers
        const convertedCart: Record<number, number> = {};
        Object.entries(cartData).forEach(([key, value]) => {
          convertedCart[Number(key)] = Number(value);
        });
        
        setCart(convertedCart);
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

  // Save cart to Firestore
  const saveCartToFirestore = async (uid: string, cartData: Record<number, number>) => {
    try {
      const cartRef = doc(collection(db, "users", uid, "cart"), "current");
      await setDoc(cartRef, cartData);
      console.log("Cart saved to Firestore successfully");
    } catch (error) {
      console.error("Error saving cart to Firestore:", error);
      // No action needed, user can still use local cart
    }
  };
  
  // Save cart to localStorage and Firestore when it changes
  useEffect(() => {
    // Always save to localStorage for guest users and as backup
    localStorage.setItem("cart", JSON.stringify(cart));
    
    // If user is authenticated, also save to Firestore
    if (userFirebaseId) {
      saveCartToFirestore(userFirebaseId, cart);
    }
  }, [cart, userFirebaseId]);

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
