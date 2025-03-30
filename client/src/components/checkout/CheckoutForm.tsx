import { useState } from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  MapPin, 
  CreditCard, 
  Loader2, 
  ShieldCheck,
  Lock
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// Shipping form schema
const shippingSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  postalCode: z.string().min(3, "Postal code is required"),
  country: z.string().min(2, "Country is required"),
  phone: z.string().min(6, "Phone number is required"),
});

type ShippingFormValues = z.infer<typeof shippingSchema>;

interface ShippingFormProps {
  address: {
    fullName: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  setAddress: (address: any) => void;
  onContinue: () => void;
}

// Shipping address form component
const ShippingForm = ({ address, setAddress, onContinue }: ShippingFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  
  const form = useForm<ShippingFormValues>({
    resolver: zodResolver(shippingSchema),
    defaultValues: {
      fullName: address.fullName || "",
      address: address.address || "",
      city: address.city || "",
      state: address.state || "",
      postalCode: address.postalCode || "",
      country: address.country || "US",
      phone: address.phone || "",
    },
  });
  
  const onSubmit = async (data: ShippingFormValues) => {
    setIsLoading(true);
    
    try {
      console.log("Form submitted with data:", data);
      
      // Update the address state in the parent component
      setAddress(data);
      
      // No need for artificial delay - proceed directly
      // Proceed to payment implementation in the checkout page
      onContinue();
    } catch (error) {
      console.error("Error validating address:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const countries = [
    { value: "US", label: "United States" },
    { value: "CA", label: "Canada" },
    { value: "GB", label: "United Kingdom" },
    { value: "AU", label: "Australia" },
    { value: "FR", label: "France" },
    { value: "DE", label: "Germany" },
    { value: "JP", label: "Japan" },
  ];
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="text-purple h-5 w-5" />
          <h3 className="text-lg font-medium">Shipping Information</h3>
        </div>
        
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 gap-6">
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input placeholder="123 Main St" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="New York" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State/Province</FormLabel>
                  <FormControl>
                    <Input placeholder="NY" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postal Code</FormLabel>
                  <FormControl>
                    <Input placeholder="10001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country.value} value={country.value}>
                          {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input placeholder="+1 (555) 123-4567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        {/* Hidden button gets triggered by the "Complete Your Order" button in the sidebar */}
        <Button 
          id="shipping-submit-button" 
          type="submit" 
          className="w-full mt-6"
          aria-hidden="true"
          style={{ display: 'none' }}
        >
          Submit
        </Button>
      </form>
    </Form>
  );
};

interface PaymentFormProps {
  address: {
    fullName: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  amount: number;
  onPaymentSuccess: () => void;
}

// Payment form component
const PaymentForm = ({ address, amount, onPaymentSuccess }: PaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      // Stripe.js hasn't loaded yet
      return;
    }
    
    setIsProcessing(true);
    setErrorMessage(undefined);
    
    try {
      // Confirm payment
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // Payment completion page
          return_url: window.location.origin + "/orders",
          payment_method_data: {
            billing_details: {
              name: address.fullName,
              phone: address.phone,
              address: {
                line1: address.address,
                city: address.city,
                state: address.state,
                postal_code: address.postalCode,
                country: address.country,
              },
            },
          },
        },
        redirect: "if_required",
      });
      
      if (error) {
        // Show error to your customer
        setErrorMessage(error.message);
        
        toast({
          title: "Payment Failed",
          description: error.message || "An error occurred while processing payment",
          variant: "destructive",
        });
      } else {
        // Create order in database and Firestore
        try {
          // Get items from local cart
          const cart = JSON.parse(localStorage.getItem('cart') || '{}');
          const cartItems = Object.entries(cart).map(([productId, quantity]) => ({
            productId: Number(productId),
            quantity: Number(quantity)
          }));
          
          // Create order
          const orderData = {
            items: cartItems,
            totalAmount: amount,
            status: "paid",
            paymentStatus: "completed",
            paymentIntent: paymentIntent?.id,
            shippingAddress: {
              fullName: address.fullName,
              address: address.address,
              city: address.city,
              state: address.state,
              postalCode: address.postalCode,
              country: address.country,
              phone: address.phone
            }
          };
          
          // Step 1: Create order in our server database
          const response = await apiRequest("POST", "/api/orders", orderData);
          
          if (!response.ok) {
            console.error('Failed to create order:', await response.text());
          } else {
            // Get current Firebase user ID
            const auth = window.localStorage.getItem('firebaseUid');
            if (auth) {
              try {
                // Import Firebase services
                const { doc, setDoc, collection, serverTimestamp } = await import('firebase/firestore');
                const { db } = await import('@/lib/firebase');

                // Create an orders collection reference
                const ordersRef = collection(db, 'users', auth, 'orders');
                
                // Create a new document with a generated ID
                const orderDoc = doc(ordersRef);
                
                // Add the order to Firestore
                await setDoc(orderDoc, {
                  ...orderData,
                  id: orderDoc.id,
                  userId: auth,
                  createdAt: serverTimestamp(),
                  items: (await Promise.all(cartItems.map(async item => {
                    // Get product details from API for display in order history
                    try {
                      const response = await fetch(`/api/products/${item.productId}`);
                      if (response.ok) {
                        const product = await response.json();
                        return {
                          productId: String(item.productId),
                          quantity: Number(item.quantity),
                          name: product.name,
                          price: product.discountPrice || product.price,
                          image: Array.isArray(product.images) && product.images.length > 0 ? 
                            product.images[0] : null
                        };
                      }
                    } catch (error) {
                      console.error('Error getting product details:', error);
                    }
                    
                    // Fallback if product details can't be fetched
                    return {
                      productId: String(item.productId),
                      quantity: Number(item.quantity)
                    };
                  })))
                });
                
                console.log('Order saved to Firestore successfully:', orderDoc.id);
              } catch (firestoreError) {
                console.error('Error saving order to Firestore:', firestoreError);
                // This is non-critical, so we continue
              }
            }
          }
        } catch (orderError) {
          console.error('Error creating order:', orderError);
        }
        
        // Payment successful
        toast({
          title: "Payment Successful",
          description: "Your order has been placed successfully",
        });
        
        // Call success callback
        onPaymentSuccess();
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      setErrorMessage(err.message);
      
      toast({
        title: "Payment Error",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="text-purple h-5 w-5" />
        <h3 className="text-lg font-medium">Payment Information</h3>
      </div>
      
      <div className="border rounded-lg p-4">
        <div className="mb-4">
          <h4 className="font-medium mb-2">Shipping Address</h4>
          <div className="text-sm text-gray-600">
            <p>{address.fullName}</p>
            <p>{address.address}</p>
            <p>{address.city}, {address.state} {address.postalCode}</p>
            <p>{countries.find(c => c.value === address.country)?.label || address.country}</p>
            <p>{address.phone}</p>
          </div>
        </div>
        
        <Separator className="my-4" />
        
        <div className="mb-6">
          <h4 className="font-medium mb-4">Card Details</h4>
          <PaymentElement 
            options={{
              layout: {
                type: 'tabs',
                defaultCollapsed: false,
              },
            }} 
          />
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Lock className="h-4 w-4" />
          <span>Your payment information is secure and encrypted</span>
        </div>
        
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-md p-3 mb-4">
            {errorMessage}
          </div>
        )}
        
        <Button 
          type="submit" 
          className="w-full bg-pink-500 text-white font-medium text-lg py-3"
          disabled={isProcessing || !stripe || !elements}
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing Payment...
            </>
          ) : (
            <>
              <ShieldCheck className="mr-2 h-5 w-5" />
              Pay ${amount.toFixed(2)}
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

const countries = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
  { value: "FR", label: "France" },
  { value: "DE", label: "Germany" },
  { value: "JP", label: "Japan" },
];

// Export the components
const CheckoutForm = {
  ShippingForm,
  PaymentForm,
};

export default CheckoutForm;
