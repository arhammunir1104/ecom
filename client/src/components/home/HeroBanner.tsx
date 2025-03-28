import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { HeroBanner as HeroBannerType } from "@shared/schema";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface HeroBannerProps {
  banners: HeroBannerType[];
  isLoading: boolean;
}

const HeroBanner = ({ banners, isLoading }: HeroBannerProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-rotate banners
  useEffect(() => {
    if (banners.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [banners.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % banners.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  if (isLoading) {
    return (
      <div className="relative overflow-hidden h-[500px] md:h-[600px]">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  // Fallback banner if no banners are available
  if (!banners || banners.length === 0) {
    return (
      <div className="relative overflow-hidden h-[500px] md:h-[600px]">
        <div className="relative h-full">
          <img
            src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b"
            alt="Fashion collection"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-purple/30 to-transparent"></div>
          <div className="absolute inset-0 flex items-center px-8 md:px-16">
            <div className="max-w-md">
              <h1 className="font-playfair text-3xl md:text-5xl font-bold text-white leading-tight mb-4">
                Autumn Collection <span className="text-gold">2024</span>
              </h1>
              <p className="text-white text-lg mb-8 leading-relaxed">
                Discover this season's most elegant and sophisticated designs crafted for the modern woman.
              </p>
              <div className="flex space-x-4">
                <Button
                  className="bg-gradient-to-r from-purple to-purple/80 text-white px-8 py-6 rounded-full"
                  asChild
                >
                  <Link href="/shop">Shop Now</Link>
                </Button>
                <Button
                  variant="secondary"
                  className="bg-white text-purple px-8 py-6 rounded-full"
                >
                  Learn More
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="relative overflow-hidden h-[500px] md:h-[600px]">
      <div className="relative h-full">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentSlide ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <img
              src={banner.image}
              alt={banner.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-purple/30 to-transparent"></div>
            <div className="absolute inset-0 flex items-center px-8 md:px-16">
              <div className="max-w-md">
                <h1 className="font-playfair text-3xl md:text-5xl font-bold text-white leading-tight mb-4">
                  {banner.title} <span className="text-gold">{banner.subtitle}</span>
                </h1>
                <p className="text-white text-lg mb-8 leading-relaxed">
                  {banner.subtitle || "Discover this season's most elegant and sophisticated designs crafted for the modern woman."}
                </p>
                <div className="flex space-x-4">
                  <Button
                    className="bg-gradient-to-r from-purple to-purple/80 text-white px-8 py-6 rounded-full"
                    asChild
                  >
                    <Link href={banner.buttonLink || "/shop"}>{banner.buttonText || "Shop Now"}</Link>
                  </Button>
                  <Button
                    variant="secondary"
                    className="bg-white text-purple px-8 py-6 rounded-full"
                  >
                    Learn More
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation buttons */}
      {banners.length > 1 && (
        <>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/50 transition-colors"
            onClick={prevSlide}
          >
            <ArrowLeft size={20} />
          </button>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/50 transition-colors"
            onClick={nextSlide}
          >
            <ArrowRight size={20} />
          </button>

          {/* Pagination dots */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center space-x-2">
            {banners.map((_, index) => (
              <button
                key={index}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === currentSlide ? "bg-white" : "bg-white/50"
                }`}
                onClick={() => goToSlide(index)}
              ></button>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default HeroBanner;
