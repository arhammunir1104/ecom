import { Testimonial } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { QuoteIcon } from "lucide-react";

interface TestimonialsProps {
  testimonials: Testimonial[];
  isLoading: boolean;
}

const Testimonials = ({ testimonials, isLoading }: TestimonialsProps) => {
  if (isLoading) {
    return (
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <Skeleton className="h-10 w-60 mx-auto mb-12" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="bg-beige rounded-lg p-6 shadow-sm relative">
                <div className="space-y-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-24 w-full" />
                  <div className="flex items-center">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="ml-3">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24 mt-1" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // If no testimonials are available, don't render the section
  if (!testimonials || testimonials.length === 0) {
    return null;
  }

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<i key={`full-${i}`} className="fas fa-star"></i>);
    }
    
    if (hasHalfStar) {
      stars.push(<i key="half" className="fas fa-star-half-alt"></i>);
    }
    
    const emptyStars = 5 - stars.length;
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<i key={`empty-${i}`} className="far fa-star"></i>);
    }
    
    return stars;
  };

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="font-playfair text-3xl font-bold text-center mb-12">What Our Customers Say</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.slice(0, 3).map(testimonial => (
            <div key={testimonial.id} className="bg-beige rounded-lg p-6 shadow-sm relative">
              <div className="text-gold text-5xl absolute -top-4 left-4 opacity-20">
                <QuoteIcon size={48} />
              </div>
              <div className="relative z-10">
                <div className="flex text-gold mb-4">
                  {renderStars(testimonial.rating)}
                </div>
                <p className="text-gray-700 italic mb-6">{testimonial.comment}</p>
                <div className="flex items-center">
                  <img 
                    src={testimonial.image} 
                    alt={testimonial.name} 
                    className="w-12 h-12 rounded-full object-cover"
                    loading="lazy"
                  />
                  <div className="ml-3">
                    <div className="font-medium">{testimonial.name}</div>
                    <div className="text-sm text-gray-500">Verified Customer</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
