import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
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
import { Skeleton } from "@/components/ui/skeleton";
import SalesChart from "@/components/admin/charts/SalesChart";
import ProductsChart from "@/components/admin/charts/ProductsChart";
import {
  DollarSign,
  Users,
  ShoppingBag,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from "lucide-react";

export default function AdminDashboard() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const isAuthenticated = !!user;
  
  // We handle redirects in the AdminLayout component now
  
  // Define the type for dashboard data
  interface DashboardData {
    totalRevenue: number;
    totalOrders: number;
    totalUsers: number;
    totalProducts: number;
    recentOrders: {
      id: number;
      status: string;
      totalAmount: number;
      createdAt: string;
    }[];
    topProducts: {
      product: {
        id: number;
        name: string;
        price: number;
        images?: string[];
      };
      soldCount: number;
    }[];
  }

  // Default dashboard data to handle null/undefined values
  const defaultDashboardData: DashboardData = {
    totalRevenue: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalProducts: 0,
    recentOrders: [],
    topProducts: []
  };

  const { data: dashboardData = defaultDashboardData, isLoading: dataLoading } = useQuery<DashboardData>({
    queryKey: ["/api/admin/dashboard"],
    enabled: isAdmin && isAuthenticated,
  });
  
  if (authLoading || dataLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <Skeleton className="h-4 w-24" />
                </CardTitle>
                <Skeleton className="h-8 w-8 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-1" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  const metrics = [
    {
      title: "Total Revenue",
      value: `$${dashboardData.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      change: "+12.5%",
      trend: "up",
    },
    {
      title: "Total Orders",
      value: dashboardData.totalOrders,
      icon: ShoppingBag,
      change: "+7.2%",
      trend: "up",
    },
    {
      title: "Total Customers",
      value: dashboardData.totalUsers,
      icon: Users,
      change: "+4.6%",
      trend: "up",
    },
    {
      title: "Total Products",
      value: dashboardData.totalProducts,
      icon: Package,
      change: "+2.3%",
      trend: "up",
    },
  ];
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-playfair font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of your store performance and analytics
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground flex items-center">
                {metric.trend === "up" ? (
                  <ArrowUpRight className="mr-1 h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDownRight className="mr-1 h-3 w-3 text-red-500" />
                )}
                <span className={metric.trend === "up" ? "text-green-500" : "text-red-500"}>
                  {metric.change}
                </span>
                {" "}from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Revenue Overview</CardTitle>
                <CardDescription>
                  Monthly revenue for the current year
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <SalesChart />
              </CardContent>
            </Card>
            
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Top Selling Products</CardTitle>
                <CardDescription>
                  Most popular products by sales volume
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProductsChart />
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>
                  Latest orders placed in your store
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardData.recentOrders.length > 0 ? (
                    dashboardData.recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between border-b pb-4">
                        <div>
                          <p className="font-medium">Order #{order.id}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <p className="font-medium">${order.totalAmount.toFixed(2)}</p>
                          <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                            order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground">No recent orders</p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Product Analytics</CardTitle>
                <CardDescription>
                  Insights about your products
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardData.topProducts.length > 0 ? (
                    dashboardData.topProducts.map((item) => (
                      <div key={item.product.id} className="flex items-center justify-between border-b pb-4">
                        <div className="flex items-center">
                          {item.product.images && item.product.images[0] && (
                            <div className="w-12 h-12 rounded-md overflow-hidden mr-3">
                              <img 
                                src={item.product.images[0]} 
                                alt={item.product.name} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{item.product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              ${item.product.price.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <BarChart3 className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{item.soldCount} sold</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground">No product data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="analytics" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Sales Analytics</CardTitle>
              <CardDescription>
                Detailed breakdown of your sales
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <SalesChart />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Traffic Sources</CardTitle>
              <CardDescription>
                Where your customers are coming from
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {["Direct", "Organic Search", "Social Media", "Referral", "Email"].map((source, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 bg-chart-${i + 1}`}></div>
                      <span>{source}</span>
                    </div>
                    <span>{Math.floor(Math.random() * 50) + 10}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Generate Reports</CardTitle>
              <CardDescription>
                Create custom reports based on your store data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center py-8">
                Report generation feature coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
