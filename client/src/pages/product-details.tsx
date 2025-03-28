import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import ProductImages from "@/components/product/ProductImages";
import ProductInfo from "@/components/product/ProductInfo";
import ReviewsSection from "@/components/product/ReviewsSection";
import { Product } from "@shared/schema";
import { Separator } from "@/components/ui/separator";
import ProductCard from "@/components/common/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface ProductDetailsProps {
  id: number;
}

const ProductDetails = ({ id }: ProductDetailsProps) => {
  const [, setLocation] = useLocation();
  
  // Validate product ID
  const isValidId = !isNaN(id) && id > 0;
  
  // Fetch product details only if ID is valid
  const { data: product, isLoading: isLoadingProduct, error } = useQuery<Product>({
    queryKey: [`/api/products/${id}`],
    enabled: isValidId,
  });

  // Fetch product reviews
  const { data: reviews, isLoading: isLoadingReviews } = useQuery({
    queryKey: [`/api/reviews/product/${id}`],
    enabled: !!product,
  });

  // Fetch related products
  const { data: relatedProducts, isLoading: isLoadingRelated } = useQuery<Product[]>({
    queryKey: ["/api/products", { category: product?.categoryId }],
    enabled: !!product?.categoryId,
  });

  // Fetch category
  const { data: category } = useQuery({
    queryKey: [`/api/categories/${product?.categoryId}`],
    enabled: !!product?.categoryId,
  });

  // Redirect if product not found or ID is invalid
  useEffect(() => {
    if (!isValidId || error) {
      // Redirect after a short delay to allow the user to see the error
      const timeout = setTimeout(() => {
        setLocation("/shop");
      }, 2000);
      
      return () => clearTimeout(timeout);
    }
  }, [error, setLocation, isValidId]);

  return (
    <div className="container mx-auto px-4 py-8">
      {!isValidId ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Invalid Product</AlertTitle>
          <AlertDescription>
            The product ID is invalid. You will be redirected to the shop page.
          </AlertDescription>
        </Alert>
      ) : error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Product Not Found</AlertTitle>
          <AlertDescription>
            Sorry, we couldn't find the product you're looking for. You will be redirected to the shop page.
          </AlertDescription>
        </Alert>
      ) : isLoadingProduct ? (
        <div className="flex flex-col md:flex-row gap-8">
          <div className="md:w-1/2">
            <Skeleton className="h-[500px] w-full rounded-lg" />
          </div>
          <div className="md:w-1/2">
            <Skeleton className="h-8 w-3/4 mb-4" />
            <Skeleton className="h-6 w-1/4 mb-2" />
            <Skeleton className="h-4 w-full mb-6" />
            <Skeleton className="h-10 w-1/3 mb-4" />
            <Skeleton className="h-6 w-full mb-2" />
            <Skeleton className="h-6 w-full mb-2" />
            <Skeleton className="h-6 w-full mb-4" />
            <Skeleton className="h-12 w-full mb-4" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      ) : product ? (
        <>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="md:w-1/2">
              <ProductImages images={product.images as string[]} />
            </div>
            <div className="md:w-1/2">
              <ProductInfo 
                product={product} 
                category={category}
              />
            </div>
          </div>

          <Separator className="my-12" />

          <ReviewsSection 
            productId={id} 
            reviews={reviews || []} 
            isLoading={isLoadingReviews} 
          />

          <Separator className="my-12" />

          <div className="mt-12">
            <h2 className="text-2xl font-playfair font-bold mb-6">You Might Also Like</h2>
            
            {isLoadingRelated ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex flex-col space-y-3">
                    <Skeleton className="h-[300px] w-full rounded-lg" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {relatedProducts
                  ?.filter(p => p.id !== product.id)
                  .slice(0, 4)
                  .map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default ProductDetails;
