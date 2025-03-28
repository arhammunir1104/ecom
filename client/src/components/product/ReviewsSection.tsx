import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarIcon } from "lucide-react";
import { Review } from "@shared/schema";

interface ReviewsSectionProps {
  productId: number;
  reviews: Review[];
  isLoading: boolean;
}

const ReviewsSection = ({ productId, reviews, isLoading }: ReviewsSectionProps) => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [newReview, setNewReview] = useState("");
  const [rating, setRating] = useState("5");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitReview = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Please login",
        description: "You need to be logged in to submit a review",
        variant: "destructive",
      });
      return;
    }

    if (!newReview.trim()) {
      toast({
        title: "Review required",
        description: "Please enter your review",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await apiRequest("POST", "/api/reviews", {
        productId,
        rating: parseInt(rating),
        comment: newReview,
      });

      toast({
        title: "Review submitted",
        description: "Thank you for your feedback!",
      });
      
      setNewReview("");
      setRating("5");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit your review",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate average rating
  const avgRating = reviews.length 
    ? (reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, index) => (
      <StarIcon 
        key={index} 
        className={`h-4 w-4 ${index < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
      />
    ));
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-1/4"></div>
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-playfair font-bold">Customer Reviews</h2>
      
      {/* Review summary */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex">
          {renderStars(Math.round(parseFloat(avgRating)))}
        </div>
        <span className="font-medium">{avgRating}/5</span>
        <span className="text-gray-500">({reviews.length} reviews)</span>
      </div>

      {/* Review form */}
      <div className="bg-gray-50 p-6 rounded-lg mb-8">
        <h3 className="font-medium text-lg mb-4">Write a Review</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="rating" className="block text-sm font-medium mb-1">
              Rating
            </label>
            <Select value={rating} onValueChange={setRating}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select your rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">★★★★★ (5/5)</SelectItem>
                <SelectItem value="4">★★★★☆ (4/5)</SelectItem>
                <SelectItem value="3">★★★☆☆ (3/5)</SelectItem>
                <SelectItem value="2">★★☆☆☆ (2/5)</SelectItem>
                <SelectItem value="1">★☆☆☆☆ (1/5)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="review" className="block text-sm font-medium mb-1">
              Your Review
            </label>
            <Textarea
              id="review"
              rows={4}
              placeholder="Share your experience with this product..."
              value={newReview}
              onChange={(e) => setNewReview(e.target.value)}
              className="w-full"
            />
          </div>
          <Button 
            onClick={handleSubmitReview} 
            disabled={isSubmitting || !isAuthenticated}
            className="bg-purple hover:bg-purple-dark text-white"
          >
            {isSubmitting ? "Submitting..." : "Submit Review"}
          </Button>
          {!isAuthenticated && (
            <p className="text-sm text-gray-500 mt-2">
              Please log in to leave a review
            </p>
          )}
        </div>
      </div>

      {/* Reviews list */}
      <div className="space-y-6">
        {reviews.length === 0 ? (
          <p className="text-gray-500 italic">No reviews yet. Be the first to review this product!</p>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="border-b border-gray-100 pb-6">
              <div className="flex justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={`https://api.dicebear.com/7.x/micah/svg?seed=${review.userId}`} alt="Avatar" />
                    <AvatarFallback>
                      {review.userId.toString().charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">
                    {review.userId === user?.id ? "You" : `User ${review.userId}`}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex mb-2">{renderStars(review.rating)}</div>
              <p className="text-gray-600">{review.comment}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ReviewsSection;