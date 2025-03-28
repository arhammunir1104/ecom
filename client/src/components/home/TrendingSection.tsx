import { Link } from "wouter";
import { Product } from "@shared/schema";
import ProductCard from "@/components/common/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";

interface TrendingSectionProps {
  products: Product[];
  isLoading: boolean;
}

const TrendingSection = ({ products, isLoading }: TrendingSectionProps) => {
  if (isLoading) {
    return (
      <section className="py-16 bg-beige-light">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-12">
            <Skeleton className="h-8 w-60" />
            <Skeleton className="h-6 w-24" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="bg-white rounded-lg overflow-hidden shadow-sm">
                <Skeleton className="h-96 w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-32" />
                  <div className="flex items-center justify-between pt-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // If no products are available, don't render the section
  if (!products || products.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-beige-light">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-12">
          <h2 className="font-playfair text-3xl font-bold">Trending Now</h2>
          <Link 
            href="/shop?trending=true" 
            className="text-purple hover:underline flex items-center transition-colors"
          >
            View All <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {products.slice(0, 3).map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrendingSection;
