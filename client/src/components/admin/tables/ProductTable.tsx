import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  PencilIcon, 
  Trash2, 
  MoreHorizontal, 
  Star, 
  Flame, 
  Eye, 
  Copy, 
  ArrowUp, 
  ArrowDown, 
  Loader2 
} from "lucide-react";

// Define Product and Category interfaces
interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  categoryId?: number;
  images: string[];
  sizes: string[];
  colors: string[];
  stock: number;
  featured: boolean;
  trending: boolean;
  createdAt?: Date;
}

interface Category {
  id: number;
  name: string;
  image: string | null;
  description: string | null;
  featured: boolean | null;
}

interface ProductTableProps {
  products: Product[];
  categories: Category[];
}

const ProductTable = ({ products, categories }: ProductTableProps) => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  
  const getCategoryName = (categoryId: number | null | undefined) => {
    if (!categoryId) return "Uncategorized";
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : "Unknown";
  };
  
  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    
    setIsDeletingId(productToDelete.id);
    
    try {
      await apiRequest("DELETE", `/api/products/${productToDelete.id}`);
      
      // Invalidate query to refresh product list
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      
      toast({
        title: "Product Deleted",
        description: `"${productToDelete.name}" has been deleted successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete product",
        variant: "destructive",
      });
    } finally {
      setIsDeletingId(null);
      setProductToDelete(null);
    }
  };
  
  const handleToggleFeature = async (product: Product, feature: 'featured' | 'trending') => {
    try {
      await apiRequest("PUT", `/api/products/${product.id}`, {
        ...product,
        [feature]: !product[feature],
      });
      
      // Invalidate query to refresh product list
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      
      toast({
        title: "Product Updated",
        description: `"${product.name}" has been ${product[feature] ? 'removed from' : 'added to'} ${feature} products`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update product",
        variant: "destructive",
      });
    }
  };
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[250px]">Product</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Stock</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                {product.images && product.images.length > 0 ? (
                  <img 
                    src={product.images[0]} 
                    alt={product.name} 
                    className="h-12 w-12 rounded object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center text-gray-400">
                    No img
                  </div>
                )}
                <div>
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-muted-foreground">
                    ID: {product.id}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline">
                {getCategoryName(product.categoryId)}
              </Badge>
            </TableCell>
            <TableCell>
              {product.discountPrice ? (
                <div>
                  <span className="font-medium">${product.discountPrice.toFixed(2)}</span>
                  <span className="text-sm text-muted-foreground line-through ml-2">
                    ${product.price.toFixed(2)}
                  </span>
                </div>
              ) : (
                <span className="font-medium">${product.price.toFixed(2)}</span>
              )}
            </TableCell>
            <TableCell>
              <span className={`${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {product.stock} in stock
              </span>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {product.featured && (
                  <Badge className="bg-gold text-white">
                    <Star className="h-3 w-3 mr-1" /> Featured
                  </Badge>
                )}
                {product.trending && (
                  <Badge className="bg-pink-light text-purple">
                    <Flame className="h-3 w-3 mr-1" /> Trending
                  </Badge>
                )}
                {product.stock === 0 && (
                  <Badge variant="destructive">
                    Out of Stock
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => navigate(`/product/${product.id}`)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Product
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/admin/products/edit/${product.id}`)}>
                    <PencilIcon className="mr-2 h-4 w-4" />
                    Edit Product
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleToggleFeature(product, 'featured')}>
                    <Star className="mr-2 h-4 w-4" />
                    {product.featured ? 'Remove from Featured' : 'Mark as Featured'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggleFeature(product, 'trending')}>
                    <Flame className="mr-2 h-4 w-4" />
                    {product.trending ? 'Remove from Trending' : 'Mark as Trending'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => setProductToDelete(product)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Product
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDeleteProduct}
              disabled={isDeletingId === productToDelete?.id}
            >
              {isDeletingId === productToDelete?.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Table>
  );
};

export default ProductTable;
