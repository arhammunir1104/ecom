import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as firebaseService from "@/lib/firebaseService";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  User,
  ShoppingBag,
  Mail,
  MoreHorizontal,
  ShieldCheck,
  Shield,
  Ban,
  Loader2,
  Heart,
  ShoppingCart,
  ImageIcon,
  ExternalLink,
  Star,
  BarChart,
  CreditCard,
} from "lucide-react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface User {
  id: number;
  username: string;
  email: string;
  fullName: string | null;
  photoURL: string | null;
  role: string;
  createdAt: string;
  firebaseUid: string | null;
  twoFactorEnabled: boolean;
}

interface UserTableProps {
  users: User[];
}

const UserTable = ({ users }: UserTableProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showOrdersDialog, setShowOrdersDialog] = useState(false);
  const [showUserProfileDialog, setShowUserProfileDialog] = useState(false);

  // State to track Firebase sync status
  const [firebaseSyncStatus, setFirebaseSyncStatus] = useState<{
    userId: number;
    status: "success" | "warning" | "error" | null;
    message: string;
  } | null>(null);

  // Use the updateUserRole function from Firebase service directly

  // Mutation for updating user role
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      try {
        // Reset Firebase sync status
        setFirebaseSyncStatus(null);

        // Find the user to get their Firebase UID - we need this for the client-side update
        let userFirebaseUid = "";

        // First, try to find the user's Firebase UID from the users prop we already have
        const existingUser = users.find((u) => u.id === userId);
        if (existingUser && existingUser.firebaseUid) {
          userFirebaseUid = existingUser.firebaseUid;
        }

        console.log(
          `Updating role for user id ${userId} with Firebase UID ${userFirebaseUid}`,
        );

        // 1. First, try standard server-side API to update both database and Firebase
        // This handles both database update and Firebase update in one call
        const response = await apiRequest("POST", "/api/admin/users/role", {
          userId,
          role,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `Server error: ${response.status}`,
          );
        }

        const responseData = await response.json();

        // If no Firebase UID found yet, try to get it from the response
        if (
          !userFirebaseUid &&
          responseData.user &&
          responseData.user.firebaseUid
        ) {
          userFirebaseUid = responseData.user.firebaseUid;
        }

        // 2. If the server-side Firebase update failed but we have a Firebase UID,
        // try the client-side approach as a backup
        if (responseData.firebaseSuccess === false && userFirebaseUid) {
          console.log(
            `Server-side Firebase update failed, trying client-side update for UID: ${userFirebaseUid}`,
          );

          try {
            // Use the client-side Firebase service function
            await firebaseService.updateUserRole(userFirebaseUid, role as any);

            console.log("Client-side Firebase update succeeded");

            // Update status to show partial success with client-side backup
            setFirebaseSyncStatus({
              userId,
              status: "success",
              message:
                "Role updated in database and Firebase (via client-side fallback)",
            });

            // Return the updated user with an overridden firebaseSuccess flag
            return {
              ...responseData.user,
              _firebaseSuccess: true,
            };
          } catch (firebaseError) {
            console.error(
              "Client-side Firebase update also failed:",
              firebaseError,
            );

            // Keep the warning status since client-side also failed
            setFirebaseSyncStatus({
              userId,
              status: "warning",
              message:
                "Database updated but Firebase sync failed despite backup attempts. Roles may be out of sync.",
            });
          }
        } else {
          // Track Firebase sync status from server response
          if (responseData.firebaseSuccess === true) {
            setFirebaseSyncStatus({
              userId,
              status: "success",
              message: "Database and Firebase roles updated successfully",
            });
          } else if (responseData.firebaseSuccess === false) {
            setFirebaseSyncStatus({
              userId,
              status: "warning",
              message:
                "Database updated but Firebase sync failed. Roles may be out of sync.",
            });
          }
        }

        return responseData.user;
      } catch (error) {
        console.error("Role update error:", error);

        // Set error status
        setFirebaseSyncStatus({
          userId: userId,
          status: "error",
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
        });

        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Role updated",
        description:
          firebaseSyncStatus?.status === "warning"
            ? "Database updated but Firebase sync failed. Roles may be out of sync."
            : "User role has been updated successfully",
        variant:
          firebaseSyncStatus?.status === "warning" ? "destructive" : "default",
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });

      // If a user detail is open, refresh it as well
      if (selectedUser) {
        queryClient.invalidateQueries({
          queryKey: [`/api/admin/users/${selectedUser.id}/details`],
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error updating role",
        description:
          error.message || "An error occurred while updating user role",
        variant: "destructive",
      });
    },
  });

  // Define user details interface
  interface UserDetails {
    user: User;
    orders: Array<{
      id: number;
      createdAt: string;
      status: string;
      items: any[];
      totalAmount: number;
      formattedDate?: string;
      formattedTime?: string;
      statusColor?: string;
    }>;
    wishlistItems: Array<{
      id: number;
      name: string;
      price: number;
    }>;
    cartItems: Array<{
      id?: number;
      name: string;
      price: number;
      quantity?: number;
      image?: string | string[];
    }>;
    reviews: Array<{
      id: number;
      productId: number;
      rating: number;
      comment: string;
      createdAt: string;
    }>;
    stats: {
      totalSpent: number;
      totalOrders: number;
      totalWishlistItems: number;
      totalCartItems: number;
      totalReviews: number;
      averageReviewRating: number;
    };
    analytics: {
      productCategories: Array<{
        id: string;
        name: string;
        count: number;
        totalSpent: number;
      }>;
      totalItemsPurchased: number;
      averageOrderValue: number;
      mostPurchasedProducts: Array<{
        id: string;
        name: string;
        count: number;
        totalSpent: number;
      }>;
      lastPurchaseDate: string | null;
    };
    firebase?: any;
  }

  // Fetch user details when viewing profile
  const { data: userDetails, isLoading: isLoadingDetails } =
    useQuery<UserDetails>({
      queryKey: [`/api/admin/users/${selectedUser?.id}/details`],
      enabled: showUserProfileDialog && !!selectedUser,
    });

  const openOrdersDialog = (user: User) => {
    setSelectedUser(user);
    setShowOrdersDialog(true);
  };

  const openUserProfileDialog = (user: User) => {
    setSelectedUser(user);
    setShowUserProfileDialog(true);
  };

  const handleUpdateRole = (userId: number, role: string) => {
    updateRoleMutation.mutate({ userId, role });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-white";
      case "user":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getInitials = (user: User) => {
    if (user.fullName) {
      return user.fullName
        .split(" ")
        .map((name: string) => name[0])
        .join("")
        .toUpperCase();
    }
    return user.username.substring(0, 2).toUpperCase();
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Orders</TableHead>
            <TableHead>Total Spent</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    {user.photoURL ? (
                      <AvatarImage src={user.photoURL} alt={user.username} />
                    ) : (
                      <AvatarFallback className="bg-gray-100 text-gray-500">
                        {getInitials(user)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      {user.fullName || user.username}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {user.email}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge className={getRoleColor(user.role)}>{user.role}</Badge>
                  {firebaseSyncStatus?.userId === user.id && (
                    <div
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        firebaseSyncStatus.status === "success"
                          ? "bg-green-100 text-green-800"
                          : firebaseSyncStatus.status === "warning"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {firebaseSyncStatus.status === "success"
                        ? "Synced ✓"
                        : firebaseSyncStatus.status === "warning"
                          ? "Partial sync !"
                          : "Sync failed ✗"}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {user.createdAt
                  ? format(new Date(user.createdAt), "MMM d, yyyy")
                  : "N/A"}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-purple"
                  onClick={() => openOrdersDialog(user)}
                >
                  <ShoppingBag className="mr-1 h-4 w-4" />
                  View Orders
                </Button>
              </TableCell>
              <TableCell>
                {/* We'll fetch this data when we open the user profile */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-purple"
                  onClick={() => openUserProfileDialog(user)}
                >
                  <CreditCard className="mr-1 h-4 w-4" />
                  View Spending
                </Button>
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
                    <DropdownMenuItem
                      onClick={() =>
                        (window.location.href = `mailto:${user.email}`)
                      }
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Email User
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => openUserProfileDialog(user)}
                    >
                      <User className="mr-2 h-4 w-4" />
                      View Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {user.role === "user" ? (
                      <DropdownMenuItem
                        onClick={() => handleUpdateRole(user.id, "admin")}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Make Admin
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => handleUpdateRole(user.id, "user")}
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        Remove Admin
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-red-600"
                      // Disabling account functionality would be implemented here
                      onClick={() =>
                        toast({
                          title: "Not implemented",
                          description:
                            "Account disabling functionality is not implemented yet",
                        })
                      }
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Disable Account
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* User orders dialog */}
      <Dialog open={showOrdersDialog} onOpenChange={setShowOrdersDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Orders for {selectedUser?.fullName || selectedUser?.username}
            </DialogTitle>
            <DialogDescription>
              View all orders placed by this user
            </DialogDescription>
          </DialogHeader>

          {/* This would show actual order data in a real app */}
          <div className="space-y-4">
            <div className="text-center py-8 text-gray-500">
              <ShoppingBag className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p>No orders found for this user</p>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setShowOrdersDialog(false)}
                variant="outline"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* User profile dialog */}
      <Dialog
        open={showUserProfileDialog}
        onOpenChange={setShowUserProfileDialog}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              User Profile: {selectedUser?.fullName || selectedUser?.username}
            </DialogTitle>
            <DialogDescription>
              Detailed information about this user's account, orders, and
              preferences
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple" />
            </div>
          ) : userDetails ? (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid grid-cols-5 mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
                <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
                <TabsTrigger value="cart">Cart</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="flex flex-col md:flex-row gap-6">
                  <Card className="flex-1">
                    <CardHeader>
                      <CardTitle>User Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-start items-center space-x-4 mb-4">
                        <Avatar className="h-16 w-16">
                          {userDetails.user.photoURL ? (
                            <AvatarImage
                              src={userDetails.user.photoURL}
                              alt={userDetails.user.username}
                            />
                          ) : (
                            <AvatarFallback className="bg-gray-100 text-gray-500 text-xl">
                              {getInitials(userDetails.user)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <h3 className="text-xl font-medium">
                            {userDetails.user.fullName ||
                              userDetails.user.username}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {userDetails.user.email}
                          </p>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Username
                          </p>
                          <p>{userDetails.user.username}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Role</p>
                          <Badge
                            className={getRoleColor(userDetails.user.role)}
                          >
                            {userDetails.user.role}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Joined
                          </p>
                          <p>
                            {userDetails.user.createdAt
                              ? format(
                                  new Date(userDetails.user.createdAt),
                                  "PP",
                                )
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            2FA Enabled
                          </p>
                          <p>
                            {userDetails.user.twoFactorEnabled ? "Yes" : "No"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="flex-1">
                    <CardHeader>
                      <CardTitle>Shopping Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="bg-purple-100 p-2 rounded-full">
                              <CreditCard className="h-6 w-6 text-purple-600" />
                            </div>
                            <span className="text-xs font-medium text-gray-500 uppercase">
                              Total Spent
                            </span>
                          </div>
                          <div className="mt-2">
                            <p className="text-2xl md:text-3xl font-bold text-purple-700">
                              ${userDetails.stats.totalSpent.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="bg-green-100 p-2 rounded-full">
                              <ShoppingBag className="h-6 w-6 text-green-600" />
                            </div>
                            <span className="text-xs font-medium text-gray-500 uppercase">
                              Orders
                            </span>
                          </div>
                          <div className="mt-2">
                            <p className="text-2xl md:text-3xl font-bold text-green-700">
                              {userDetails.stats.totalOrders}
                            </p>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="bg-red-100 p-2 rounded-full">
                              <Heart className="h-6 w-6 text-red-600" />
                            </div>
                            <span className="text-xs font-medium text-gray-500 uppercase">
                              Wishlist
                            </span>
                          </div>
                          <div className="mt-2">
                            <p className="text-2xl md:text-3xl font-bold text-red-700">
                              {userDetails.stats.totalWishlistItems}
                            </p>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="bg-blue-100 p-2 rounded-full">
                              <ShoppingCart className="h-6 w-6 text-blue-600" />
                            </div>
                            <span className="text-xs font-medium text-gray-500 uppercase">
                              Cart
                            </span>
                          </div>
                          <div className="mt-2">
                            <p className="text-2xl md:text-3xl font-bold text-blue-700">
                              {userDetails.stats.totalCartItems || 0}
                            </p>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="bg-yellow-100 p-2 rounded-full">
                              <Star className="h-6 w-6 text-yellow-600" />
                            </div>
                            <span className="text-xs font-medium text-gray-500 uppercase">
                              Rating
                            </span>
                          </div>
                          <div className="flex items-center">
                            <p className="text-xl md:text-2xl font-bold text-yellow-700 mr-2">
                              {userDetails.stats.averageReviewRating?.toFixed(
                                1,
                              ) || "0.0"}
                            </p>
                            <div className="flex text-yellow-400">
                              {Array.from({ length: 5 }).map((_, index) => (
                                <span key={index} className="text-lg">
                                  {index <
                                  Math.round(
                                    userDetails.stats.averageReviewRating || 0,
                                  )
                                    ? "★"
                                    : "☆"}
                                </span>
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            ({userDetails.stats.totalReviews || 0} reviews)
                          </p>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Actions</h4>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm">
                            <Mail className="mr-2 h-4 w-4" />
                            Email User
                          </Button>
                          {userDetails.user.role === "user" ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                handleUpdateRole(userDetails.user.id, "admin")
                              }
                              disabled={updateRoleMutation.isPending}
                            >
                              {updateRoleMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <ShieldCheck className="mr-2 h-4 w-4" />
                              )}
                              Make Admin
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                handleUpdateRole(userDetails.user.id, "user")
                              }
                              disabled={updateRoleMutation.isPending}
                            >
                              {updateRoleMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Shield className="mr-2 h-4 w-4" />
                              )}
                              Remove Admin
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="orders">
                <Card>
                  <CardHeader>
                    <CardTitle>Order History</CardTitle>
                    <CardDescription>
                      All orders placed by this user
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {userDetails.orders && userDetails.orders.length > 0 ? (
                      <div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Order ID</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Products</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead className="text-right">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {userDetails.orders.map((order: any) => (
                              <React.Fragment key={order.id}>
                                <TableRow className="group hover:bg-gray-50">
                                  <TableCell className="font-medium">
                                    #{order.id}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {format(new Date(order.createdAt), "PPP")}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        order.status === "delivered" ||
                                        order.status === "completed"
                                          ? "default"
                                          : order.status === "cancelled"
                                            ? "destructive"
                                            : "outline"
                                      }
                                      className="capitalize"
                                    >
                                      {order.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {/* Only show the first product image */}
                                      {order.items.length > 0 && (
                                        <div className="flex-shrink-0 relative">
                                          <div className="h-10 w-10 rounded border overflow-hidden">
                                            {order.items[0].images?.length >
                                              0 || order.items[0].image ? (
                                              <img
                                                src={
                                                  order.items[0].images
                                                    ?.length > 0
                                                    ? order.items[0].images[0]
                                                    : Array.isArray(
                                                          order.items[0].image,
                                                        )
                                                      ? order.items[0].image[0]
                                                      : order.items[0].image
                                                }
                                                alt={order.items[0].name}
                                                className="h-full w-full object-cover"
                                              />
                                            ) : (
                                              <div className="h-full w-full bg-gray-100 flex items-center justify-center">
                                                <ImageIcon className="h-4 w-4 text-gray-400" />
                                              </div>
                                            )}
                                          </div>
                                          {order.items.length > 1 && (
                                            <div className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                              {order.items.length}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      <div className="text-sm">
                                        <div className="font-semibold truncate max-w-[120px]">
                                          {order.items[0]?.name || "Product"}
                                        </div>
                                        <div className="text-gray-500 text-xs">
                                          {order.items.length}{" "}
                                          {order.items.length === 1
                                            ? "item"
                                            : "items"}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    ${order.totalAmount.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8"
                                      onClick={() =>
                                        window.open(`/admin/orders`, "_blank")
                                      }
                                    >
                                      <ExternalLink className="h-4 w-4 mr-1" />
                                      Details
                                    </Button>
                                  </TableCell>
                                </TableRow>

                                {/* Expandable product list for this order */}
                                <TableRow className="bg-gray-50/50 hover:bg-gray-50/80 group-hover:table-row hidden">
                                  <TableCell colSpan={6} className="p-2">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                      {order.items.map(
                                        (item: any, idx: number) => (
                                          <div
                                            key={idx}
                                            className="flex items-center space-x-2 p-2 rounded border bg-white"
                                          >
                                            <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden">
                                              {item.images?.length > 0 ||
                                              item.image ? (
                                                <img
                                                  src={
                                                    item.images?.length > 0
                                                      ? item.images[0]
                                                      : Array.isArray(
                                                            item.image,
                                                          )
                                                        ? item.image[0]
                                                        : item.image
                                                  }
                                                  alt={item.name}
                                                  className="h-full w-full object-cover"
                                                />
                                              ) : (
                                                <div className="h-full w-full bg-gray-100 flex items-center justify-center">
                                                  <ImageIcon className="h-5 w-5 text-gray-400" />
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex-grow min-w-0">
                                              <h4 className="font-medium text-sm line-clamp-1">
                                                {item.name}
                                              </h4>
                                              <div className="flex justify-between text-xs text-gray-500">
                                                <span>
                                                  $
                                                  {typeof item.price ===
                                                  "number"
                                                    ? item.price.toFixed(2)
                                                    : "0.00"}
                                                </span>
                                                <span>
                                                  Qty: {item.quantity || 1}
                                                </span>
                                              </div>
                                            </div>
                                            {item.productId && (
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 flex-shrink-0"
                                                onClick={() =>
                                                  window.open(
                                                    `/product/${item.productId}`,
                                                    "_blank",
                                                  )
                                                }
                                              >
                                                <ExternalLink className="h-4 w-4" />
                                              </Button>
                                            )}
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              </React.Fragment>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <ShoppingBag className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <p>No orders found for this user</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="wishlist">
                <Card>
                  <CardHeader>
                    <CardTitle>Wishlist</CardTitle>
                    <CardDescription>Products saved for later</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {userDetails.wishlistItems &&
                    userDetails.wishlistItems.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {userDetails.wishlistItems.map((item: any) => (
                          <div
                            key={item.id}
                            className="border rounded-md p-4 flex flex-col gap-2"
                          >
                            {/* Product Image */}
                            {item.images?.length > 0 || item.image ? (
                              <div className="aspect-square overflow-hidden rounded-md">
                                <img
                                  src={
                                    item.images?.length > 0
                                      ? item.images[0]
                                      : Array.isArray(item.image)
                                        ? item.image[0]
                                        : item.image
                                  }
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="aspect-square bg-gray-100 rounded-md flex items-center justify-center">
                                <ImageIcon className="h-10 w-10 text-gray-400" />
                              </div>
                            )}

                            {/* Product Name with Link */}
                            <div>
                              <h4 className="font-medium line-clamp-2">
                                {item.name}
                              </h4>
                              <div className="flex justify-between items-center mt-1">
                                <p className="text-sm font-medium">
                                  $
                                  {typeof item.price === "number"
                                    ? item.price.toFixed(2)
                                    : "0.00"}
                                </p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2"
                                  onClick={() =>
                                    window.open(`/product/${item.id}`, "_blank")
                                  }
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Heart className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <p>No items in wishlist</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cart">
                <Card>
                  <CardHeader>
                    <CardTitle>Shopping Cart</CardTitle>
                    <CardDescription>Items currently in cart</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {userDetails.cartItems &&
                    userDetails.cartItems.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {userDetails.cartItems.map(
                          (item: any, index: number) => (
                            <div
                              key={index}
                              className="border rounded-md p-4 flex flex-col gap-2"
                            >
                              {/* Product Image */}
                              {item.images?.length > 0 || item.image ? (
                                <div className="aspect-square overflow-hidden rounded-md">
                                  <img
                                    src={
                                      item.images?.length > 0
                                        ? item.images[0]
                                        : Array.isArray(item.image)
                                          ? item.image[0]
                                          : item.image
                                    }
                                    alt={item.name}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="aspect-square bg-gray-100 rounded-md flex items-center justify-center">
                                  <ImageIcon className="h-10 w-10 text-gray-400" />
                                </div>
                              )}

                              {/* Product Details */}
                              <div>
                                <h4 className="font-medium line-clamp-2">
                                  {item.name}
                                </h4>
                                <div className="flex justify-between items-center mt-1">
                                  <div className="flex flex-col">
                                    <p className="text-sm font-medium">
                                      $
                                      {typeof item.price === "number"
                                        ? item.price.toFixed(2)
                                        : "0.00"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Qty: {item.quantity || 1}
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2"
                                    onClick={() =>
                                      window.open(
                                        `/product/${item.id}`,
                                        "_blank",
                                      )
                                    }
                                  >
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    View
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <ShoppingCart className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <p>No items in cart</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Purchase Analytics</CardTitle>
                      <CardDescription>
                        Analysis of user purchase behavior (from order history)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {userDetails.orders && userDetails.orders.length > 0 ? (
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <h4 className="font-medium text-sm text-muted-foreground mb-1">
                                Average Order Value
                              </h4>
                              <p className="text-2xl font-semibold">
                                $
                                {(
                                  userDetails.stats.totalSpent /
                                  userDetails.orders.length
                                ).toFixed(2)}
                              </p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <h4 className="font-medium text-sm text-muted-foreground mb-1">
                                Total Items Purchased
                              </h4>
                              <p className="text-2xl font-semibold">
                                {userDetails.orders.reduce(
                                  (total, order) =>
                                    total +
                                    order.items.reduce(
                                      (sum, item) => sum + (item.quantity || 1),
                                      0,
                                    ),
                                  0,
                                )}
                              </p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <h4 className="font-medium text-sm text-muted-foreground mb-1">
                                Last Purchase
                              </h4>
                              <p className="text-lg font-semibold">
                                {format(
                                  new Date(userDetails.orders[0].createdAt),
                                  "PPP",
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Process order history data for product purchases */}
                          {(() => {
                            // Group orders by product
                            const products = new Map();

                            userDetails.orders.forEach((order) => {
                              order.items.forEach((item) => {
                                const id = item.id || item.productId;
                                if (!id) return;

                                if (!products.has(id)) {
                                  products.set(id, {
                                    id: id,
                                    name: item.name || `Product #${id}`,
                                    count: 0,
                                    totalSpent: 0,
                                  });
                                }

                                const product = products.get(id);
                                const quantity = item.quantity || 1;
                                product.count += quantity;
                                product.totalSpent +=
                                  (item.price || 0) * quantity;
                              });
                            });

                            // Convert to array and sort
                            const productList = Array.from(
                              products.values(),
                            ).sort((a, b) => b.count - a.count);

                            if (productList.length === 0) return null;

                            return (
                              <div>
                                <h4 className="font-medium mb-2">
                                  Most Purchased Products
                                </h4>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Product</TableHead>
                                      <TableHead>Quantity</TableHead>
                                      <TableHead>Total Spent</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {productList
                                      .slice(0, 5)
                                      .map((product: any) => (
                                        <TableRow key={product.id}>
                                          <TableCell>{product.name}</TableCell>
                                          <TableCell>{product.count}</TableCell>
                                          <TableCell>
                                            ${product.totalSpent.toFixed(2)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                  </TableBody>
                                </Table>
                              </div>
                            );
                          })()}

                          {/* Process order history data for category preferences */}
                          {(() => {
                            // Group orders by category
                            const categories = new Map();

                            userDetails.orders.forEach((order) => {
                              order.items.forEach((item) => {
                                const categoryId = item.categoryId;
                                if (!categoryId) return;

                                const categoryName =
                                  item.categoryName ||
                                  `Category #${categoryId}`;

                                if (!categories.has(categoryId)) {
                                  categories.set(categoryId, {
                                    id: categoryId,
                                    name: categoryName,
                                    count: 0,
                                    totalSpent: 0,
                                  });
                                }

                                const category = categories.get(categoryId);
                                const quantity = item.quantity || 1;
                                category.count += quantity;
                                category.totalSpent +=
                                  (item.price || 0) * quantity;
                              });
                            });

                            // Convert to array and sort
                            const categoryList = Array.from(
                              categories.values(),
                            ).sort((a, b) => b.count - a.count);

                            if (categoryList.length === 0) return null;

                            return (
                              <div>
                                <h4 className="font-medium mb-2">
                                  Preferred Categories
                                </h4>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Category</TableHead>
                                      <TableHead>Items</TableHead>
                                      <TableHead>Total Spent</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {categoryList
                                      .slice(0, 5)
                                      .map((category: any) => (
                                        <TableRow key={category.id}>
                                          <TableCell>{category.name}</TableCell>
                                          <TableCell>
                                            {category.count}
                                          </TableCell>
                                          <TableCell>
                                            ${category.totalSpent.toFixed(2)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                  </TableBody>
                                </Table>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <BarChart className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                          <p>No order history available</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Analytics are generated from the user's order
                            history
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <User className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p>Failed to load user details</p>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => setShowUserProfileDialog(false)}
              variant="outline"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserTable;
