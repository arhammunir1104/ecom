import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type FirestoreUser } from "@/lib/firestoreUsers";
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
} from "lucide-react";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";
import { apiRequest } from "@/lib/queryClient";

interface FirestoreUserTableProps {
  users: FirestoreUser[];
  isLoading?: boolean;
  onRoleUpdate?: () => void;
}

const FirestoreUserTable = ({ users, isLoading = false, onRoleUpdate }: FirestoreUserTableProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<FirestoreUser | null>(null);
  const [showOrdersDialog, setShowOrdersDialog] = useState(false);

  // State to track Firebase update status
  const [updatingUserIds, setUpdatingUserIds] = useState<string[]>([]);
  
  // Mutation for updating user role with synchronization across databases
  const updateRoleMutation = useMutation({
    mutationFn: async ({ uid, role }: { uid: string; role: "admin" | "user" }) => {
      try {
        setUpdatingUserIds((prev) => [...prev, uid]);
        
        // Use our new API endpoint to sync the role across both databases
        const response = await apiRequest("POST", "/api/sync-user-role", {
          firebaseUid: uid,
          role
        });
        
        // Parse response to check for errors
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || "Failed to update user role");
        }
        
        if (!data.success) {
          throw new Error(data.message || "Failed to update user role");
        }
        
        return { uid, role };
      } catch (error) {
        console.error("Error updating role:", error);
        throw error;
      } finally {
        setUpdatingUserIds((prev) => prev.filter(id => id !== uid));
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Role synchronized",
        description: `User role has been updated to ${data.role} across all databases`,
      });

      // Trigger any custom callback
      if (onRoleUpdate) {
        onRoleUpdate();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error updating role",
        description: error.message || "An error occurred while updating user role",
        variant: "destructive",
      });
    },
  });

  const handleUpdateRole = (uid: string, role: "admin" | "user") => {
    updateRoleMutation.mutate({ uid, role });
  };

  const openOrdersDialog = (user: FirestoreUser) => {
    setSelectedUser(user);
    setShowOrdersDialog(true);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800";
      case "user":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getInitials = (user: FirestoreUser) => {
    if (user.displayName) {
      return user.displayName
        .split(" ")
        .map((name: string) => name[0])
        .join("")
        .toUpperCase();
    }
    if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    return user.email?.substring(0, 2).toUpperCase() || "??";
  };

  const formatDate = (timestamp: Timestamp | Date | undefined) => {
    if (!timestamp) return "N/A";
    
    let date: Date;
    if (timestamp instanceof Timestamp) {
      date = timestamp.toDate();
    } else {
      date = timestamp;
    }
    
    return format(date, "MMM d, yyyy");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Orders</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                No users found
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.uid}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      {user.photoURL ? (
                        <AvatarImage src={user.photoURL} alt={user.displayName || user.email} />
                      ) : (
                        <AvatarFallback className="bg-gray-100 text-gray-500">
                          {getInitials(user)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {user.displayName || user.username || user.email}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={getRoleColor(user.role || "user")}>
                    {user.role || "user"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {formatDate(user.createdAt)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-purple-500"
                    onClick={() => openOrdersDialog(user)}
                  >
                    <ShoppingBag className="mr-1 h-4 w-4" />
                    View Orders
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
                      <DropdownMenuSeparator />
                      {user.role !== "admin" ? (
                        <DropdownMenuItem
                          onClick={() => handleUpdateRole(user.uid, "admin")}
                          disabled={updatingUserIds.includes(user.uid)}
                        >
                          {updatingUserIds.includes(user.uid) ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="mr-2 h-4 w-4" />
                              Make Admin
                            </>
                          )}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => handleUpdateRole(user.uid, "user")}
                          disabled={updatingUserIds.includes(user.uid)}
                        >
                          {updatingUserIds.includes(user.uid) ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <Shield className="mr-2 h-4 w-4" />
                              Remove Admin
                            </>
                          )}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-red-600"
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
            ))
          )}
        </TableBody>
      </Table>

      {/* User orders dialog */}
      <Dialog open={showOrdersDialog} onOpenChange={setShowOrdersDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Orders for {selectedUser?.displayName || selectedUser?.username || selectedUser?.email}
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
    </>
  );
};

export default FirestoreUserTable;