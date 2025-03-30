import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProductSkeleton() {
  return (
    <Card className="product-card bg-white rounded-lg overflow-hidden shadow-sm">
      <div className="relative">
        <Skeleton className="w-full h-80" />
        
        {/* Product badges placeholders */}
        <div className="absolute top-3 left-3">
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        
        {/* Action buttons placeholders */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      </div>
      
      <CardContent className="p-4">
        {/* Category placeholder */}
        <Skeleton className="h-4 w-20 mb-2" />
        
        {/* Product name placeholder */}
        <Skeleton className="h-6 w-3/4 mb-2" />
        
        {/* Ratings placeholder */}
        <Skeleton className="h-4 w-24 mb-2" />
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        {/* Price placeholder */}
        <Skeleton className="h-6 w-16" />
        
        {/* Add to cart icon button placeholder */}
        <Skeleton className="w-9 h-9 rounded-full" />
      </CardFooter>
    </Card>
  );
}