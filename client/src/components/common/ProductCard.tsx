import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/context/WishlistContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, HeartOff, Search, ShoppingBag } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

interface ProductCardProps {
  id: number;
  name: string;
  price: number;
  discountPrice?: number | null;
  imageUrl: string;
  featured?: boolean | null;
  trending?: boolean | null;
  categoryId?: number | null;
}

const ProductCard = ({ 
  id, 
  name, 
  price, 
  discountPrice, 
  imageUrl, 
  featured, 
  trending,
  categoryId 
}: ProductCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const { addToCart } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  
  const inWishlist = isInWishlist(id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(id);
  };
  
  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (inWishlist) {
      removeFromWishlist(id);
    } else {
      addToWishlist(id);
    }
  };
  
  const [, setLocation] = useLocation();
  
  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Navigate to product page using wouter
    setLocation(`/product/${id}`);
  };

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
            className="w-full h-80 object-cover"
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
              className={`w-8 h-8 rounded-full ${inWishlist ? 'bg-pink-light text-red-500' : 'bg-white hover:bg-pink-lighter'}`}
              onClick={handleToggleWishlist}
            >
              {inWishlist ? (
                <HeartOff className="h-4 w-4" />
              ) : (
                <Heart className="h-4 w-4 text-purple" />
              )}
              <span className="sr-only">
                {inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
              </span>
            </Button>
            <Button 
              size="icon" 
              variant="secondary" 
              className="w-8 h-8 rounded-full bg-white hover:bg-pink-lighter"
              onClick={handleQuickView}
            >
              <Search className="h-4 w-4 text-purple" />
              <span className="sr-only">Quick view</span>
            </Button>
          </div>
          
          {/* Quick shop button */}
          <div className={`absolute bottom-3 inset-x-3 transition-opacity duration-200 ${isHovered ? "opacity-100" : "opacity-0"}`}>
            <Button 
              className="w-full bg-purple hover:bg-purple/90 text-white"
              onClick={handleAddToCart}
            >
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
          
          {/* Ratings - static for now */}
          <div className="flex items-center mb-2">
            <div className="flex text-gold">
              <i className="fas fa-star text-xs"></i>
              <i className="fas fa-star text-xs"></i>
              <i className="fas fa-star text-xs"></i>
              <i className="fas fa-star text-xs"></i>
              <i className="fas fa-star-half-alt text-xs"></i>
            </div>
            <span className="text-xs text-gray-500 ml-2">(24)</span>
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0 flex items-center justify-between">
          {/* Price */}
          <div>
            {discountPrice ? (
              <div className="flex items-center gap-2">
                <span className="text-purple font-semibold text-lg">
                  ${Number(discountPrice).toFixed(2)}
                </span>
                <span className="text-gray-400 line-through text-sm">
                  ${Number(price).toFixed(2)}
                </span>
              </div>
            ) : (
              <span className="text-purple font-semibold text-lg">
                ${Number(price).toFixed(2)}
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