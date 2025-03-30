import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Product } from "@shared/schema";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

interface WishlistContextType {
  wishlist: Product[];
  isLoading: boolean;
  addToWishlist: (productId: number) => void;
  removeFromWishlist: (productId: number) => void;
  isInWishlist: (productId: number) => boolean;
}

export const WishlistContext = createContext<WishlistContextType>({
  wishlist: [],
  isLoading: false,
  addToWishlist: () => {},
  removeFromWishlist: () => {},
  isInWishlist: () => false,
});

interface WishlistProviderProps {
  children: ReactNode;
}

export const WishlistProvider = ({ children }: WishlistProviderProps) => {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  
  // Fetch wishlist from API if authenticated
  const { data: wishlist = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/wishlist"],
    queryFn: () => 
      isAuthenticated 
        ? apiRequest("GET", "/api/wishlist")
            .then((res) => res.json())
        : Promise.resolve([]),
    enabled: isAuthenticated,
  });
  
  // Add to wishlist mutation
  const addMutation = useMutation({
    mutationFn: (productId: number) => 
      apiRequest("POST", "/api/wishlist/add", { productId }),
    onSuccess: () => {
      toast({
        title: "Added to Wishlist",
        description: "The item has been added to your wishlist",
      });
      // Invalidate the wishlist query to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add to wishlist",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Remove from wishlist mutation
  const removeMutation = useMutation({
    mutationFn: (productId: number) => 
      apiRequest("DELETE", "/api/wishlist/remove", { productId }),
    onSuccess: () => {
      toast({
        title: "Removed from Wishlist",
        description: "The item has been removed from your wishlist",
      });
      // Invalidate the wishlist query to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove from wishlist",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Function to add a product to the wishlist
  const addToWishlist = (productId: number) => {
    if (!isAuthenticated) {
      toast({
        title: "Please login",
        description: "You need to be logged in to add items to your wishlist",
        variant: "destructive",
      });
      return;
    }
    
    addMutation.mutate(productId);
  };

  // Function to remove a product from the wishlist
  const removeFromWishlist = (productId: number) => {
    if (!isAuthenticated) return;
    
    removeMutation.mutate(productId);
  };

  // Function to check if a product is in the wishlist
  const isInWishlist = (productId: number) => {
    return wishlist.some((product) => product.id === productId);
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        isLoading,
        addToWishlist,
        removeFromWishlist,
        isInWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}