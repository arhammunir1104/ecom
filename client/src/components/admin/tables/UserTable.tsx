import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { User, ShoppingBag, Mail, MoreHorizontal, ShieldCheck, Shield, Ban } from "lucide-react";
import { format } from "date-fns";

interface UserTableProps {
  users: any[];
}

const UserTable = ({ users }: UserTableProps) => {
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showOrdersDialog, setShowOrdersDialog] = useState(false);
  
  const openOrdersDialog = (user: any) => {
    setSelectedUser(user);
    setShowOrdersDialog(true);
  };
  
  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple text-white";
      case "user":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  
  const getInitials = (user: any) => {
    if (user.fullName) {
      return user.fullName.split(' ').map((name: string) => name[0]).join('').toUpperCase();
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
                    {/* We don't have real avatar URLs, so we're using initials instead */}
                    <AvatarFallback className="bg-gray-100 text-gray-500">
                      {getInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{user.fullName || user.username}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={getRoleColor(user.role)}>
                  {user.role}
                </Badge>
              </TableCell>
              <TableCell>
                {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "N/A"}
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
                {/* This would come from real order data */}
                ${(Math.floor(Math.random() * 1000) + 50).toFixed(2)}
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
                    <DropdownMenuItem onClick={() => window.location.href = `mailto:${user.email}`}>
                      <Mail className="mr-2 h-4 w-4" />
                      Email User
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <User className="mr-2 h-4 w-4" />
                      View Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {user.role === "user" ? (
                      <DropdownMenuItem>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Make Admin
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem>
                        <Shield className="mr-2 h-4 w-4" />
                        Remove Admin
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="text-red-600">
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
            <DialogTitle>Orders for {selectedUser?.fullName || selectedUser?.username}</DialogTitle>
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
              <Button onClick={() => setShowOrdersDialog(false)} variant="outline">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserTable;
