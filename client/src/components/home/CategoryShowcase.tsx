import { Link } from "wouter";
import { Category } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface CategoryShowcaseProps {
  categories: Category[];
  isLoading: boolean;
}

const CategoryShowcase = ({ categories, isLoading }: CategoryShowcaseProps) => {
  if (isLoading) {
    return (
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <Skeleton className="h-10 w-60 mx-auto mb-12" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-80 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // If no categories are available, don't render the section
  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="font-playfair text-3xl font-bold text-center mb-12">Shop By Category</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          {categories.map(category => (
            <Link 
              key={category.id} 
              href={`/categories/${category.id}`}
              className="group relative rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <img 
                src={category.image} 
                alt={category.name} 
                className="w-full h-80 object-cover group-hover:scale-105 transition duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-purple/70 to-transparent opacity-80"></div>
              <div className="absolute bottom-0 left-0 w-full p-4">
                <h3 className="text-white font-playfair text-xl font-semibold">{category.name}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryShowcase;
