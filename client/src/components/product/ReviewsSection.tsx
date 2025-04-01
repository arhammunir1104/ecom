import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertCircle, LockIcon, StarIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  addProductReview,
  getProductReviews,
  getUserProductReview,
  hasUserPurchasedProduct,
} from "@/lib/firebaseService";

// Import this type to match what's returned from Firebase
interface ProductReview {
  id?: string;
  productId: number | string;
  userId: string;
  username: string;
  rating: number;
  comment: string;
  userPhotoURL?: string;
  purchaseVerified: boolean;
  createdAt: { toDate: () => Date };
}

interface ReviewsSectionProps {
  productId: number | string;
}

const ReviewsSection = ({ productId }: ReviewsSectionProps) => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUserReviewed, setHasUserReviewed] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [newReview, setNewReview] = useState("");
  const [rating, setRating] = useState("5");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingPurchase, setIsCheckingPurchase] = useState(false);

  // Load reviews from Firestore and check purchase status
  useEffect(() => {
    const loadReviewsAndCheckPurchase = async () => {
      setIsLoading(true);
      setIsCheckingPurchase(true);

      try {
        // Load reviews
        const productReviews = await getProductReviews(productId);
        setReviews(productReviews);

        // Check if current user has already reviewed this product
        if (user?.uid) {
          const userReview = await getUserProductReview(user.uid, productId);
          setHasUserReviewed(!!userReview);

          // Check if user has purchased this product
          const purchaseVerified = await hasUserPurchasedProduct(
            user.uid,
            productId,
          );
          setHasPurchased(purchaseVerified);
        }
      } catch (error) {
        console.error("Error loading reviews:", error);
        toast({
          title: "Error",
          description: "Failed to load product reviews",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
        setIsCheckingPurchase(false);
      }
    };

    loadReviewsAndCheckPurchase();
  }, [productId, user, toast]);

  const handleSubmitReview = async () => {
    if (!isAuthenticated || !user?.uid) {
      toast({
        title: "Please login",
        description: "You need to be logged in to submit a review",
        variant: "destructive",
      });
      return;
    }

    if (hasUserReviewed) {
      toast({
        title: "Already reviewed",
        description: "You have already submitted a review for this product",
        variant: "destructive",
      });
      return;
    }

    if (!hasPurchased) {
      toast({
        title: "Purchase required",
        description:
          "You need to purchase this product before leaving a review",
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
      // Getting proper display name for the review
      const displayName = user.email?.split("@")[0] || "Anonymous User";

      // Submit review using Firebase
      await addProductReview(user.uid, productId, {
        rating: parseInt(rating),
        comment: newReview,
        username: displayName,
        userPhotoURL: undefined, // Keep as undefined since the Firebase User doesn't have photoURL
        purchaseVerified: hasPurchased,
      });

      // Reload reviews to show the new one
      const updatedReviews = await getProductReviews(productId);
      setReviews(updatedReviews);
      setHasUserReviewed(true);

      toast({
        title: "Review submitted",
        description: "Thank you for your feedback!",
      });

      setNewReview("");
      setRating("5");
    } catch (error: any) {
      console.error("Error submitting review:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit your review",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate average rating
  const avgRating = reviews.length
    ? (
        reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length
      ).toFixed(1)
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

        {isAuthenticated && !isCheckingPurchase && !hasPurchased && (
          <Alert className="mb-4 bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">
              Purchase required
            </AlertTitle>
            <AlertDescription className="text-amber-700">
              You need to purchase this product before you can leave a review.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="rating" className="block text-sm font-medium mb-1">
              Rating
            </label>
            <Select
              value={rating}
              onValueChange={setRating}
              disabled={!hasPurchased}
            >
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
              placeholder={
                hasPurchased
                  ? "Share your experience with this product..."
                  : "Purchase this product to leave a review"
              }
              value={newReview}
              onChange={(e) => setNewReview(e.target.value)}
              className="w-full"
              disabled={!hasPurchased}
            />
          </div>
          <Button
            onClick={handleSubmitReview}
            disabled={isSubmitting || !isAuthenticated || !hasPurchased}
            className="bg-pink-200 hover:bg-pink-300 text-white"
          >
            {isSubmitting ? "Submitting..." : "Submit Review"}
          </Button>
          {!isAuthenticated && (
            <p className="text-sm text-gray-500 mt-2">
              Please log in to leave a review
            </p>
          )}
          {isAuthenticated && !hasPurchased && (
            <p className="text-sm text-gray-500 mt-2 flex items-center">
              <LockIcon className="h-3 w-3 mr-1" />
              You need to purchase this product to leave a review
            </p>
          )}
        </div>
      </div>

      {/* Reviews list */}
      <div className="space-y-6">
        {reviews.length === 0 ? (
          <p className="text-gray-500 italic">
            No reviews yet. Be the first to review this product!
          </p>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="border-b border-gray-100 pb-6">
              <div className="flex justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/micah/svg?seed=${review.userId}`}
                      alt="Avatar"
                    />
                    <AvatarFallback>
                      {review.userId.toString().charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-medium">
                      {review.userId === user?.uid ? "You" : review.username}
                    </span>
                    {review.purchaseVerified && (
                      <span className="inline-flex items-center ml-2 px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-800">
                        <svg
                          className="w-3 h-3 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                          ></path>
                        </svg>
                        Verified Purchase
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-500">
                  {review.createdAt?.toDate
                    ? review.createdAt.toDate().toLocaleDateString()
                    : "Unknown date"}
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
