import { useState } from "react";
import { Category } from "@shared/schema";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";

interface FilterSidebarProps {
  categories: Category[];
  activeCategory: number | null;
  setActiveCategory: (id: number | null) => void;
  onFilterChange?: (key: string, value: string | null) => void;
}

const FilterSidebar = ({
  categories,
  activeCategory,
  setActiveCategory,
  onFilterChange,
}: FilterSidebarProps) => {
  const [priceRange, setPriceRange] = useState([0, 200]);

  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
  const colors = [
    { name: "Black", value: "#000000" },
    { name: "White", value: "#FFFFFF" },
    { name: "Red", value: "#FF0000" },
    { name: "Blue", value: "#0000FF" },
    { name: "Green", value: "#00FF00" },
    { name: "Pink", value: "#FFC0CB" },
    { name: "Purple", value: "#800080" },
    { name: "Beige", value: "#F5F5DC" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium text-lg mb-4">Categories</h3>
        <div className="space-y-2">
          <div className="flex items-center">
            <RadioGroup value={activeCategory?.toString() || ""}>
              <div className="flex items-center space-x-2 mb-2">
                <RadioGroupItem
                  value=""
                  id="all-categories"
                  onClick={() => setActiveCategory(null)}
                />
                <Label
                  htmlFor="all-categories"
                  className="cursor-pointer text-sm"
                >
                  All Categories
                </Label>
              </div>

              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center space-x-2 mb-2"
                >
                  <RadioGroupItem
                    value={category.id.toString()}
                    id={`category-${category.id}`}
                    onClick={() => setActiveCategory(category.id)}
                  />
                  <Label
                    htmlFor={`category-${category.id}`}
                    className="cursor-pointer text-sm"
                  >
                    {category.name}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-medium text-lg mb-4">Product Type</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="featured" 
              onCheckedChange={(checked) => {
                if (onFilterChange) {
                  onFilterChange("featured", checked ? "true" : null);
                }
              }}
            />
            <Label
              htmlFor="featured"
              className="text-sm cursor-pointer"
            >
              Featured Products
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="trending" 
              onCheckedChange={(checked) => {
                if (onFilterChange) {
                  onFilterChange("trending", checked ? "true" : null);
                }
              }}
            />
            <Label
              htmlFor="trending"
              className="text-sm cursor-pointer"
            >
              Trending Products
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="sale" 
              onCheckedChange={(checked) => {
                if (onFilterChange) {
                  onFilterChange("sale", checked ? "true" : null);
                }
              }}
            />
            <Label
              htmlFor="sale"
              className="text-sm cursor-pointer"
            >
              On Sale
            </Label>
          </div>
        </div>
      </div>
      
      <Accordion type="single" collapsible defaultValue="price" className="w-full mt-6">
        <AccordionItem value="price" className="border-b">
          <AccordionTrigger className="font-medium text-base">Price</AccordionTrigger>
          <AccordionContent>
            <div className="pt-2 px-1">
              <Slider
                value={priceRange}
                min={0}
                max={200}
                step={5}
                onValueChange={(values) => {
                  setPriceRange(values);
                  if (onFilterChange) {
                    onFilterChange("minPrice", values[0].toString());
                    onFilterChange("maxPrice", values[1].toString());
                  }
                }}
                className="mb-6"
              />
              <div className="flex justify-between">
                <span>${priceRange[0]}</span>
                <span>${priceRange[1]}</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="size" className="border-b">
          <AccordionTrigger className="font-medium text-base">Size</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-2">
              {sizes.map((size) => (
                <div key={size} className="flex items-center space-x-2">
                  <Checkbox id={`size-${size}`} />
                  <Label
                    htmlFor={`size-${size}`}
                    className="text-sm cursor-pointer"
                  >
                    {size}
                  </Label>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="color" className="border-b">
          <AccordionTrigger className="font-medium text-base">Color</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-2">
              {colors.map((color) => (
                <div key={color.name} className="flex items-center space-x-2">
                  <Checkbox id={`color-${color.name}`} />
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded-full mr-2 border border-gray-300"
                      style={{ backgroundColor: color.value }}
                    ></div>
                    <Label
                      htmlFor={`color-${color.name}`}
                      className="text-sm cursor-pointer"
                    >
                      {color.name}
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="discount" className="border-b">
          <AccordionTrigger className="font-medium text-base">Discount</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="discount-any" />
                <Label
                  htmlFor="discount-any"
                  className="text-sm cursor-pointer"
                >
                  Any Discount
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="discount-10" />
                <Label
                  htmlFor="discount-10"
                  className="text-sm cursor-pointer"
                >
                  10% Off or More
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="discount-20" />
                <Label
                  htmlFor="discount-20"
                  className="text-sm cursor-pointer"
                >
                  20% Off or More
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="discount-30" />
                <Label
                  htmlFor="discount-30"
                  className="text-sm cursor-pointer"
                >
                  30% Off or More
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="discount-40" />
                <Label
                  htmlFor="discount-40"
                  className="text-sm cursor-pointer"
                >
                  40% Off or More
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="discount-50" />
                <Label
                  htmlFor="discount-50"
                  className="text-sm cursor-pointer"
                >
                  50% Off or More
                </Label>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default FilterSidebar;
