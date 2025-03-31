import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Product } from "@shared/schema";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingBag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { 
  addToWishlist, 
  isInWishlist 
} from "@/lib/firebaseService";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isInWishlistState, setIsInWishlistState] = useState(false);
  const [isAddingToWishlist, setIsAddingToWishlist] = useState(false);
  const { addToCart } = useCart();
  const { toast } = useToast();
  
  const { 
    id, 
    name, 
    price, 
    discountPrice, 
    images, 
    featured,
    trending,
    categoryId,
  } = product;
  
  const imageUrl = Array.isArray(images) && images.length > 0 
    ? images[0] 
    : "https://via.placeholder.com/300x400?text=No+Image";

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Pass the full product object with required fields
    addToCart({
      id,
      name,
      price,
      image: imageUrl
    });
    
    toast({
      title: "Added to cart",
      description: `${name} has been added to your cart`,
    });
  };
  
  const [, setLocation] = useLocation();
  
  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Navigate to product page using wouter
    setLocation(`/product/${id}`);
  };
  
  const handleAddToWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      setIsAddingToWishlist(true);
      
      // Get user ID from localStorage (set during authentication)
      const uid = window.localStorage.getItem('firebaseUid');
      
      if (!uid) {
        toast({
          title: "Authentication required",
          description: "Please sign in to add items to your wishlist",
          variant: "destructive"
        });
        return;
      }
      
      // Check if already in wishlist to prevent duplicates
      if (isInWishlistState) {
        toast({
          title: "Already in wishlist",
          description: `${name} is already in your wishlist`,
        });
        return;
      }
      
      // Add to Firebase wishlist
      await addToWishlist(uid, {
        id: id,
        name: name,
        price: price,
        image: imageUrl
      });
      
      // Also add to API wishlist for backend persistence
      try {
        await fetch('/api/users/wishlist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'firebase-uid': uid
          },
          body: JSON.stringify({ productId: id })
        });
      } catch (apiError) {
        console.error('Error syncing with API wishlist:', apiError);
      }
      
      setIsInWishlistState(true);
      
      toast({
        title: "Added to wishlist",
        description: `${name} has been added to your wishlist`,
      });
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      toast({
        title: "Error",
        description: "Failed to add item to wishlist. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAddingToWishlist(false);
    }
  };
  
  // Check if product is in wishlist on component mount
  useEffect(() => {
    const checkWishlistStatus = async () => {
      try {
        const uid = window.localStorage.getItem('firebaseUid');
        if (uid) {
          const inWishlist = await isInWishlist(uid, id);
          setIsInWishlistState(inWishlist);
        }
      } catch (error) {
        console.error('Error checking wishlist status:', error);
      }
    };
    
    checkWishlistStatus();
  }, [id]);

  return (
    <Card 
      className="product-card bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/product/${id}`} className="block">
        <div className="relative">
          <img 
            src={imageUrl} 
            alt={name} 
            className="w-full h-60 sm:h-64 md:h-72 lg:h-80 object-cover"
            loading="lazy"
          />
          
          {/* Product badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {trending && (
              <Badge className="bg-purple text-white">
                Trending
              </Badge>
            )}
            {featured && !trending && (
              <Badge className="bg-pink-light text-purple">
                New
              </Badge>
            )}
            {discountPrice && (
              <Badge className="bg-gold text-white">
                Sale
              </Badge>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button 
              size="icon" 
              variant="secondary" 
              className={`w-8 h-8 rounded-full ${isInWishlistState ? 'bg-pink-light' : 'bg-white/90'} hover:bg-pink-light shadow-md`}
              onClick={handleAddToWishlist}
              disabled={isAddingToWishlist}
            >
              <Heart className={`h-4 w-4 ${isInWishlistState ? 'text-red-500 fill-current' : 'text-purple'}`} />
              <span className="sr-only">
                {isInWishlistState ? "Remove from wishlist" : "Add to wishlist"}
              </span>
            </Button>
          </div>
          
          {/* Quick shop button */}
          <div className={`absolute bottom-3 inset-x-3 transition-opacity duration-200 ${isHovered ? "opacity-100" : "opacity-0"}`}>
            <Button 
              className="w-full bg-purple/90 hover:bg-purple text-white shadow-md font-medium"
              onClick={handleAddToCart}
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              Add to Cart
            </Button>
          </div>
        </div>
        <CardContent className="p-4">
          {/* Category */}
          <div className="text-sm text-gray-500 mb-1">
            {/* This would normally show the category name, 
                but we only have the ID in this component */}
            {categoryId === 1 ? "Dresses" : 
             categoryId === 2 ? "Tops" : 
             categoryId === 3 ? "Bottoms" : 
             categoryId === 4 ? "Accessories" : "Fashion"}
          </div>
          
          {/* Product name */}
          <h3 className="font-medium text-lg mb-1 text-gray-800 line-clamp-1">{name}</h3>
          
          {/* Ratings */}
          <div className="flex items-center mb-2">
            <div className="flex text-gold">
              <i className="fas fa-star text-xs"></i>
              <i className="fas fa-star text-xs"></i>
              <i className="fas fa-star text-xs"></i>
              <i className="fas fa-star text-xs"></i>
              <i className="fas fa-star-half-alt text-xs"></i>
            </div>
            <span className="text-xs text-gray-500 ml-2">(0)</span>
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0 flex items-center justify-between">
          {/* Price */}
          <div>
            {discountPrice ? (
              <div className="flex items-center gap-2">
                <span className="text-purple font-semibold text-lg">
                  ${discountPrice.toFixed(2)}
                </span>
                <span className="text-gray-400 line-through text-sm">
                  ${price.toFixed(2)}
                </span>
              </div>
            ) : (
              <span className="text-purple font-semibold text-lg">
                ${price.toFixed(2)}
              </span>
            )}
          </div>
          
          {/* Add to cart icon button */}
          <Button 
            size="icon" 
            variant="secondary" 
            className="w-9 h-9 rounded-full bg-pink-lighter hover:bg-pink-light"
            onClick={handleAddToCart}
          >
            <ShoppingBag className="h-4 w-4 text-purple" />
            <span className="sr-only">Add to cart</span>
          </Button>
        </CardFooter>
      </Link>
    </Card>
  );
};

export default ProductCard;
