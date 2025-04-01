import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Timestamp, collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import OrderTable from "@/components/admin/tables/OrderTable";
import { Loader2 } from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { getOrderDetails } from "@/lib/firebaseService";

interface OrderItem {
  productId: string | number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  subtotal: number;
}

interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  shippingAddress: {
    fullName: string;
    addressLine1?: string;
    address?: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  paymentMethod?: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentIntent?: string;
  orderDate: Date;
  trackingNumber?: string | null;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const AdminOrders = () => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  // Filter orders based on active tab
  const filteredOrders = orders.filter(order => {
    if (activeTab === "all") return true;
    return order.status === activeTab;
  });

  // Count orders by status
  const orderCounts = {
    all: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length
  };

  // Get total revenue
  const totalRevenue = orders
    .filter(o => o.paymentStatus === 'paid')
    .reduce((sum, order) => sum + order.totalAmount, 0);

  // Get orders that need attention (pending or processing)
  const ordersNeedingAttention = orders.filter(
    o => o.status === 'pending' || o.status === 'processing'
  ).length;

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        
        // Try to fetch orders from API endpoint
        console.log('Fetching orders from API endpoint...');
        const response = await apiRequest('GET', '/api/admin/orders');
        
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        
        const ordersData = await response.json();
        console.log(`Found ${ordersData.length} orders from API`);
        
        // Process the orders data to ensure dates are Date objects
        const processedOrders = ordersData.map((order: any) => {
          return {
            ...order,
            // Ensure dates are Date objects
            orderDate: order.orderDate ? new Date(order.orderDate) : new Date(),
            createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
            updatedAt: order.updatedAt ? new Date(order.updatedAt) : undefined
          } as Order;
        });
        
        setOrders(processedOrders);
      } catch (error) {
        console.error('Error fetching orders:', error);
        
        // Fallback to Firebase if API fails
        try {
          console.log('Falling back to Firebase...');
          // Fetch from the main orders collection
          const ordersRef = collection(db, 'orders');
          const ordersQuery = query(ordersRef);
          const snapshot = await getDocs(ordersQuery);
          
          if (snapshot.empty) {
            console.log('No orders found in Firebase');
            setOrders([]);
            return;
          }
          
          console.log(`Found ${snapshot.docs.length} orders from Firebase`);
          
          const ordersData = snapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              // Convert Firebase Timestamp to Date for easier handling
              orderDate: data.orderDate instanceof Timestamp 
                ? data.orderDate.toDate() 
                : new Date(data.orderDate),
              createdAt: data.createdAt instanceof Timestamp 
                ? data.createdAt.toDate() 
                : new Date(data.createdAt),
              updatedAt: data.updatedAt instanceof Timestamp 
                ? data.updatedAt.toDate() 
                : new Date(data.updatedAt)
            } as Order;
          });
          
          setOrders(ordersData);
        } catch (fbError) {
          console.error('Firebase fallback also failed:', fbError);
          toast({
            title: "Error",
            description: "Failed to load orders from any source. Please try again.",
            variant: "destructive",
          });
          setOrders([]);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, [toast]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Order Management</h2>
        <p className="text-muted-foreground">
          View and manage customer orders
        </p>
      </div>
      
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Orders
            </CardTitle>
            <div className="h-4 w-4 bg-blue-500 rounded-full" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderCounts.all}</div>
            <p className="text-xs text-muted-foreground">
              All time orders
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Revenue
            </CardTitle>
            <div className="h-4 w-4 bg-green-500 rounded-full" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              From completed orders
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Need Attention
            </CardTitle>
            <div className="h-4 w-4 bg-yellow-500 rounded-full" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ordersNeedingAttention}
            </div>
            <p className="text-xs text-muted-foreground">
              Orders in pending or processing
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed Orders
            </CardTitle>
            <div className="h-4 w-4 bg-purple-500 rounded-full" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orderCounts.delivered}
            </div>
            <p className="text-xs text-muted-foreground">
              Successfully delivered
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Orders Table with Tabs */}
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">
            All Orders ({orderCounts.all})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({orderCounts.pending})
          </TabsTrigger>
          <TabsTrigger value="processing">
            Processing ({orderCounts.processing})
          </TabsTrigger>
          <TabsTrigger value="shipped">
            Shipped ({orderCounts.shipped})
          </TabsTrigger>
          <TabsTrigger value="delivered">
            Delivered ({orderCounts.delivered})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled ({orderCounts.cancelled})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Orders</CardTitle>
              <CardDescription>
                {activeTab === 'all' 
                  ? 'Showing all orders' 
                  : `Showing orders with status: ${activeTab}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[200px] w-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredOrders.length > 0 ? (
                <OrderTable orders={filteredOrders} />
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  No orders found for this status
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminOrders;