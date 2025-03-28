import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Review } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Star, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface ReviewsSectionProps {
  productId: number;
  reviews: Review[];
  isLoading: boolean;
}

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().min(10, "Comment must be at least 10 characters"),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

const ReviewsSection = ({ productId, reviews, isLoading }: ReviewsSectionProps) => {
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      comment: "",
    },
  });
  
  const onSubmit = async (data: ReviewFormValues) => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to submit a review",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await apiRequest("POST", "/api/reviews", {
        productId,
        ...data,
      });
      
      toast({
        title: "Review Submitted",
        description: "Thank you for your review!",
      });
      
      // Reset form
      form.reset();
      setSelectedRating(0);
      
      // Refetch reviews
      queryClient.invalidateQueries({ queryKey: [`/api/reviews/product/${productId}`] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit review",
        variant: "destructive",
      });
    }
  };
  
  const handleRatingClick = (rating: number) => {
    setSelectedRating(rating);
    form.setValue("rating", rating);
  };
  
  const renderStars = (rating: number) => {
    const stars = [];
    
    for (let i = 1; i <= 5; i++) {
      const filled = i <= rating;
      stars.push(
        <span key={i} className={`text-${filled ? "gold" : "gray-300"}`}>
          <i className={`fa${filled ? "s" : "r"} fa-star`}></i>
        </span>
      );
    }
    
    return stars;
  };
  
  const averageRating = reviews.length 
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : "0.0";
  
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-playfair font-bold">Customer Reviews</h2>
      
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-6 w-60" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-6 w-60" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          {/* Review Summary */}
          <div className="flex flex-col sm:flex-row gap-8 items-center border-b pb-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-purple mb-2">{averageRating}</div>
              <div className="flex text-gold mb-1">
                {renderStars(Number(averageRating))}
              </div>
              <div className="text-sm text-gray-500">
                Based on {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              </div>
            </div>
            
            {/* Rating distribution - static for now */}
            <div className="flex-grow space-y-2">
              {[5, 4, 3, 2, 1].map(stars => {
                const count = reviews.filter(r => Math.floor(r.rating) === stars).length;
                const percentage = reviews.length ? (count / reviews.length) * 100 : 0;
                
                return (
                  <div key={stars} className="flex items-center text-sm">
                    <div className="w-20">{stars} stars</div>
                    <div className="flex-grow mx-4 bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-gold h-2.5 rounded-full" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="w-8 text-right text-gray-500">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Write a review form */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Write a Review</h3>
            {!isAuthenticated ? (
              <div className="flex items-center p-4 bg-orange-50 text-orange-800 rounded-md">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                <div>
                  <p>Please <a href="/login" className="font-medium underline">login</a> to write a review.</p>
                </div>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <FormLabel>Your Rating</FormLabel>
                    <div className="flex gap-1 mt-1 text-2xl">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => handleRatingClick(rating)}
                          onMouseEnter={() => setHoverRating(rating)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="text-gray-300 hover:text-gold transition-colors focus:outline-none"
                        >
                          <Star
                            className={`h-6 w-6 ${
                              (hoverRating ? rating <= hoverRating : rating <= selectedRating)
                                ? "fill-current text-gold"
                                : ""
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    {form.formState.errors.rating && (
                      <p className="text-red-500 text-sm mt-1">Please select a rating</p>
                    )}
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="comment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Review</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Share your experience with this product..."
                            {...field}
                            className="min-h-[100px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="bg-purple hover:bg-purple/90 text-white"
                  >
                    Submit Review
                  </Button>
                </form>
              </Form>
            )}
          </div>
          
          {/* Reviews List */}
          {reviews.length > 0 ? (
            <div className="space-y-6">
              {reviews.map((review) => (
                <div key={review.id} className="border-b pb-6">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex text-gold mb-1">
                        {renderStars(review.rating)}
                      </div>
                      <div className="font-medium">User ID: {review.userId}</div>
                      <div className="text-sm text-gray-500">
                        {format(new Date(review.createdAt), "MMMM d, yyyy")}
                      </div>
                    </div>
                    {review.userId === user?.id && (
                      <Button variant="ghost" size="sm" className="text-gray-500">
                        Edit
                      </Button>
                    )}
                  </div>
                  <p className="text-gray-700 mt-2">{review.comment}</p>
                  
                  {review.images && Array.isArray(review.images) && review.images.length > 0 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto">
                      {review.images.map((image, i) => (
                        <img 
                          key={i}
                          src={image}
                          alt={`Review image ${i + 1}`}
                          className="w-16 h-16 object-cover rounded-md"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No reviews yet. Be the first to review this product!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReviewsSection;
