import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const PromoBanner = () => {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="relative rounded-xl overflow-hidden">
          <div className="md:flex">
            <div className="md:w-1/2 relative">
              <img 
                src="https://images.unsplash.com/photo-1589465885857-44edb59bbff2?ixlib=rb-1.2.1&auto=format&fit=crop&w=1200&q=80" 
                alt="Summer Collection" 
                className="w-full h-[400px] md:h-[500px] object-cover"
                loading="lazy"
              />
            </div>
            <div className="md:w-1/2 bg-pink-lighter p-8 md:p-12 flex items-center">
              <div>
                <h2 className="font-playfair text-3xl md:text-4xl font-bold mb-4 text-purple">
                  Summer Collection <span className="text-pink-dark">2024</span>
                </h2>
                <p className="text-gray-700 mb-6 leading-relaxed">
                  Explore our new summer collection featuring light fabrics, vibrant colors, and elegant designs perfect for warm weather.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    className="bg-gradient-to-r from-purple to-purple/80 text-white rounded-full"
                    size="lg"
                    asChild
                  >
                    <Link href="/shop">Shop Collection</Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="bg-white text-purple border-purple rounded-full"
                    size="lg"
                  >
                    View Lookbook
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PromoBanner;
