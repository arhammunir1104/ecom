import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertProductSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { uploadImage, uploadMultipleImages } from "@/lib/cloudinary";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  ImagePlus, 
  Loader2, 
  Trash2, 
  Plus, 
  X, 
  CheckCircle 
} from "lucide-react";

// Extended product schema with custom validations
const productSchema = insertProductSchema.extend({
  name: z.string().min(3, "Product name must be at least 3 characters"),
  price: z.number().positive("Price must be a positive number"),
  categoryId: z.number().positive("Please select a category"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function AdminAddProduct() {
  const { isAdmin, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [sizeOptions, setSizeOptions] = useState<string[]>([]);
  const [colorOptions, setColorOptions] = useState<string[]>([]);
  const [newSize, setNewSize] = useState("");
  const [newColor, setNewColor] = useState("");
  
  // Redirect if not admin
  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, isAuthenticated, navigate]);
  
  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["/api/categories"],
    enabled: isAdmin && isAuthenticated,
  });
  
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      discountPrice: undefined,
      categoryId: 0,
      images: [],
      sizes: [],
      colors: [],
      stock: 0,
      featured: false,
      trending: false,
    },
  });
  
  // Preview images
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setImageFiles(prev => [...prev, ...newFiles]);
      
      // Generate previews
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setImagePreviews(prev => [...prev, ...newPreviews]);
    }
  };
  
  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    
    // Revoke object URL to free memory
    URL.revokeObjectURL(imagePreviews[index]);
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };
  
  const addSize = () => {
    if (newSize && !sizeOptions.includes(newSize)) {
      setSizeOptions(prev => [...prev, newSize]);
      form.setValue("sizes", [...sizeOptions, newSize]);
      setNewSize("");
    }
  };
  
  const removeSize = (size: string) => {
    setSizeOptions(prev => prev.filter(s => s !== size));
    form.setValue("sizes", sizeOptions.filter(s => s !== size));
  };
  
  const addColor = () => {
    if (newColor && !colorOptions.includes(newColor)) {
      setColorOptions(prev => [...prev, newColor]);
      form.setValue("colors", [...colorOptions, newColor]);
      setNewColor("");
    }
  };
  
  const removeColor = (color: string) => {
    setColorOptions(prev => prev.filter(c => c !== color));
    form.setValue("colors", colorOptions.filter(c => c !== color));
  };
  
  async function onSubmit(data: ProductFormValues) {
    if (imageFiles.length === 0) {
      toast({
        title: "Missing Images",
        description: "Please upload at least one product image",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Generate data URLs for the images instead of uploading to Cloudinary
      const imageUrls = await Promise.all(
        imageFiles.map(file => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        })
      );
      
      // Create product with image URLs
      const productData = {
        ...data,
        images: imageUrls,
        sizes: sizeOptions,
        colors: colorOptions,
      };
      
      await apiRequest("POST", "/api/products", productData);
      
      // Invalidate products query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      
      toast({
        title: "Success",
        description: "Product created successfully",
      });
      
      // Navigate to products list
      navigate("/admin/products");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create product",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/admin/products")}
          className="mr-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Products
        </Button>
        <div>
          <h2 className="text-3xl font-playfair font-bold tracking-tight">Add New Product</h2>
          <p className="text-muted-foreground">
            Create a new product to add to your store
          </p>
        </div>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left column - Main info */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Product Information</CardTitle>
                <CardDescription>
                  Enter the basic details about your product
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter product name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter product description" 
                          className="min-h-[120px]" 
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5">$</span>
                            <Input 
                              type="number" 
                              step="0.01"
                              min="0"
                              placeholder="0.00" 
                              className="pl-7"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="discountPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount Price (Optional)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5">$</span>
                            <Input 
                              type="number" 
                              step="0.01"
                              min="0"
                              placeholder="0.00" 
                              className="pl-7"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => {
                                const value = e.target.value === "" ? undefined : parseFloat(e.target.value);
                                field.onChange(value);
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select
                          disabled={categoriesLoading}
                          value={field.value ? field.value.toString() : ""}
                          onValueChange={(value) => field.onChange(parseInt(value))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.isArray(categories) && categories.map((category: any) => (
                              <SelectItem key={category.id} value={category.id.toString()}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock Quantity</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            placeholder="0" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <FormLabel>Sizes</FormLabel>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {sizeOptions.map(size => (
                        <div 
                          key={size} 
                          className="flex items-center bg-gray-100 rounded-full px-3 py-1"
                        >
                          <span className="mr-1">{size}</span>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 rounded-full"
                            onClick={() => removeSize(size)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add size (e.g. S, M, L)"
                        value={newSize}
                        onChange={(e) => setNewSize(e.target.value)}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={addSize}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <FormLabel>Colors</FormLabel>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {colorOptions.map(color => (
                        <div 
                          key={color} 
                          className="flex items-center bg-gray-100 rounded-full px-3 py-1"
                        >
                          <span className="mr-1">{color}</span>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 rounded-full"
                            onClick={() => removeColor(color)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add color (e.g. Red, Blue)"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={addColor}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Right column - Media and settings */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Product Media</CardTitle>
                  <CardDescription>
                    Upload images for this product
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {imagePreviews.map((preview, index) => (
                        <div 
                          key={index} 
                          className="relative aspect-square rounded-md overflow-hidden border"
                        >
                          <img 
                            src={preview} 
                            alt={`Preview ${index + 1}`} 
                            className="w-full h-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 rounded-full"
                            onClick={() => removeImage(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {imagePreviews.length < 4 && (
                        <div className="border border-dashed rounded-md flex items-center justify-center aspect-square">
                          <label className="cursor-pointer flex flex-col items-center p-4 w-full h-full">
                            <ImagePlus className="mb-2 h-6 w-6 text-gray-400" />
                            <span className="text-sm text-gray-500">Add Image</span>
                            <input
                              type="file"
                              id="productImage"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageChange}
                            />
                            <Button 
                              type="button" 
                              variant="secondary" 
                              size="sm"
                              className="mt-2"
                              onClick={() => document.getElementById('productImage')?.click()}
                            >
                              Select
                            </Button>
                          </label>
                        </div>
                      )}
                    </div>
                    <FormDescription>
                      Upload up to 4 product images. First image will be the main product image.
                    </FormDescription>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Product Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="featured"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-3">
                        <div className="space-y-1">
                          <FormLabel>Featured Product</FormLabel>
                          <FormDescription>
                            Show this product on the homepage
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value || false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="trending"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-3">
                        <div className="space-y-1">
                          <FormLabel>Trending Product</FormLabel>
                          <FormDescription>
                            Mark this product as trending
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value || false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
          
          <Separator />
          
          <div className="flex justify-end gap-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate("/admin/products")}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-purple hover:bg-purple/90 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Create Product
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
