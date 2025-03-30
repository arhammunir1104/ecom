import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "@/components/checkout/CheckoutForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { Product } from "@shared/schema";
import { Check, ChevronLeft, CreditCard, Loader2, LockIcon, MapPin, Truck } from "lucide-react";

// Initialize Stripe - using a default key if environment variable is not available
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const Checkout = () => {
  const [activeTab, setActiveTab] = useState("shipping");
  const [address, setAddress] = useState({
    fullName: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    phone: "",
  });
  const [clientSecret, setClientSecret] = useState("");
  
  const { cart, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Fetch product details for all cart items
  const cartItemIds = Object.keys(cart).map(id => Number(id));
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: cartItemIds.length > 0,
  });

  // Redirect if cart is empty
  useEffect(() => {
    if (!isLoading && cartItemIds.length === 0) {
      toast({
        title: "Your cart is empty",
        description: "Please add items to your cart before checkout",
        variant: "destructive",
      });
      setLocation("/shop");
    }
  }, [isLoading, cartItemIds, toast, setLocation]);

  // Filter products that are in the cart
  const cartProducts = products?.filter(product => 
    cartItemIds.includes(product.id)
  ) || [];

  // Calculate cart totals
  const subtotal = cartProducts.reduce((sum, product) => {
    const quantity = cart[product.id];
    const price = product.discountPrice || product.price;
    return sum + price * quantity;
  }, 0);
  
  const shipping = subtotal > 99 ? 0 : 7.99;
  const total = subtotal + shipping;

  // Create payment intent when proceeding to payment
  const handleProceedToPayment = async () => {
    if (!validateAddress()) return;
    
    try {
      console.log("Creating payment intent for total:", total);
      
      // Show loading toast
      toast({
        title: "Processing Payment",
        description: "Please wait while we set up the payment...",
      });
      
      // Make sure we have a create-payment-intent endpoint available on the server
      console.log("Making API request to create payment intent");
      const res = await apiRequest("POST", "/api/create-payment-intent", { amount: total });
      
      if (!res.ok) {
        let errorMessage = "Unable to process payment. Please try again.";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          console.error("Could not parse error response", e);
        }
        throw new Error(errorMessage);
      }
      
      const data = await res.json();
      console.log("Payment intent created successfully, client secret received:", data.clientSecret ? "Yes" : "No");
      setClientSecret(data.clientSecret);
      
      toast({
        title: "Payment Ready",
        description: "Please complete your payment information.",
      });
      
      setActiveTab("payment");
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      toast({
        title: "Payment Error",
        description: error.message || "Unable to process payment. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Validate address fields
  const validateAddress = () => {
    const requiredFields = ["fullName", "address", "city", "postalCode", "country", "phone"];
    const missingFields = requiredFields.filter(field => !address[field as keyof typeof address]);
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  // Handle successful payment
  const handlePaymentSuccess = () => {
    toast({
      title: "Payment Successful",
      description: "Your order has been placed successfully",
    });
    clearCart();
    setLocation("/orders");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button variant="ghost" onClick={() => setLocation("/cart")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Cart
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-2/3">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-playfair">Checkout</CardTitle>
              <CardDescription>Complete your order in just a few steps</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="shipping" disabled={activeTab === "payment" || activeTab === "confirmation"}>
                    <MapPin className="mr-2 h-4 w-4" />
                    Shipping
                  </TabsTrigger>
                  <TabsTrigger value="payment" disabled={activeTab !== "payment" && activeTab !== "confirmation"}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Payment
                  </TabsTrigger>
                  <TabsTrigger value="confirmation" disabled={activeTab !== "confirmation"}>
                    <Check className="mr-2 h-4 w-4" />
                    Confirmation
                  </TabsTrigger>
                </TabsList>
                
                <div className="mt-6">
                  <TabsContent value="shipping">
                    <CheckoutForm.ShippingForm 
                      address={address}
                      setAddress={setAddress}
                      onContinue={handleProceedToPayment}
                    />
                    
                    {/* Fallback button in case form button isn't working */}
                    <div className="flex justify-end mt-6">
                      <Button 
                        type="button" 
                        className="bg-purple text-white font-medium px-6 py-3 text-lg"
                        onClick={handleProceedToPayment}
                        size="lg"
                      >
                        <CreditCard className="mr-2 h-5 w-5" />
                        Proceed to Payment
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="payment">
                    {clientSecret && (
                      <Elements stripe={stripePromise} options={{ clientSecret }}>
                        <CheckoutForm.PaymentForm 
                          address={address}
                          amount={total}
                          onPaymentSuccess={handlePaymentSuccess}
                        />
                      </Elements>
                    )}
                    {!clientSecret && (
                      <div className="p-6 text-center">
                        <div className="animate-spin h-8 w-8 border-4 border-purple border-t-transparent rounded-full mx-auto mb-4" />
                        <p>Preparing payment form...</p>
                        <Button 
                          type="button" 
                          className="bg-purple text-white font-medium px-6 py-3 text-lg mt-4"
                          onClick={handleProceedToPayment}
                        >
                          <CreditCard className="mr-2 h-5 w-5" />
                          Retry Payment Setup
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="confirmation">
                    <div className="text-center py-12">
                      <div className="inline-flex justify-center items-center w-16 h-16 bg-green-100 rounded-full text-green-500 mb-4">
                        <Check size={24} />
                      </div>
                      <h2 className="text-2xl font-medium mb-2">Thank You For Your Order!</h2>
                      <p className="text-gray-500 mb-6">
                        Your order has been placed and is being processed. You will receive an email confirmation shortly.
                      </p>
                      <div className="flex justify-center gap-4">
                        <Button variant="outline" onClick={() => setLocation("/orders")}>
                          View Orders
                        </Button>
                        <Button onClick={() => setLocation("/")}>
                          Continue Shopping
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:w-1/3">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Order items */}
              <div className="space-y-3">
                {cartProducts.map(product => {
                  const quantity = cart[product.id];
                  const price = product.discountPrice || product.price;
                  return (
                    <div key={product.id} className="flex justify-between items-center">
                      <div className="flex gap-2">
                        <div className="w-16 h-16 rounded-md bg-gray-100 overflow-hidden">
                          <img 
                            src={Array.isArray(product.images) && product.images[0]} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-gray-500">Qty: {quantity}</p>
                        </div>
                      </div>
                      <p className="font-medium">${(price * quantity).toFixed(2)}</p>
                    </div>
                  );
                })}
              </div>
              
              <Separator />
              
              {/* Order totals */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Shipping</span>
                  <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span className="text-purple">${total.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="mt-6 flex items-center text-sm text-gray-500">
                <LockIcon className="h-3 w-3 mr-1" />
                Secure Checkout
              </div>
              
              {activeTab === "shipping" && (
                <Button 
                  type="button" 
                  onClick={handleProceedToPayment}
                  className="w-full bg-purple hover:bg-pink-300 text-white font-bold py-3 mt-4 flex items-center justify-center"
                  size="lg"
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  Complete Your Order
                </Button>
              )}
            </CardContent>
          </Card>
          
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm">Free shipping on orders over $99</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-purple" />
              <span className="text-sm">Fast delivery (3-5 business days)</span>
            </div>
            <div className="flex items-center gap-2">
              <LockIcon className="h-4 w-4 text-purple" />
              <span className="text-sm">Secure payment processing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
