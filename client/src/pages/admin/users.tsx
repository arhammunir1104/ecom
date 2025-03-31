import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import UserTable from "@/components/admin/tables/UserTable";
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
import { Loader2, Search } from "lucide-react";

export default function AdminUsers() {
  const { isAdmin, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("");
  
  // Redirect if not admin
  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, isAuthenticated, navigate]);
  
  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    enabled: isAdmin && isAuthenticated,
  });
  
  // Filter users
  const filteredUsers = users?.filter(user => {
    let match = true;
    
    if (searchQuery) {
      match = user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
              user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (user.fullName && user.fullName.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    if (match && roleFilter && roleFilter !== 'all') {
      match = user.role === roleFilter;
    }
    
    return match;
  }) || [];
  
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
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-playfair font-bold tracking-tight">Users</h2>
        <p className="text-muted-foreground">
          Manage users and permissions
        </p>
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
        
        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-purple" />
          </div>
        ) : (
          <>
            <UserTable users={paginatedUsers} />
            
            {totalPages > 1 && (
              <div className="p-4 border-t">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                        disabled={page === 1}
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
                        onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={page === totalPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
