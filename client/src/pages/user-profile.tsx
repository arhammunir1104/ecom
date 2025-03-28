import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, UserCircle, Heart, ShoppingBag, MapPin } from "lucide-react";

// Define types
interface UserProfile {
  username: string;
  email: string;
  fullName?: string;
  address?: string;
  phone?: string;
}

// Define schema
const profileSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email"),
  fullName: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function UserProfile() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Fetch user profile data
  const { data: profile, isLoading: isProfileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
    enabled: isAuthenticated,
  });

  // Setup form with default values
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: "",
      email: "",
      fullName: "",
      address: "",
      phone: "",
    },
  });

  // Update form when profile data is loaded
  useEffect(() => {
    if (profile) {
      form.reset({
        username: profile.username || "",
        email: profile.email || "",
        fullName: profile.fullName || "",
        address: profile.address || "",
        phone: profile.phone || "",
      });
    } else if (user) {
      form.reset({
        username: user.username || "",
        email: user.email || "",
        fullName: "",
        address: "",
        phone: "",
      });
    }
  }, [profile, user, form]);

  // Handle form submission
  async function onSubmit(data: ProfileFormValues) {
    setIsLoading(true);
    try {
      await apiRequest("PUT", "/api/profile", data);
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Show login message if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <UserCircle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Please Sign In</h2>
            <p className="text-gray-500 mb-6">You need to be signed in to view your profile.</p>
            <Button asChild>
              <a href="/login">Sign In</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate user initials for avatar
  const displayName = profile?.fullName || profile?.username || user?.username || "";
  const userInitials = displayName.substring(0, 2).toUpperCase();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Account</h1>
      
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-1/3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <Avatar className="w-24 h-24 border-4 border-primary/20">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary text-white text-xl">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-medium mt-4">
                  {profile?.fullName || profile?.username || user?.username}
                </h2>
                <p className="text-gray-500 text-sm">{profile?.email || user?.email}</p>
                <div className="w-full mt-6">
                  <div className="flex items-center p-3 hover:bg-gray-50 rounded-md transition-colors cursor-pointer">
                    <Heart className="mr-3 h-5 w-5 text-primary" />
                    <span>My Wishlist</span>
                  </div>
                  <div className="flex items-center p-3 hover:bg-gray-50 rounded-md transition-colors cursor-pointer">
                    <ShoppingBag className="mr-3 h-5 w-5 text-primary" />
                    <a href="/orders" className="w-full">My Orders</a>
                  </div>
                  <div className="flex items-center p-3 hover:bg-gray-50 rounded-md transition-colors cursor-pointer">
                    <MapPin className="mr-3 h-5 w-5 text-primary" />
                    <span>My Addresses</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="w-full md:w-2/3">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>
                Update your account settings and information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="personal" className="w-full">
                <TabsList className="mb-6">
                  <TabsTrigger value="personal">Personal Information</TabsTrigger>
                  <TabsTrigger value="security">Security</TabsTrigger>
                </TabsList>
                <TabsContent value="personal">
                  {isProfileLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input placeholder="Username" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input placeholder="Email" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Full Name" {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                <Input placeholder="Phone" {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Address</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Enter your full address" 
                                  className="resize-none"
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end">
                          <Button 
                            type="submit" 
                            className="bg-primary hover:bg-primary/90 text-white"
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              "Save Changes"
                            )}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  )}
                </TabsContent>
                <TabsContent value="security">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium mb-2">Change Password</h3>
                      <div className="space-y-4">
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input type="password" />
                          </FormControl>
                        </FormItem>
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input type="password" />
                          </FormControl>
                        </FormItem>
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <Input type="password" />
                          </FormControl>
                        </FormItem>
                        <Button className="bg-primary hover:bg-primary/90 text-white">
                          Update Password
                        </Button>
                      </div>
                    </div>
                    <div className="pt-6 border-t">
                      <h3 className="text-lg font-medium mb-2">Two-Factor Authentication</h3>
                      <p className="text-gray-500 mb-4">
                        Add an extra layer of security to your account by enabling two-factor authentication.
                      </p>
                      <Button variant="outline">Enable 2FA</Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
