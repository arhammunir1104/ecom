import { useState } from "react";
import { Link } from "wouter";
import { useCart } from "@/hooks/useCart";
import CartItem from "@/components/cart/CartItem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShoppingBag, ArrowRight, AlertCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Product } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { CartItem as CartItemType } from "@/context/CartContext";

const Cart = () => {
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");

  // Fetch product details for all cart items
  const cartItemIds = Object.keys(cart).map(id => Number(id));
  const productQueries = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: cartItemIds.length > 0,
  });

  const { data: products, isLoading } = productQueries;

  // Filter products that are in the cart
  const cartProducts = products?.filter(product => 
    cartItemIds.includes(product.id)
  ) || [];

  // Calculate cart totals
  const subtotal = cartProducts.reduce((sum, product) => {
    const cartItem = cart[product.id.toString()];
    const quantity = cartItem ? cartItem.quantity : 0;
    const price = product.discountPrice || product.price;
    return sum + price * quantity;
  }, 0);
  
  const shipping = subtotal > 99 ? 0 : 7.99;
  const total = subtotal + shipping;

  // Check if cart is empty
  const isCartEmpty = cartItemIds.length === 0;

  // Handle coupon submission
  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode) {
      setCouponError("Please enter a coupon code");
      return;
    }
    setCouponError("Invalid coupon code");
    // In a real app, you would validate the coupon with your backend
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-playfair font-bold mb-8">Shopping Cart</h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
        </div>
      ) : isCartEmpty ? (
        <div className="text-center py-12">
          <div className="inline-flex justify-center items-center w-16 h-16 bg-pink-lighter rounded-full text-purple mb-4">
            <ShoppingBag size={24} />
          </div>
          <h2 className="text-xl font-medium mb-2">Your cart is empty</h2>
          <p className="text-gray-500 mb-6">Looks like you haven't added anything to your cart yet.</p>
          <Link href="/shop">
            <Button>Continue Shopping</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Cart items */}
          <div className="lg:w-2/3">
            <div className="bg-white rounded-lg shadow-sm">
              {cartProducts.map(product => (
                <CartItem 
                  key={product.id}
                  product={product}
                  quantity={cart[product.id.toString()]?.quantity || 0}
                  updateQuantity={(quantity) => updateQuantity(product.id, quantity)}
                  removeFromCart={() => removeFromCart(product.id)}
                />
              ))}
            </div>

            <div className="flex justify-between mt-6">
              <Button 
                variant="outline" 
                onClick={clearCart}
              >
                Clear Cart
              </Button>
              <Link href="/shop">
                <Button variant="outline">
                  Continue Shopping
                </Button>
              </Link>
            </div>
          </div>

          {/* Cart summary */}
          <div className="lg:w-1/3">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Shipping</span>
                  <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
                </div>
                {shipping > 0 && (
                  <Alert className="mt-2 bg-pink-lighter border-pink-light">
                    <AlertCircle className="h-4 w-4 text-purple" />
                    <AlertDescription>
                      Free shipping on orders over $99
                    </AlertDescription>
                  </Alert>
                )}

                <Separator />

                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <Input 
                    placeholder="Enter coupon code" 
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value);
                      setCouponError("");
                    }}
                    className={couponError ? "border-red-300" : ""}
                  />
                  <Button type="submit" variant="outline" size="sm">
                    Apply
                  </Button>
                </form>
                {couponError && (
                  <p className="text-red-500 text-sm">{couponError}</p>
                )}

                <Separator />

                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span className="text-purple">${total.toFixed(2)}</span>
                </div>
              </CardContent>
              <CardFooter>
                <Link href="/checkout" className="w-full">
                  <Button className="w-full text-base">
                    Proceed to Checkout
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
