import { useWishlist } from "@/context/WishlistContext";
import { Product } from "@shared/schema";
import ProductCard from "@/components/common/ProductCard";
import { useToast } from "@/hooks/use-toast";
import { HeartOff, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ProductSkeleton } from "@/components/shop/ProductSkeleton";

export default function WishlistPage() {
  const { wishlist, isLoading, removeFromWishlist } = useWishlist();
  const { toast } = useToast();

  const handleRemoveItem = (product: Product) => {
    removeFromWishlist(product.id);
    toast({
      title: "Item Removed",
      description: `${product.name} has been removed from your wishlist`
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Wishlist</h1>
        <Link href="/shop">
          <Button variant="outline" className="flex items-center gap-2">
            Continue Shopping <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      
      <Separator className="mb-8" />
      
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <ProductSkeleton key={index} />
          ))}
        </div>
      ) : wishlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <HeartOff className="h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Your Wishlist is Empty</h2>
          <p className="text-gray-500 mb-6 max-w-md">
            Items you save to your wishlist will appear here. Start browsing and add your favorite items!
          </p>
          <Link href="/shop">
            <Button className="bg-purple hover:bg-purple-dark">
              Explore Products
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {wishlist.map((product) => (
            <div key={product.id} className="relative group">
              <ProductCard 
                id={product.id}
                name={product.name}
                price={product.price}
                discountPrice={product.discountPrice}
                imageUrl={product.images?.[0] || ''}
                trending={product.trending}
                featured={product.featured}
              />
              <Button
                className="absolute top-3 right-3 bg-white text-red-500 hover:bg-red-50 shadow-sm"
                size="icon"
                variant="outline"
                onClick={() => handleRemoveItem(product)}
              >
                <HeartOff className="h-4 w-4" />
                <span className="sr-only">Remove from wishlist</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}