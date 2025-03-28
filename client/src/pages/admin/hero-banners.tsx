import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { HeroBanner } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { uploadImage } from "@/lib/cloudinary";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  PlusCircle, 
  PencilIcon, 
  Trash2, 
  Loader2, 
  ImagePlus, 
  Calendar,
  ArrowRightLeft
} from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

// Banner form schema with validation
const bannerSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  subtitle: z.string().optional(),
  buttonText: z.string().optional(),
  buttonLink: z.string().optional(),
  active: z.boolean().default(true),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

type BannerFormValues = z.infer<typeof bannerSchema>;

export default function AdminHeroBanners() {
  const { isAdmin, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [selectedBanner, setSelectedBanner] = useState<HeroBanner | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Redirect if not admin
  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, isAuthenticated, navigate]);
  
  // Fetch banners
  const { data: banners, isLoading, refetch } = useQuery<HeroBanner[]>({
    queryKey: ["/api/admin/hero-banners"],
    enabled: isAdmin && isAuthenticated,
  });
  
  const form = useForm<BannerFormValues>({
    resolver: zodResolver(bannerSchema),
    defaultValues: {
      title: "",
      subtitle: "",
      buttonText: "Shop Now",
      buttonLink: "/shop",
      active: true,
      startDate: undefined,
      endDate: undefined,
    },
  });
  
  // Reset form when editing or creating
  useEffect(() => {
    if (isEditing && selectedBanner) {
      form.reset({
        title: selectedBanner.title,
        subtitle: selectedBanner.subtitle || "",
        buttonText: selectedBanner.buttonText || "Shop Now",
        buttonLink: selectedBanner.buttonLink || "/shop",
        active: selectedBanner.active,
        startDate: selectedBanner.startDate ? new Date(selectedBanner.startDate) : undefined,
        endDate: selectedBanner.endDate ? new Date(selectedBanner.endDate) : undefined,
      });
      
      if (selectedBanner.image) {
        setImagePreview(selectedBanner.image);
      }
    } else if (isCreating) {
      form.reset({
        title: "",
        subtitle: "",
        buttonText: "Shop Now",
        buttonLink: "/shop",
        active: true,
        startDate: undefined,
        endDate: undefined,
      });
      setImageFile(null);
      setImagePreview(null);
    }
  }, [isEditing, isCreating, selectedBanner, form]);
  
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
      // Only revoke if it's a blob URL
      if (imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(null);
    }
  };
  
  const openEditDialog = (banner: HeroBanner) => {
    setSelectedBanner(banner);
    setIsEditing(true);
  };
  
  const openCreateDialog = () => {
    setIsCreating(true);
  };
  
  const closeDialog = () => {
    setIsEditing(false);
    setIsCreating(false);
    setSelectedBanner(null);
    setImageFile(null);
    setImagePreview(null);
  };
  
  const confirmDelete = async (banner: HeroBanner) => {
    setIsDeleting(banner.id);
    
    try {
      await apiRequest("DELETE", `/api/admin/hero-banners/${banner.id}`);
      
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hero-banners"] });
      refetch();
      
      toast({
        title: "Banner Deleted",
        description: "The banner has been deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete banner",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };
  
  const onSubmit = async (data: BannerFormValues) => {
    if ((!imageFile && !imagePreview) || (isCreating && !imageFile)) {
      toast({
        title: "Missing Image",
        description: "Please upload a banner image",
        variant: "destructive",
      });
      return;
    }
    
    let imageUrl = selectedBanner?.image || "";
    
    try {
      // Upload image if it's a new one
      if (imageFile) {
        const uploadedImage = await uploadImage(imageFile);
        imageUrl = uploadedImage.url;
      }
      
      const bannerData = {
        ...data,
        image: imageUrl,
      };
      
      if (isEditing && selectedBanner) {
        // Update existing banner
        await apiRequest("PUT", `/api/admin/hero-banners/${selectedBanner.id}`, bannerData);
        toast({
          title: "Banner Updated",
          description: "The banner has been updated successfully",
        });
      } else {
        // Create new banner
        await apiRequest("POST", "/api/admin/hero-banners", bannerData);
        toast({
          title: "Banner Created",
          description: "The banner has been created successfully",
        });
      }
      
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hero-banners"] });
      refetch();
      
      // Close dialog
      closeDialog();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save banner",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-playfair font-bold tracking-tight">Hero Banners</h2>
          <p className="text-muted-foreground">
            Manage homepage banners to showcase your collections
          </p>
        </div>
        <Button 
          onClick={openCreateDialog}
          className="bg-purple text-white"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Banner
        </Button>
      </div>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>All Banners</CardTitle>
          <CardDescription>
            Banners that will be displayed on the homepage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b">
                  <Skeleton className="h-24 w-40 rounded" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : banners && banners.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banners.map((banner) => (
                    <TableRow key={banner.id}>
                      <TableCell>
                        <div className="w-40 h-24 rounded overflow-hidden bg-gray-100">
                          <img 
                            src={banner.image}
                            alt={banner.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{banner.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {banner.subtitle || "No subtitle"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <span className={`mr-2 h-2.5 w-2.5 rounded-full ${banner.active ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          {banner.active ? 'Active' : 'Inactive'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {banner.startDate || banner.endDate ? (
                          <div className="text-sm">
                            {banner.startDate && (
                              <div>
                                <span className="text-muted-foreground">From:</span> {format(new Date(banner.startDate), 'MMM d, yyyy')}
                              </div>
                            )}
                            {banner.endDate && (
                              <div>
                                <span className="text-muted-foreground">To:</span> {format(new Date(banner.endDate), 'MMM d, yyyy')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No schedule</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(banner)}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Banner</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this banner? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-500 hover:bg-red-600 text-white"
                                  onClick={() => confirmDelete(banner)}
                                  disabled={isDeleting === banner.id}
                                >
                                  {isDeleting === banner.id ? (
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
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No banners found</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={openCreateDialog}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Your First Banner
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Banner Form Dialog */}
      <Dialog open={isEditing || isCreating} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Banner' : 'Create New Banner'}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Update the banner information below'
                : 'Fill in the details to create a new banner for your homepage'
              }
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left column - Form fields */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter banner title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="subtitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subtitle (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter banner subtitle" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="buttonText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Button Text</FormLabel>
                          <FormControl>
                            <Input placeholder="Shop Now" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="buttonLink"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Button Link</FormLabel>
                          <FormControl>
                            <Input placeholder="/shop" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-3">
                        <div className="space-y-1">
                          <FormLabel>Active Status</FormLabel>
                          <FormDescription>
                            Show this banner on the homepage
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Start Date (Optional)</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={!field.value ? "text-muted-foreground" : ""}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <Calendar className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => 
                                  date < new Date(new Date().setHours(0, 0, 0, 0))
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>End Date (Optional)</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={!field.value ? "text-muted-foreground" : ""}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <Calendar className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => {
                                  const startDate = form.watch("startDate");
                                  return startDate && date < startDate;
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Right column - Banner image */}
                <div className="space-y-4">
                  <FormLabel>Banner Image</FormLabel>
                  {imagePreview ? (
                    <div className="relative aspect-[16/9] rounded-md overflow-hidden border">
                      <img 
                        src={imagePreview} 
                        alt="Banner preview" 
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
                    <div className="border border-dashed rounded-md flex items-center justify-center aspect-[16/9]">
                      <label className="cursor-pointer flex flex-col items-center p-8">
                        <ImagePlus className="mb-4 h-10 w-10 text-gray-400" />
                        <span className="text-lg font-medium mb-1">Upload Image</span>
                        <span className="text-sm text-gray-500 text-center mb-4">
                          Drag and drop or click to browse
                        </span>
                        <Button type="button" variant="secondary" className="mb-2">
                          Select Image
                        </Button>
                        <p className="text-xs text-gray-500">
                          Recommended size: 1920 x 1080px
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageChange}
                        />
                      </label>
                    </div>
                  )}
                  <FormDescription>
                    Upload a high-quality image for your banner. The image should be 1920 x 1080px for best results.
                  </FormDescription>
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={closeDialog}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-purple hover:bg-purple/90 text-white"
                >
                  {isEditing ? 'Update Banner' : 'Create Banner'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
