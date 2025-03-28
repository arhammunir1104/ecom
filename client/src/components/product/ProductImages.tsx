import { useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

interface ProductImagesProps {
  images: string[];
}

const ProductImages = ({ images }: ProductImagesProps) => {
  const [activeImage, setActiveImage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });

  // In case no images are provided, show placeholder
  if (!images || images.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[500px] w-full rounded-lg" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((_, i) => (
            <Skeleton key={i} className="h-20 w-20 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed) return;
    
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - left) / width;
    const y = (e.clientY - top) / height;
    
    setZoomPosition({ x, y });
  };

  const handleThumbnailClick = (index: number) => {
    setActiveImage(index);
  };

  const handleZoomToggle = () => {
    setIsZoomed(!isZoomed);
  };

  const handleNextImage = () => {
    setActiveImage((prev) => (prev + 1) % images.length);
  };

  const handlePrevImage = () => {
    setActiveImage((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Card className="overflow-hidden rounded-lg">
          <div
            className={`relative ${
              isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
            }`}
            onClick={handleZoomToggle}
            onMouseMove={handleMouseMove}
            style={{ paddingTop: "100%" }}
          >
            {images.map((image, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-300 ${
                  index === activeImage ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                <img
                  src={image}
                  alt={`Product image ${index + 1}`}
                  className="w-full h-full object-cover"
                  style={
                    isZoomed
                      ? {
                          transformOrigin: `${zoomPosition.x * 100}% ${zoomPosition.y * 100}%`,
                          transform: "scale(2)",
                        }
                      : {}
                  }
                />
              </div>
            ))}
          </div>

          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              handlePrevImage();
            }}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              handleNextImage();
            }}
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <button
            className="absolute bottom-2 right-2 bg-white/80 hover:bg-white rounded-full p-1 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              handleZoomToggle();
            }}
          >
            <ZoomIn className="h-5 w-5" />
          </button>
        </Card>
      </div>

      {/* Thumbnails */}
      <Carousel className="w-full">
        <CarouselContent className="-ml-2">
          {images.map((image, index) => (
            <CarouselItem
              key={index}
              className={`pl-2 basis-1/5 cursor-pointer ${
                index === activeImage ? "opacity-100" : "opacity-60"
              }`}
              onClick={() => handleThumbnailClick(index)}
            >
              <div className="overflow-hidden rounded-md">
                <img
                  src={image}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-20 object-cover"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
};

export default ProductImages;
