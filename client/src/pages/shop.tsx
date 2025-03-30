import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ProductCard from "@/components/common/ProductCard";
import FilterSidebar from "@/components/shop/FilterSidebar";
import { Product } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ChevronDown, Filter, Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const Shop = () => {
  const [location] = useLocation();
  const search = useSearch();
  const [searchParams, setSearchParams] = useState(new URLSearchParams(search));
  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const [showFilters, setShowFilters] = useState(false);
  
  const categoryId = searchParams.get("category") || undefined;
  const sortBy = searchParams.get("sort") || "newest";
  
  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
  });
  
  const { data: products, isLoading, refetch } = useQuery<Product[]>({
    queryKey: ["/api/products", { 
      category: categoryId, 
      search: searchParams.get("search") || undefined,
      trending: searchParams.get("trending") || undefined,
      featured: searchParams.get("featured") || undefined,
      sale: searchParams.get("sale") || undefined,
    }],
  });
  
  const { data: activeCategory } = useQuery({
    queryKey: ["/api/categories", Number(categoryId)],
    enabled: !!categoryId,
  });
  
  // Update URL when filters change
  useEffect(() => {
    const newSearch = searchParams.toString();
    const searchString = newSearch ? `?${newSearch}` : "";
    const newLocation = `${location.split("?")[0]}${searchString}`;
    window.history.replaceState(null, "", newLocation);
  }, [searchParams, location]);
  
  // Apply filters
  const handleFilterChange = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams.toString());
    
    if (value === null) {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    
    setSearchParams(newParams);
  };
  
  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange("search", searchValue || null);
  };
  
  // Sort products
  const sortedProducts = [...(products || [])].sort((a, b) => {
    switch (sortBy) {
      case "price-low":
        return a.price - b.price;
      case "price-high":
        return b.price - a.price;
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      default:
        return 0;
    }
  });
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-playfair font-bold">
              {activeCategory ? activeCategory.name : "All Products"}
            </h1>
            {products && (
              <p className="text-gray-600 mt-1">{products.length} products</p>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <form onSubmit={handleSearch} className="flex">
              <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Search products..."
                  className="pl-8 w-full md:w-64"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary" className="ml-1">
                Search
              </Button>
            </form>
            
            <div className="flex gap-2">
              <Select
                value={sortBy}
                onValueChange={(value) => handleFilterChange("sort", value)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
              
              <Sheet open={showFilters} onOpenChange={setShowFilters}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="md:hidden">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <div className="h-full py-4">
                    <FilterSidebar 
                      categories={categories || []}
                      activeCategory={Number(categoryId) || null}
                      setActiveCategory={(id) => {
                        handleFilterChange("category", id ? String(id) : null);
                        setShowFilters(false);
                      }}
                      onFilterChange={(key, value) => {
                        handleFilterChange(key, value);
                        if (key !== "category") setShowFilters(false);
                      }}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
        
        {searchParams.has("search") && (
          <div className="flex items-center">
            <span className="text-sm text-gray-500 mr-2">
              Search results for "{searchParams.get("search")}"
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-gray-500"
              onClick={() => {
                setSearchValue("");
                handleFilterChange("search", null);
              }}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        )}
        
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar for desktop */}
          <div className="hidden md:block w-64 flex-shrink-0">
            <FilterSidebar 
              categories={categories || []}
              activeCategory={Number(categoryId) || null}
              setActiveCategory={(id) => handleFilterChange("category", id ? String(id) : null)}
              onFilterChange={handleFilterChange}
            />
          </div>
          
          {/* Main content */}
          <div className="flex-1">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="flex flex-col space-y-3">
                    <Skeleton className="h-[300px] w-full rounded-lg" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ))}
              </div>
            ) : sortedProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {sortedProducts.map((product) => (
                  <ProductCard 
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    discountPrice={product.discountPrice}
                    imageUrl={Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : ""}
                    featured={product.featured}
                    trending={product.trending}
                    categoryId={product.categoryId}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-lg text-gray-500 mb-4">No products found</p>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setSearchParams(new URLSearchParams());
                    setSearchValue("");
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Shop;
