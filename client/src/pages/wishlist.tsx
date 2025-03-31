import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  Card, 
  CardContent
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Heart, ShoppingBag, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/useCart";
import { useLocation } from "wouter";

// Firebase imports
import { 
  getFirestore,
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  deleteDoc,
  updateDoc,
  arrayRemove
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { apiRequest } from "@/lib/queryClient";

const Wishlist = () => {
  const { user, isAuthenticated } = useAuth();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingItemIds, setRemovingItemIds] = useState<Set<string>>(new Set());
  const [addingToCartIds, setAddingToCartIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchWishlistItems();
  }, [isAuthenticated, user]);

  // Function to fetch wishlist items from both Firebase and API
  const fetchWishlistItems = async () => {
    try {
      setIsLoading(true);
      const items: Array<any> = [];
      
      // If user is authenticated, try to fetch from Firebase first
      if (isAuthenticated) {
        const uid = window.localStorage.getItem('firebaseUid') || user?.uid;
        
        if (uid) {
          try {
            // Try to get wishlist items from Firebase
            const userRef = doc(db, 'users', uid);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists() && userDoc.data().wishlist && Array.isArray(userDoc.data().wishlist)) {
              const wishlistIds = userDoc.data().wishlist;
              
              // Fetch each product from the products collection
              for (const productId of wishlistIds) {
                try {
                  const productRef = doc(db, 'products', productId);
                  const productDoc = await getDoc(productRef);
                  
                  if (productDoc.exists()) {
                    items.push({
                      id: productDoc.id,
                      ...productDoc.data(),
                      source: 'firebase'
                    });
                  }
                } catch (err) {
                  console.error('Error fetching product:', err);
                }
              }
            }
          } catch (firebaseError) {
            console.error('Error fetching from Firebase:', firebaseError);
          }
        }
        
        // Also try to fetch from API for database-stored wishlist items
        try {
          const response = await apiRequest('GET', '/api/users/wishlist');
          
          if (response.ok) {
            const apiItems: Array<any> = await response.json();
            
            // Add only items that aren't already in the array
            const existingIds = items.map((item: any) => item.id);
            const newApiItems = apiItems.filter((item: any) => !existingIds.includes(item.id));
            
            items.push(...newApiItems.map((item: any) => ({
              ...item,
              source: 'api'
            })));
          }
        } catch (apiError) {
          console.error('Error fetching from API:', apiError);
        }
      }
      
      setWishlistItems(items);
    } catch (error) {
      console.error('Error fetching wishlist items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load wishlist items.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Remove from wishlist
  const removeFromWishlist = async (productId: string) => {
    try {
      setRemovingItemIds(prev => new Set(prev).add(productId));
      
      // If user is authenticated
      if (isAuthenticated) {
        const uid = window.localStorage.getItem('firebaseUid') || user?.uid;
        
        if (uid) {
          // Remove from Firebase
          try {
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
              wishlist: arrayRemove(productId)
            });
          } catch (err) {
            console.error('Error removing from Firebase wishlist:', err);
          }
          
          // Also try to remove from API
          try {
            await apiRequest('DELETE', `/api/users/wishlist/${productId}`);
          } catch (apiError) {
            console.error('Error removing from API wishlist:', apiError);
          }
        }
        
        // Update local state
        setWishlistItems(prev => prev.filter(item => item.id !== productId));
        
        toast({
          title: 'Removed from Wishlist',
          description: 'Item successfully removed from your wishlist.',
        });
      }
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove item from wishlist.',
        variant: 'destructive',
      });
    } finally {
      setRemovingItemIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  // Add to cart
  const handleAddToCart = async (product: any) => {
    try {
      setAddingToCartIds(prev => new Set(prev).add(product.id));
      
      // addToCart expects a product object with id, name, price, and optionally image
      // and a quantity (defaults to 1 if not provided)
      await addToCart(
        {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.images && Array.isArray(product.images) && product.images.length > 0 
            ? product.images[0] 
            : undefined
        }, 
        1 // quantity
      );
      
      toast({
        title: 'Added to Cart',
        description: 'Item successfully added to your cart.',
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast({
        title: 'Error',
        description: 'Failed to add item to cart.',
        variant: 'destructive',
      });
    } finally {
      setAddingToCartIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(product.id);
        return newSet;
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <h2 className="text-2xl font-playfair font-bold mb-2">Please Sign In</h2>
            <p className="text-gray-500 mb-6">You need to be signed in to view your wishlist.</p>
            <Button asChild>
              <a href="/login">Sign In</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-playfair font-bold mb-8">My Wishlist</h1>
      
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="overflow-hidden">
              <div className="h-64">
                <Skeleton className="h-full w-full" />
              </div>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-6" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : wishlistItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {wishlistItems.map((item) => (
            <Card key={item.id} className="overflow-hidden relative group">
              <div 
                className="absolute top-2 right-2 z-10 cursor-pointer bg-white/80 rounded-full p-1.5 shadow-md hover:bg-red-50 transition-colors"
                onClick={() => removeFromWishlist(item.id)}
              >
                {removingItemIds.has(item.id) ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
                ) : (
                  <X className="h-5 w-5 text-red-500" />
                )}
              </div>
              
              <div 
                className="relative h-64 overflow-hidden cursor-pointer"
                onClick={() => navigate(`/product/${item.id}`)}
              >
                {item.images && Array.isArray(item.images) && item.images.length > 0 ? (
                  <img 
                    src={item.images[0]} 
                    alt={item.name} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <p className="text-gray-400">No image</p>
                  </div>
                )}
                
                {item.discountPrice !== null && (
                  <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 text-xs font-bold rounded">
                    SALE
                  </div>
                )}
              </div>
              
              <CardContent className="p-4">
                <h3 
                  className="font-medium text-lg mb-1 cursor-pointer hover:text-purple-600 transition-colors"
                  onClick={() => navigate(`/product/${item.id}`)}
                >
                  {item.name}
                </h3>
                
                <div className="flex items-center mb-4">
                  {item.discountPrice !== null ? (
                    <>
                      <span className="font-bold text-purple-600">${Number(item.discountPrice).toFixed(2)}</span>
                      <span className="ml-2 text-gray-400 line-through text-sm">
                        ${Number(item.price).toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <span className="font-bold text-purple-600">${Number(item.price).toFixed(2)}</span>
                  )}
                </div>
                
                <Button 
                  className="w-full gap-2"
                  onClick={() => handleAddToCart(item)}
                  disabled={addingToCartIds.has(item.id)}
                >
                  {addingToCartIds.has(item.id) ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="h-4 w-4" />
                      Add to Cart
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-playfair font-medium mb-2">Your wishlist is empty</h2>
          <p className="text-gray-500 mb-6">Save items you love to your wishlist and revisit them anytime.</p>
          <Button asChild>
            <a href="/shop">Continue Shopping</a>
          </Button>
        </div>
      )}
    </div>
  );
};

export default Wishlist;