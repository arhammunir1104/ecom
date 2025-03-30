import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Order } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Truck, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { generateInvoice } from "@/utils/invoiceGenerator";
import type { InvoiceItem, ShippingAddress, OrderData } from "@/utils/invoiceGenerator";

// Firebase imports
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

const Orders = () => {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [firestoreOrders, setFirestoreOrders] = useState<any[]>([]);
  const [isFirestoreLoading, setIsFirestoreLoading] = useState(true);
  
  // Fetch from API (kept for backward compatibility)
  const { data: apiOrders, isLoading: isApiLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: isAuthenticated,
  });
  
  // Fetch orders from Firestore
  useEffect(() => {
    async function fetchOrders() {
      try {
        setIsFirestoreLoading(true);
        const uid = window.localStorage.getItem('firebaseUid');
        
        if (uid) {
          const ordersRef = collection(db, 'users', uid, 'orders');
          const q = query(ordersRef, orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(q);
          
          const orders = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Convert Firestore Timestamp to Date
            createdAt: doc.data().createdAt?.toDate() || new Date(),
          }));
          
          setFirestoreOrders(orders);
          console.log('Fetched orders from Firestore:', orders);
        }
      } catch (error) {
        console.error('Error fetching orders from Firestore:', error);
      } finally {
        setIsFirestoreLoading(false);
      }
    }
    
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated]);
  
  // Combine orders from both sources, prioritizing Firestore orders
  const orders = firestoreOrders.length > 0 ? firestoreOrders : apiOrders;
  const isLoading = isApiLoading && isFirestoreLoading;
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "processing":
        return <Clock className="h-4 w-4 text-orange-500" />;
      case "shipped":
        return <Truck className="h-4 w-4 text-blue-500" />;
      case "delivered":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "cancelled":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case "processing":
        return "bg-orange-100 text-orange-800";
      case "shipped":
        return "bg-blue-100 text-blue-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  
  const filterOrders = (orders: Order[] | undefined, filter: string) => {
    if (!orders) return [];
    if (filter === "all") return orders;
    return orders.filter(order => order.status === filter);
  };
  
  const filteredOrders = filterOrders(orders, activeTab);
  
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <h2 className="text-2xl font-playfair font-bold mb-2">Please Sign In</h2>
            <p className="text-gray-500 mb-6">You need to be signed in to view your orders.</p>
            <Button asChild>
              <a href="/login">Sign In</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-playfair font-bold mb-8">My Orders</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Orders</TabsTrigger>
          <TabsTrigger value="processing">Processing</TabsTrigger>
          <TabsTrigger value="shipped">Shipped</TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab}>
          {isLoading ? (
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <Card key={index}>
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="space-y-6">
              {filteredOrders.map((order) => (
                <Card key={order.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                      <div>
                        <CardTitle className="text-lg">Order #{order.id}</CardTitle>
                        <p className="text-sm text-gray-500">
                          Placed on {format(new Date(order.createdAt), "MMMM d, yyyy")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(order.status || 'processing')}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(order.status || 'processing')}
                            {(order.status || 'processing').charAt(0).toUpperCase() + (order.status || 'processing').slice(1)}
                          </span>
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const orderData: OrderData = {
                              id: order.id,
                              items: Array.isArray(order.items) ? order.items as InvoiceItem[] : [],
                              shippingAddress: typeof order.shippingAddress === 'object' 
                                ? order.shippingAddress as ShippingAddress 
                                : {
                                    fullName: 'Customer',
                                    address: '123 Main St',
                                    city: 'New York',
                                    state: 'NY',
                                    postalCode: '10001',
                                    country: 'USA',
                                    phone: '555-1234'
                                  },
                              totalAmount: order.totalAmount || 0,
                              createdAt: order.createdAt,
                              status: order.status || 'processing',
                              paymentStatus: order.paymentStatus || 'paid',
                              trackingNumber: order.trackingNumber || null
                            };
                            const { download } = generateInvoice(orderData);
                            download();
                          }}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Invoice
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Order items */}
                      <div className="space-y-3">
                        {(order.items as any[]).map((item, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              {item.image && (
                                <div className="w-16 h-16 rounded-md overflow-hidden">
                                  <img 
                                    src={item.image} 
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-gray-500">
                                  Qty: {item.quantity} x ${item.price ? item.price.toFixed(2) : '0.00'}
                                </p>
                              </div>
                            </div>
                            <p className="font-medium">
                              ${(item.quantity * (item.price || 0)).toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                      
                      <Separator />
                      
                      {/* Order totals */}
                      <div className="flex justify-between font-medium">
                        <span>Total</span>
                        <span className="text-purple">${(order.totalAmount || 0).toFixed(2)}</span>
                      </div>
                      
                      {/* Tracking details */}
                      {(order.status === "shipped" || order.status === "delivered") && order.trackingNumber && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-md">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">Tracking Number:</span>
                            <span>{order.trackingNumber}</span>
                          </div>
                          <Button variant="link" className="p-0 h-auto text-blue-600 mt-1">
                            Track Package
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No orders found</p>
              <Button asChild>
                <a href="/shop">Continue Shopping</a>
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Orders;
