import { Product } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash, Plus, Minus } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface CartItemProps {
  product: Product;
  quantity: number;
  updateQuantity: (quantity: number) => void;
  removeFromCart: () => void;
}

const CartItem = ({ product, quantity, updateQuantity, removeFromCart }: CartItemProps) => {
  const {
    name,
    price,
    discountPrice,
    images,
    stock,
  } = product;
  
  const imageUrl = Array.isArray(images) && images.length > 0 
    ? images[0] 
    : "https://via.placeholder.com/100x100?text=No+Image";
  
  const itemPrice = discountPrice || price;
  const itemTotal = itemPrice * quantity;
  
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0 && value <= stock) {
      updateQuantity(value);
    }
  };
  
  const handleIncrement = () => {
    if (quantity < stock) {
      updateQuantity(quantity + 1);
    }
  };
  
  const handleDecrement = () => {
    if (quantity > 1) {
      updateQuantity(quantity - 1);
    }
  };

  return (
    <div className="py-4 px-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-20 h-20 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
          <img 
            src={imageUrl} 
            alt={name} 
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="flex-grow">
          <h3 className="font-medium text-gray-900">{name}</h3>
          <div className="text-sm text-gray-500 mt-1 mb-2">
            Quantity: {quantity}
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center border rounded-md">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-r-none"
                onClick={handleDecrement}
                disabled={quantity <= 1}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                min="1"
                max={stock}
                value={quantity}
                onChange={handleQuantityChange}
                className="w-12 h-8 text-center border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-l-none"
                onClick={handleIncrement}
                disabled={quantity >= stock}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50 p-0"
              onClick={removeFromCart}
            >
              <Trash className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </div>
        </div>
        
        <div className="text-right">
          <div className="font-semibold text-purple">
            ${itemTotal.toFixed(2)}
          </div>
          {discountPrice && (
            <div className="text-sm text-gray-500 line-through">
              ${(price * quantity).toFixed(2)}
            </div>
          )}
        </div>
      </div>
      <Separator className="mt-4" />
    </div>
  );
};

export default CartItem;
