import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Category, Product } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/common/ProductCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface CategoriesProps {
  id?: number;
}

const Categories = ({ id }: CategoriesProps) => {
  const [, setLocation] = useLocation();
  
  const { data: categories, isLoading: isLoadingCategories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });
  
  const { data: activeCategory } = useQuery<Category>({
    queryKey: [`/api/categories/${id}`],
    enabled: !!id,
  });
  
  const { data: products, isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/products", { category: id }],
    enabled: !!id,
  });
  
  // If category ID is provided, show products in that category
  if (id) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          className="mb-4"
          onClick={() => setLocation("/categories")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          All Categories
        </Button>
        
        <div className="mb-8">
          <h1 className="text-3xl font-playfair font-bold mb-2">
            {activeCategory ? activeCategory.name : "Loading..."}
          </h1>
          <p className="text-gray-600">{activeCategory?.description}</p>
        </div>
        
        {isLoadingProducts ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex flex-col space-y-3">
                <Skeleton className="h-[300px] w-full rounded-lg" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No products found in this category</p>
            <Button 
              variant="outline"
              onClick={() => setLocation("/shop")}
            >
              Browse All Products
            </Button>
          </div>
        )}
      </div>
    );
  }
  
  // Otherwise, show list of all categories
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-playfair font-bold mb-8">Browse Categories</h1>
      
      {isLoadingCategories ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-80 w-full rounded-lg" />
          ))}
        </div>
      ) : categories && categories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {categories.map(category => (
            <Card 
              key={category.id}
              className="group cursor-pointer overflow-hidden"
              onClick={() => setLocation(`/categories/${category.id}`)}
            >
              <div className="relative h-80">
                <img 
                  src={category.image} 
                  alt={category.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-purple/70 to-transparent opacity-80"></div>
                <div className="absolute bottom-0 left-0 w-full p-4">
                  <h3 className="text-white font-playfair text-xl font-semibold">{category.name}</h3>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">No categories found</p>
        </div>
      )}
    </div>
  );
};

export default Categories;
