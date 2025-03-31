import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertCategorySchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, 
  ImagePlus, 
  Loader2, 
  Trash2, 
  CheckCircle 
} from "lucide-react";

// Extended category schema with custom validations
const categorySchema = insertCategorySchema.extend({
  name: z.string().min(2, "Category name must be at least 2 characters"),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export default function AdminEditCategory() {
  const { isAdmin, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/admin/categories/edit/:id");
  const categoryId = params ? parseInt(params.id) : null;
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Redirect if not admin
  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, isAuthenticated, navigate]);

  // Fetch category data
  const { data: category, isLoading: categoryLoading } = useQuery({
    queryKey: ["/api/categories", categoryId],
    queryFn: async () => {
      if (!categoryId) return null;
      const res = await apiRequest("GET", `/api/categories/${categoryId}`);
      return await res.json();
    },
    enabled: isAdmin && isAuthenticated && !!categoryId,
  });
  
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      description: "",
      image: "",
      featured: false,
    },
  });
  
  // Set form values when category data is loaded
  useEffect(() => {
    if (category) {
      form.reset({
        name: category.name || "",
        description: category.description || "",
        featured: category.featured || false,
        image: category.image || "",
      });
      
      // Set image preview if there's an image
      if (category.image) {
        setImagePreview(category.image);
      }
    }
  }, [category, form]);
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      
      // Generate preview
      const preview = URL.createObjectURL(file);
      setImagePreview(preview);
    }
  };
  
  const removeImage = () => {
    setImageFile(null);
    
    if (imagePreview) {
      // Revoke object URL to free memory if it's a local preview
      if (!imagePreview.startsWith('http')) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(null);
    }
    
    // Clear the image field in the form
    form.setValue("image", "");
  };
  
  async function onSubmit(data: CategoryFormValues) {
    if (!categoryId) return;
    
    setIsSubmitting(true);
    
    try {
      // Handle image
      let imageUrl = data.image || "";
      
      if (imageFile) {
        // Create a data URL for the image
        const reader = new FileReader();
        imageUrl = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(imageFile);
        });
      }
      
      // Update category with image URL
      const categoryData = {
        ...data,
        image: imageUrl,
      };
      
      await apiRequest("PUT", `/api/categories/${categoryId}`, categoryData);
      
      // Invalidate categories query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories", categoryId] });
      
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
      
      // Navigate to categories list
      navigate("/admin/categories");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (categoryLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple" />
      </div>
    );
  }
  
  if (!category && !categoryLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-xl font-medium mb-2">Category Not Found</h2>
        <p className="text-muted-foreground mb-4">The category you're looking for doesn't exist.</p>
        <Button onClick={() => navigate("/admin/categories")}>
          Back to Categories
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/admin/categories")}
          className="mr-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Categories
        </Button>
        <div>
          <h2 className="text-3xl font-playfair font-bold tracking-tight">Edit Category</h2>
          <p className="text-muted-foreground">
            Update the details for this category
          </p>
        </div>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column - Category info */}
            <Card>
              <CardHeader>
                <CardTitle>Category Information</CardTitle>
                <CardDescription>
                  Update the details about your category
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter category name" {...field} />
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
                          placeholder="Enter category description" 
                          className="min-h-[120px]" 
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="featured"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-3">
                      <div className="space-y-1">
                        <FormLabel>Featured Category</FormLabel>
                        <FormDescription>
                          Show this category on the homepage
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
              <CardFooter className="flex justify-end gap-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate("/admin/categories")}
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
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Update Category
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
            
            {/* Right column - Media */}
            <Card>
              <CardHeader>
                <CardTitle>Category Image</CardTitle>
                <CardDescription>
                  Update or upload a new image for this category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {imagePreview ? (
                    <div className="relative aspect-[3/2] rounded-md overflow-hidden border">
                      <img 
                        src={imagePreview} 
                        alt="Category preview" 
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 rounded-full"
                        onClick={removeImage}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border border-dashed rounded-md flex items-center justify-center aspect-[3/2]">
                      <label className="cursor-pointer flex flex-col items-center p-8 w-full h-full">
                        <ImagePlus className="mb-4 h-10 w-10 text-gray-400" />
                        <span className="text-lg font-medium mb-1">Upload Image</span>
                        <span className="text-sm text-gray-500 text-center mb-4">
                          Drag and drop or click to browse
                        </span>
                        <input
                          type="file"
                          id="editCategoryImage"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageChange}
                        />
                        <Button 
                          type="button" 
                          variant="secondary" 
                          className="mb-2"
                          onClick={() => document.getElementById('editCategoryImage')?.click()}
                        >
                          Select Image
                        </Button>
                        <p className="text-xs text-gray-500">
                          Recommended size: 800 x 600px
                        </p>
                      </label>
                    </div>
                  )}
                  <FormDescription>
                    Upload a high-quality image that represents this category.
                  </FormDescription>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>
    </div>
  );
}