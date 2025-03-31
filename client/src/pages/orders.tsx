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
import { useToast } from "@/hooks/use-toast";
import { Download, Truck, CheckCircle, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { generateInvoice } from "@/utils/invoiceGenerator";
import type { InvoiceItem, ShippingAddress, OrderData } from "@/utils/invoiceGenerator";

// Firebase imports
import { collection, getDocs, query, orderBy, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { apiRequest } from "@/lib/queryClient";

const Orders = () => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [combinedOrders, setCombinedOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Fetch all orders (from both API and Firestore)
  const fetchAllOrders = async () => {
    try {
      setIsLoading(true);
      const allOrders = [];
      
      // 1. Try to get Firebase UID
      const uid = window.localStorage.getItem('firebaseUid') || user?.uid;
      
      if (uid) {
        console.log('Fetching orders for Firebase UID:', uid);
        
        try {
          // 2. Fetch from top-level 'orders' collection
          const ordersRef = collection(db, 'orders');
          const q = query(ordersRef, where('userId', '==', uid), orderBy('orderDate', 'desc'));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            console.log(`Found ${querySnapshot.docs.length} orders in top-level collection`);
            
            const firebaseOrders = querySnapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                // Convert Firestore Timestamp to Date
                createdAt: data.createdAt?.toDate() || data.orderDate?.toDate() || new Date(),
                orderDate: data.orderDate?.toDate() || data.createdAt?.toDate() || new Date(),
                source: 'firebase'
              };
            });
            
            allOrders.push(...firebaseOrders);
          } else {
            console.log('No orders found in top-level collection');
          }
          
          // 3. Also try user subcollection path as fallback
          const userOrdersRef = collection(db, 'users', uid, 'orders');
          const userOrdersQuery = query(userOrdersRef, orderBy('createdAt', 'desc'));
          const userOrdersSnapshot = await getDocs(userOrdersQuery);
          
          if (!userOrdersSnapshot.empty) {
            console.log(`Found ${userOrdersSnapshot.docs.length} orders in user subcollection`);
            
            const userOrders = userOrdersSnapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                // Convert Firestore Timestamp to Date
                createdAt: data.createdAt?.toDate() || data.orderDate?.toDate() || new Date(),
                orderDate: data.orderDate?.toDate() || data.createdAt?.toDate() || new Date(),
                source: 'firebase-user'
              };
            });
            
            // Only add orders that aren't already in the array (by ID)
            const existingIds = allOrders.map(o => o.id);
            const newUserOrders = userOrders.filter(o => !existingIds.includes(o.id));
            
            allOrders.push(...newUserOrders);
          }
        } catch (firebaseError) {
          console.error('Error fetching from Firebase:', firebaseError);
        }
      }
      
      // 4. Also fetch from API
      try {
        const response = await apiRequest('GET', '/api/orders');
        if (response.ok) {
          const apiOrders = await response.json();
          
          if (Array.isArray(apiOrders) && apiOrders.length > 0) {
            console.log(`Found ${apiOrders.length} orders from API`);
            
            // Format API orders and add source
            const formattedApiOrders = apiOrders.map(order => ({
              ...order,
              source: 'api',
              // Ensure dates are Date objects
              createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
              orderDate: order.orderDate ? new Date(order.orderDate) : order.createdAt ? new Date(order.createdAt) : new Date()
            }));
            
            // Only add orders that aren't already in the array (by ID)
            const existingIds = allOrders.map(o => o.id);
            const newApiOrders = formattedApiOrders.filter(o => !existingIds.includes(o.id));
            
            allOrders.push(...newApiOrders);
          }
        }
      } catch (apiError) {
        console.error('Error fetching from API:', apiError);
      }
      
      // Sort all orders by date (newest first)
      allOrders.sort((a, b) => {
        const dateA = a.orderDate || a.createdAt;
        const dateB = b.orderDate || b.createdAt;
        return dateB.getTime() - dateA.getTime();
      });
      
      console.log('Combined orders:', allOrders);
      setCombinedOrders(allOrders);
    } catch (error) {
      console.error('Error fetching all orders:', error);
      toast({
        title: 'Error fetching orders',
        description: 'An error occurred while fetching your orders.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  // Fetch orders when component mounts or authentication changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchAllOrders();
    }
  }, [isAuthenticated]);
  
  // Refresh orders
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchAllOrders();
  };
  
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
  
  const filterOrders = (orders: any[] | undefined, filter: string) => {
    if (!orders || !Array.isArray(orders)) return [];
    if (filter === "all") return orders;
    return orders.filter(order => order.status === filter || order.status?.toLowerCase() === filter.toLowerCase());
  };
  
  const filteredOrders = filterOrders(combinedOrders, activeTab);
  
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-playfair font-bold">My Orders</h1>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
      
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
                            try {
                              // Ensure all required fields have values to avoid errors
                              const safeItems = Array.isArray(order.items) 
                                ? (order.items as any[]).map(item => ({
                                    name: item.name || 'Product',
                                    price: parseFloat(String(item.price)) || 0,
                                    quantity: parseInt(String(item.quantity)) || 1,
                                    productId: item.productId || '0',
                                    image: item.image || ''
                                  }))
                                : [];
                              
                              // Ensure shipping address has all required fields
                              let safeShippingAddress: ShippingAddress;
                              
                              if (typeof order.shippingAddress === 'object' && order.shippingAddress !== null) {
                                const sa = order.shippingAddress as any;
                                safeShippingAddress = {
                                  fullName: sa.fullName || 'Customer',
                                  address: sa.address || 'Address not provided',
                                  city: sa.city || 'City not provided',
                                  state: sa.state || 'State not provided',
                                  postalCode: sa.postalCode || '00000',
                                  country: sa.country || 'Country not provided',
                                  phone: sa.phone || 'Phone not provided'
                                };
                              } else {
                                safeShippingAddress = {
                                  fullName: 'Customer',
                                  address: 'Address not provided',
                                  city: 'City not provided',
                                  state: 'State not provided',
                                  postalCode: '00000',
                                  country: 'Country not provided',
                                  phone: 'Phone not provided'
                                };
                              }
                              
                              const orderData: OrderData = {
                                id: order.id || 'unknown',
                                items: safeItems,
                                totalAmount: parseFloat(String(order.totalAmount)) || 0,
                                shippingAddress: safeShippingAddress,
                                createdAt: order.createdAt || new Date(),
                                status: order.status || 'processing',
                                paymentStatus: order.paymentStatus || 'paid',
                                trackingNumber: order.trackingNumber || null
                              };
                              
                              const { download } = generateInvoice(orderData);
                              download();
                            } catch (error) {
                              console.error('Error generating invoice:', error);
                              toast({
                                title: 'Invoice Error',
                                description: 'There was a problem generating your invoice. Please try again.',
                                variant: 'destructive'
                              });
                            }
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
                                  Qty: {item.quantity} x ${item.price ? Number(item.price).toFixed(2) : '0.00'}
                                </p>
                                {item.size && <p className="text-xs text-gray-500">Size: {item.size}</p>}
                                {item.color && <p className="text-xs text-gray-500">Color: {item.color}</p>}
                              </div>
                            </div>
                            <p className="font-medium">
                              ${(Number(item.quantity) * Number(item.price || 0)).toFixed(2)}
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
