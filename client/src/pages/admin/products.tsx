import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import ProductTable from "@/components/admin/tables/ProductTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Loader2, PlusCircle, Search } from "lucide-react";

export default function AdminProducts() {
  const { isAdmin, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  // Redirect if not admin
  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, isAuthenticated, navigate]);
  
  // Fetch products
  const { data: products, isLoading } = useQuery({
    queryKey: ["/api/products"],
    enabled: isAdmin && isAuthenticated,
  });
  
  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
    enabled: isAdmin && isAuthenticated,
  });
  
  // Filter and paginate products
  const filteredProducts = products?.filter(product => {
    let match = true;
    
    if (searchQuery) {
      match = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              product.description.toLowerCase().includes(searchQuery.toLowerCase());
    }
    
    if (match && categoryFilter && categoryFilter !== 'all') {
      match = product.categoryId === parseInt(categoryFilter);
    }
    
    if (match && statusFilter && statusFilter !== 'all') {
      if (statusFilter === "in-stock") {
        match = product.stock > 0;
      } else if (statusFilter === "out-of-stock") {
        match = product.stock === 0;
      } else if (statusFilter === "featured") {
        match = product.featured;
      } else if (statusFilter === "trending") {
        match = product.trending;
      }
    }
    
    return match;
  }) || [];
  
  // Items per page
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to first page on new search
  };
  
  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setPage(1);
  };
  
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };
  
  const handleClearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setPage(1);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-playfair font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground">
            Manage your product inventory
          </p>
        </div>
        <Button 
          onClick={() => navigate("/admin/products/add")} 
          className="bg-purple text-white"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>
      
      <div className="rounded-md border">
        <div className="flex flex-col md:flex-row gap-4 p-4 items-end">
          <div className="flex-1">
            <form onSubmit={handleSearch} className="flex w-full max-w-sm space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="submit">Search</Button>
            </form>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-[180px]">
              <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map(category => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-[180px]">
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="in-stock">In Stock</SelectItem>
                  <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="trending">Trending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-purple" />
          </div>
        ) : (
          <>
            <ProductTable
              products={paginatedProducts}
              categories={categories || []}
            />
            
            {totalPages > 1 && (
              <div className="p-4 border-t">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                        disabled={page === 1}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <PaginationItem key={i}>
                        <PaginationLink
                          isActive={page === i + 1}
                          onClick={() => setPage(i + 1)}
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={page === totalPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
