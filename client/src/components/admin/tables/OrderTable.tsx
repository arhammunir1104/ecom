import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Eye, 
  MoreHorizontal, 
  Truck, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Package, 
  Loader2,
  RotateCw
} from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { updateOrderStatus } from "@/lib/firebaseService";

// Define Order interface based on Firebase Order type
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

interface OrderTableProps {
  orders: Order[];
}

const OrderTable = ({ orders }: OrderTableProps) => {
  const { toast } = useToast();
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [viewOrderDetails, setViewOrderDetails] = useState<Order | null>(null);

  const formatAddress = (address: Order['shippingAddress']) => {
    const addressLine = address.addressLine1 || address.address || '';
    return `${addressLine}${address.addressLine2 ? ', ' + address.addressLine2 : ''}, ${address.city}, ${address.state} ${address.postalCode}, ${address.country}`;
  };

  const getStatusBadgeColor = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <Clock className="mr-1 h-3 w-3" /> Pending
        </Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <RotateCw className="mr-1 h-3 w-3" /> Processing
        </Badge>;
      case 'shipped':
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
          <Truck className="mr-1 h-3 w-3" /> Shipped
        </Badge>;
      case 'delivered':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="mr-1 h-3 w-3" /> Delivered
        </Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <XCircle className="mr-1 h-3 w-3" /> Cancelled
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: Order['paymentStatus']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Pending</Badge>;
      case 'paid':
        return <Badge variant="outline" className="bg-green-50 text-green-700">Paid</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-50 text-red-700">Failed</Badge>;
      case 'refunded':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700">Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleUpdateStatus = async (order: Order, newStatus: Order['status']) => {
    setIsUpdatingId(order.id);
    try {
      // First try to update via API endpoint
      try {
        console.log(`Updating order ${order.id} status to ${newStatus} via API`);
        const response = await apiRequest("PUT", `/api/admin/orders/${order.id}/status`, { 
          status: newStatus 
        });
        
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        
        console.log('Order status updated successfully via API');
      } catch (apiError) {
        console.error("Error updating order in API:", apiError);
        
        // Fallback to Firebase direct update if API fails
        console.log('Falling back to Firebase direct update');
        await updateOrderStatus(order.id, newStatus);
        console.log('Order status updated successfully via Firebase');
      }
      
      // Invalidate queries to refresh order lists
      queryClient.invalidateQueries({ queryKey: ['/api/admin/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      
      toast({
        title: "Order Updated",
        description: `Order #${order.id.slice(0, 8)} status changed to ${newStatus}`,
      });
      
      setSelectedOrder(null);
    } catch (error: any) {
      console.error('Failed to update order status:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update order status",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingId(null);
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Order ID</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">
                #{typeof order.id === 'string' ? order.id.slice(0, 8) : order.id}
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{order.shippingAddress.fullName}</div>
                  <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {order.shippingAddress.phone}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {order.orderDate ? format(new Date(order.orderDate), 'MMM dd, yyyy') : 'N/A'}
              </TableCell>
              <TableCell>${order.totalAmount.toFixed(2)}</TableCell>
              <TableCell>
                {getStatusBadgeColor(order.status)}
              </TableCell>
              <TableCell>
                {getPaymentStatusBadge(order.paymentStatus)}
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
                    <DropdownMenuItem onClick={() => setViewOrderDetails(order)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                    {order.status !== 'pending' && (
                      <DropdownMenuItem onClick={() => setSelectedOrder({...order, status: 'pending'})}>
                        <Clock className="mr-2 h-4 w-4" />
                        Set as Pending
                      </DropdownMenuItem>
                    )}
                    {order.status !== 'processing' && (
                      <DropdownMenuItem onClick={() => setSelectedOrder({...order, status: 'processing'})}>
                        <RotateCw className="mr-2 h-4 w-4" />
                        Set as Processing
                      </DropdownMenuItem>
                    )}
                    {order.status !== 'shipped' && (
                      <DropdownMenuItem onClick={() => setSelectedOrder({...order, status: 'shipped'})}>
                        <Truck className="mr-2 h-4 w-4" />
                        Set as Shipped
                      </DropdownMenuItem>
                    )}
                    {order.status !== 'delivered' && (
                      <DropdownMenuItem onClick={() => setSelectedOrder({...order, status: 'delivered'})}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Set as Delivered
                      </DropdownMenuItem>
                    )}
                    {order.status !== 'cancelled' && (
                      <DropdownMenuItem onClick={() => setSelectedOrder({...order, status: 'cancelled'})}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Set as Cancelled
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Status Update Confirmation Dialog */}
      <AlertDialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Order Status</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change order #{typeof selectedOrder?.id === 'string' ? selectedOrder.id.slice(0, 8) : selectedOrder?.id} status to {selectedOrder?.status}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedOrder && handleUpdateStatus(selectedOrder, selectedOrder.status)}
              disabled={isUpdatingId === selectedOrder?.id}
            >
              {isUpdatingId === selectedOrder?.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Confirm"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Details Dialog */}
      <Dialog open={!!viewOrderDetails} onOpenChange={(open) => !open && setViewOrderDetails(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details #{typeof viewOrderDetails?.id === 'string' ? viewOrderDetails.id.slice(0, 8) : viewOrderDetails?.id}</DialogTitle>
          </DialogHeader>
          
          {viewOrderDetails && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Order Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-muted-foreground">Status:</span>
                        <span className="col-span-2">{getStatusBadgeColor(viewOrderDetails.status)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 mt-1">
                        <span className="text-muted-foreground">Payment:</span>
                        <span className="col-span-2">{getPaymentStatusBadge(viewOrderDetails.paymentStatus)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 mt-1">
                        <span className="text-muted-foreground">Date:</span>
                        <span className="col-span-2">
                          {viewOrderDetails.orderDate ? format(new Date(viewOrderDetails.orderDate), 'MMM dd, yyyy h:mm a') : 'N/A'}
                        </span>
                      </div>
                      {viewOrderDetails.trackingNumber && (
                        <div className="grid grid-cols-3 gap-1 mt-1">
                          <span className="text-muted-foreground">Tracking:</span>
                          <span className="col-span-2">{viewOrderDetails.trackingNumber}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Customer & Shipping</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">
                      <p className="font-medium">{viewOrderDetails.shippingAddress.fullName}</p>
                      <p className="text-muted-foreground">{viewOrderDetails.shippingAddress.phone}</p>
                      <p className="text-muted-foreground mt-2">{formatAddress(viewOrderDetails.shippingAddress)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Order Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {viewOrderDetails.items.map((item, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded bg-slate-100 flex-shrink-0">
                          {item.image ? (
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              className="h-full w-full object-cover rounded"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-400">
                              <Package className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <div className="flex-grow">
                          <p className="font-medium">{item.name}</p>
                          <div className="text-sm text-muted-foreground">
                            Qty: {item.quantity} × ${item.price?.toFixed(2)}
                          </div>
                        </div>
                        <div className="font-medium">
                          ${item.subtotal?.toFixed(2)}
                        </div>
                      </div>
                    ))}
                    
                    <Separator />
                    
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span>${viewOrderDetails.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {viewOrderDetails.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Order Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{viewOrderDetails.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OrderTable;