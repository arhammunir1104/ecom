import { useState } from "react";
import { Product, Category } from "@shared/schema";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Share2, ShoppingBag, Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProductInfoProps {
  product: Product;
  category?: Category;
}

const ProductInfo = ({ product, category }: ProductInfoProps) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const { addToCart } = useCart();
  
  const {
    id,
    name,
    description,
    price,
    discountPrice,
    sizes,
    colors,
    stock,
  } = product;
  
  const handleAddToCart = () => {
    addToCart(id, quantity);
  };
  
  const formattedSizes = Array.isArray(sizes) ? sizes : [];
  const formattedColors = Array.isArray(colors) ? colors : [];
  const inStock = stock > 0;
  const discountPercentage = discountPrice 
    ? Math.round(((price - discountPrice) / price) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Category */}
      {category && (
        <div className="text-sm text-purple font-medium">{category.name}</div>
      )}
      
      {/* Product name */}
      <h1 className="text-3xl font-playfair font-bold text-gray-900">{name}</h1>
      
      {/* Ratings - static for now */}
      <div className="flex items-center">
        <div className="flex text-gold">
          <i className="fas fa-star"></i>
          <i className="fas fa-star"></i>
          <i className="fas fa-star"></i>
          <i className="fas fa-star"></i>
          <i className="fas fa-star-half-alt"></i>
        </div>
        <span className="text-sm text-gray-500 ml-2">(24 reviews)</span>
      </div>
      
      {/* Price */}
      <div className="flex items-center gap-3">
        {discountPrice ? (
          <>
            <span className="text-2xl font-bold text-purple">${discountPrice.toFixed(2)}</span>
            <span className="text-lg text-gray-400 line-through">${price.toFixed(2)}</span>
            <Badge className="bg-pink-light text-purple">
              Save {discountPercentage}%
            </Badge>
          </>
        ) : (
          <span className="text-2xl font-bold text-purple">${price.toFixed(2)}</span>
        )}
      </div>
      
      {/* Description */}
      <p className="text-gray-600">{description}</p>
      
      {/* Size selection */}
      {formattedSizes.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between">
            <label htmlFor="size" className="text-sm font-medium">
              Size
            </label>
            <a href="#" className="text-purple text-sm hover:underline">
              Size Guide
            </a>
          </div>
          <Select value={selectedSize} onValueChange={setSelectedSize}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              {formattedSizes.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      {/* Color selection */}
      {formattedColors.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Color</label>
          <div className="flex gap-2">
            {formattedColors.map((color) => (
              <button
                key={color}
                className={`w-8 h-8 rounded-full border ${
                  selectedColor === color
                    ? "ring-2 ring-purple ring-offset-2"
                    : "border-gray-300"
                }`}
                style={{ background: color.toLowerCase() }}
                onClick={() => setSelectedColor(color)}
                aria-label={`Select ${color}`}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Quantity and add to cart */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex rounded-md">
          <Button
            variant="outline"
            size="icon"
            className="rounded-l-md rounded-r-none border-r-0"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={!inStock}
          >
            -
          </Button>
          <div className="flex items-center justify-center border-y border-gray-300 px-4">
            {quantity}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="rounded-r-md rounded-l-none border-l-0"
            onClick={() => setQuantity(Math.min(stock, quantity + 1))}
            disabled={!inStock}
          >
            +
          </Button>
        </div>
        
        <Button
          className="flex-1 bg-gradient-to-r from-purple to-purple/80 text-white"
          size="lg"
          onClick={handleAddToCart}
          disabled={!inStock}
        >
          <ShoppingBag className="mr-2 h-5 w-5" />
          {inStock ? "Add to Cart" : "Out of Stock"}
        </Button>
        
        <Button variant="outline" size="icon">
          <Heart className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Shipping & Returns */}
      <div className="border-t border-gray-100 pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <Truck className="h-5 w-5 text-purple" />
          <span className="text-sm">Free shipping on orders over $99</span>
        </div>
        <div className="flex items-center gap-3">
          <RotateCcw className="h-5 w-5 text-purple" />
          <span className="text-sm">30-day free returns</span>
        </div>
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-purple" />
          <span className="text-sm">Secure payment</span>
        </div>
      </div>
      
      {/* Social share */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Share:</span>
        <button className="text-gray-400 hover:text-purple transition-colors">
          <i className="fab fa-facebook"></i>
        </button>
        <button className="text-gray-400 hover:text-purple transition-colors">
          <i className="fab fa-instagram"></i>
        </button>
        <button className="text-gray-400 hover:text-purple transition-colors">
          <i className="fab fa-pinterest"></i>
        </button>
        <button className="text-gray-400 hover:text-purple transition-colors">
          <i className="fab fa-twitter"></i>
        </button>
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="details" className="mt-8">
        <TabsList className="w-full">
          <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
          <TabsTrigger value="sizing" className="flex-1">Sizing</TabsTrigger>
          <TabsTrigger value="shipping" className="flex-1">Shipping</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-4">
          <div className="prose max-w-none text-gray-600">
            <p>{description}</p>
            <ul className="mt-4 space-y-1 list-disc list-inside">
              <li>100% Premium Material</li>
              <li>Ethically Made</li>
              <li>Comfortable Fit</li>
              <li>Durable Construction</li>
            </ul>
          </div>
        </TabsContent>
        <TabsContent value="sizing" className="mt-4">
          <div className="text-gray-600">
            <p>Our sizing guide helps you find your perfect fit:</p>
            <table className="w-full mt-4 text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Size</th>
                  <th className="py-2 text-left">Bust</th>
                  <th className="py-2 text-left">Waist</th>
                  <th className="py-2 text-left">Hip</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2">XS</td>
                  <td className="py-2">32"</td>
                  <td className="py-2">24"</td>
                  <td className="py-2">34"</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">S</td>
                  <td className="py-2">34"</td>
                  <td className="py-2">26"</td>
                  <td className="py-2">36"</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">M</td>
                  <td className="py-2">36"</td>
                  <td className="py-2">28"</td>
                  <td className="py-2">38"</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">L</td>
                  <td className="py-2">38"</td>
                  <td className="py-2">30"</td>
                  <td className="py-2">40"</td>
                </tr>
                <tr>
                  <td className="py-2">XL</td>
                  <td className="py-2">40"</td>
                  <td className="py-2">32"</td>
                  <td className="py-2">42"</td>
                </tr>
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="shipping" className="mt-4">
          <div className="text-gray-600 space-y-4">
            <div>
              <h4 className="font-medium">Standard Shipping</h4>
              <p className="text-sm mt-1">3-5 business days - $5.99 (Free over $99)</p>
            </div>
            <div>
              <h4 className="font-medium">Express Shipping</h4>
              <p className="text-sm mt-1">1-2 business days - $12.99</p>
            </div>
            <div>
              <h4 className="font-medium">Returns</h4>
              <p className="text-sm mt-1">
                We offer a 30-day return policy for unworn items in original packaging. Return shipping is free.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductInfo;
