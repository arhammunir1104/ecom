import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Tags, 
  Users, 
  Image, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ShoppingCart,
  Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [location] = useLocation();
  const { user, logout, isLoading } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Redirect to home if authenticated but not admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      console.log("User is not an admin, redirecting to home page");
      window.location.href = "/";
    } else if (!user && !isLoading) {
      console.log("User is not authenticated, redirecting to login page");
      window.location.href = "/login";
    }
  }, [user, isLoading]);

  const navigation = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Products", href: "/admin/products", icon: ShoppingBag },
    { name: "Categories", href: "/admin/categories", icon: Tags },
    { name: "Orders", href: "/admin/orders", icon: ShoppingCart },
    { name: "Users", href: "/admin/users", icon: Users },
    { name: "Firestore Users", href: "/admin/firestore-users", icon: Database },
    { name: "Hero Banners", href: "/admin/hero-banners", icon: Image },
  ];

  const NavLinks = () => (
    <>
      <div className="space-y-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            Admin Dashboard
          </h2>
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link 
                  key={item.name} 
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start"
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-auto p-4">
        <Button 
          variant="ghost" 
          className="w-full justify-start" 
          onClick={() => logout()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar for desktop */}
      <aside className="hidden border-r bg-muted/40 lg:block lg:w-64">
        <ScrollArea className="flex h-full flex-col py-4">
          <div className="flex h-full flex-col">
            <NavLinks />
          </div>
        </ScrollArea>
      </aside>

      {/* Mobile sidebar with trigger */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="lg:hidden">
          <ScrollArea className="flex h-full flex-col py-4">
            <div className="flex h-full flex-col">
              <NavLinks />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-col w-full">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6 lg:px-8">
          <Button 
            variant="outline" 
            size="icon" 
            className="lg:hidden"
            onClick={() => setIsMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Feminine Elegance Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              {user && (
                <span className="text-sm text-muted-foreground">
                  Logged in as {user.email}
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
