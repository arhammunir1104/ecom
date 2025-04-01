import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  // Mutation for updating user role
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      try {
        console.log(`Starting role update for user ID ${userId} to ${role}`);
        
        // First get user to get Firebase UID if available
        const userResponse = await apiRequest(
          "GET",
          `/api/admin/users/${userId}`,
        );
        const user = await userResponse.json();
        const firebaseUid = user?.firebaseUid;
        
        console.log(`Got user details, Firebase UID:`, firebaseUid || 'not available');
        
        // Update in Express database using fetch directly to troubleshoot
        console.log(`Sending request to update role...`);
        const response = await fetch(`/api/admin/users/${userId}/role`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'firebase-uid': localStorage.getItem('firebaseUid') || '',
          },
          body: JSON.stringify({ role })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Server error response:', errorText);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
        
        const updatedUser = await response.json();
        console.log('Database update successful', updatedUser);
        
        // If the user has a Firebase UID, directly update in Firebase as well
        if (firebaseUid) {
          try {
            console.log(`Attempting direct Firebase update for UID: ${firebaseUid}`);
            // Directly import the function we need
            const { updateUserRole } = await import("@/lib/firebaseService");
            
            // Use the updateUserRole function from Firebase service
            await updateUserRole(
              firebaseUid,
              role as "admin" | "user",
            );
            console.log("Firebase role updated directly via client SDK");
          } catch (firebaseError) {
            console.error(
              "Error updating Firebase role directly:",
              firebaseError,
            );
            // We continue since the database is already updated
          }
        }
        
        console.log('Role update completed successfully');
        return updatedUser;
      } catch (error) {
        console.error('Role update error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Role updated",
        description: "User role has been updated successfully",
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
    }>;
    wishlistItems: Array<{
      id: number;
      name: string;
      price: number;
    }>;
    stats: {
      totalSpent: number;
      totalOrders: number;
      totalWishlistItems: number;
    };
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
                <Badge className={getRoleColor(user.role)}>{user.role}</Badge>
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
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
                <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
                <TabsTrigger value="cart">Cart</TabsTrigger>
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
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-md">
                          <CreditCard className="h-8 w-8 text-purple mb-2" />
                          <p className="text-2xl font-bold">
                            ${userDetails.stats.totalSpent.toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Total Spent
                          </p>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-md">
                          <ShoppingBag className="h-8 w-8 text-purple mb-2" />
                          <p className="text-2xl font-bold">
                            {userDetails.stats.totalOrders}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Orders
                          </p>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-md">
                          <Heart className="h-8 w-8 text-purple mb-2" />
                          <p className="text-2xl font-bold">
                            {userDetails.stats.totalWishlistItems}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Wishlist Items
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
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userDetails.orders.map((order: any) => (
                            <TableRow key={order.id}>
                              <TableCell>#{order.id}</TableCell>
                              <TableCell>
                                {format(new Date(order.createdAt), "PP")}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    order.status === "completed"
                                      ? "default"
                                      : "outline"
                                  }
                                >
                                  {order.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{order.items.length} items</TableCell>
                              <TableCell>
                                ${order.totalAmount.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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
                          <div key={item.id} className="border rounded-md p-4">
                            <h4 className="font-medium">{item.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              ${item.price.toFixed(2)}
                            </p>
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
                    <div className="text-center py-8 text-gray-500">
                      <ShoppingCart className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                      <p>Cart information not available</p>
                    </div>
                  </CardContent>
                </Card>
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
