import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AuthContext } from "@/context/AuthContext";
import { useContext } from "react";
import FirestoreUserTable from "@/components/admin/tables/FirestoreUserTable";
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
import { Loader2, Search, RefreshCw } from "lucide-react";
import { getAllFirestoreUsers, type FirestoreUser } from "@/lib/firestoreUsers";
import { useToast } from "@/hooks/use-toast";

export default function FirestoreUsers() {
  const auth = useContext(AuthContext);
  const { user, isLoading } = auth;
  const isAdmin = user?.role === "admin";
  const isAuthenticated = !!user;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("all");
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [refreshKey, setRefreshKey] = useState(0); // Used to trigger refreshes
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Redirect if not admin
  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, isAuthenticated, navigate]);
  
  // Fetch users directly from Firestore
  useEffect(() => {
    const fetchUsers = async () => {
      if (!isAdmin || !isAuthenticated) return;
      
      try {
        setIsLoadingUsers(true);
        const firestoreUsers = await getAllFirestoreUsers();
        setUsers(firestoreUsers);
      } catch (error) {
        console.error("Error fetching Firestore users:", error);
        toast({
          title: "Error",
          description: "Failed to load users from Firestore",
          variant: "destructive",
        });
      } finally {
        setIsLoadingUsers(false);
        setIsRefreshing(false);
      }
    };
    
    fetchUsers();
  }, [isAdmin, isAuthenticated, toast, refreshKey]);
  
  // Filter users
  const filteredUsers = users.filter(user => {
    let match = true;
    
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const username = (user.username || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const displayName = (user.displayName || '').toLowerCase();
      
      match = username.includes(searchLower) || 
              email.includes(searchLower) || 
              displayName.includes(searchLower);
    }
    
    if (match && roleFilter && roleFilter !== 'all') {
      match = user.role === roleFilter;
    }
    
    return match;
  });
  
  // Items per page
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to first page on new search
  };
  
  const handleRoleChange = (value: string) => {
    setRoleFilter(value);
    setPage(1);
  };
  
  const handleClearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setPage(1);
  };
  
  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey(prev => prev + 1); // This will trigger the useEffect to fetch data again
  };
  
  // Callback when a role is updated
  const handleRoleUpdate = () => {
    // Wait a moment and then refresh the data to show updated roles
    setTimeout(() => {
      handleRefresh();
    }, 500);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-playfair font-bold tracking-tight">Firestore Users</h2>
          <p className="text-muted-foreground">
            Manage users and permissions directly from Firestore database
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" disabled={isRefreshing}>
          {isRefreshing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </>
          )}
        </Button>
      </div>
      
      <div className="rounded-md border">
        <div className="flex flex-col md:flex-row gap-4 p-4 items-end">
          <div className="flex-1">
            <form onSubmit={handleSearch} className="flex w-full max-w-sm space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
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
              <Select value={roleFilter} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          </div>
        </div>
        
        {isLoadingUsers ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            <span className="ml-2">Loading users from Firestore...</span>
          </div>
        ) : (
          <>
            <FirestoreUserTable 
              users={paginatedUsers} 
              onRoleUpdate={handleRoleUpdate}
            />
            
            {totalPages > 1 && (
              <div className="p-4 border-t">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => page > 1 && setPage(page - 1)}
                        className={page <= 1 ? "pointer-events-none opacity-50" : ""}
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
                        onClick={() => page < totalPages && setPage(page + 1)}
                        className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>
      
      <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
        <h3 className="font-medium text-amber-800">Database Source</h3>
        <p className="text-amber-700 text-sm mt-1">
          This page retrieves user data directly from Firebase Firestore database. Role changes are made directly to the Firestore user documents.
        </p>
      </div>
    </div>
  );
}