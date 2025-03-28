import HeroBanner from "@/components/home/HeroBanner";
import CategoryShowcase from "@/components/home/CategoryShowcase";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import PromoBanner from "@/components/home/PromoBanner";
import TrendingSection from "@/components/home/TrendingSection";
import Testimonials from "@/components/home/Testimonials";
import InstagramFeed from "@/components/home/InstagramFeed";
import Newsletter from "@/components/home/Newsletter";
import { useQuery } from "@tanstack/react-query";

const Home = () => {
  const { data: heroData, isLoading: isLoadingHero } = useQuery({
    queryKey: ["/api/hero-banners"],
  });

  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["/api/categories/featured"],
  });

  const { data: featuredProducts, isLoading: isLoadingFeatured } = useQuery({
    queryKey: ["/api/products", { featured: true }],
    enabled: !isLoadingCategories,
  });

  const { data: trendingProducts, isLoading: isLoadingTrending } = useQuery({
    queryKey: ["/api/products", { trending: true }],
    enabled: !isLoadingFeatured,
  });

  const { data: testimonials, isLoading: isLoadingTestimonials } = useQuery({
    queryKey: ["/api/testimonials"],
    enabled: !isLoadingTrending,
  });

  return (
    <div className="bg-beige-light">
      <HeroBanner banners={heroData || []} isLoading={isLoadingHero} />
      <CategoryShowcase categories={categories || []} isLoading={isLoadingCategories} />
      <FeaturedProducts products={featuredProducts || []} isLoading={isLoadingFeatured} />
      <PromoBanner />
      <TrendingSection products={trendingProducts || []} isLoading={isLoadingTrending} />
      <Testimonials testimonials={testimonials || []} isLoading={isLoadingTestimonials} />
      <InstagramFeed />
      <Newsletter />
    </div>
  );
};

export default Home;
