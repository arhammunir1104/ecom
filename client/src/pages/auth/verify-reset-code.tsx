import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { apiRequest } from "@/lib/queryClient";

export default function VerifyResetCode() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  
  // Parse userId from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("userId");
    if (id) {
      setUserId(parseInt(id, 10));
    } else {
      // If no userId, redirect back to forgot password
      toast({
        title: "Error",
        description: "Invalid request. Please try again.",
        variant: "destructive",
      });
      setLocation("/auth/forgot-password");
    }
  }, []);
  
  // Timer for resend code button
  useEffect(() => {
    if (secondsLeft > 0) {
      const timer = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [secondsLeft]);

  const handleVerification = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/verify-reset-code", {
        userId,
        otp: verificationCode,
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Verification successful",
          description: "Now you can set a new password",
        });
        // Redirect to reset password page with token
        setLocation(`/auth/reset-password?userId=${userId}&token=${data.resetToken}`);
      } else {
        throw new Error(data.message || "Invalid verification code");
      }
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
      setVerificationCode(""); // Clear input on error
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleResendCode = async () => {
    if (!userId) return;
    
    setIsResending(true);
    try {
      // Get the email address first
      const emailResponse = await apiRequest("GET", `/api/auth/user/${userId}`);
      const userData = await emailResponse.json();
      
      if (!emailResponse.ok || !userData.email) {
        throw new Error("Could not retrieve user information");
      }
      
      // Send new password reset email
      const response = await apiRequest("POST", "/api/auth/forgot-password", {
        email: userData.email,
      });
      
      if (response.ok) {
        toast({
          title: "Code resent",
          description: "A new verification code has been sent to your email",
        });
        setSecondsLeft(60); // Start cooldown timer
      } else {
        const data = await response.json();
        throw new Error(data.message || "Failed to resend code");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resend code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Verify Reset Code</CardTitle>
          <CardDescription className="text-center">
            Enter the 6-digit code sent to your email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center py-4">
            <InputOTP
              maxLength={6}
              value={verificationCode}
              onChange={setVerificationCode}
              disabled={isLoading}
              render={({ slots }) => (
                <InputOTPGroup>
                  {slots.map((slot, index) => (
                    <InputOTPSlot key={index} {...slot} />
                  ))}
                </InputOTPGroup>
              )}
            />
          </div>
          
          <Button 
            onClick={handleVerification} 
            className="w-full" 
            disabled={isLoading || verificationCode.length !== 6}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify"
            )}
          </Button>
          
          <div className="text-center mt-4">
            <Button 
              variant="link"
              onClick={handleResendCode}
              disabled={isResending || secondsLeft > 0}
            >
              {secondsLeft > 0
                ? `Resend code in ${secondsLeft}s`
                : isResending
                ? "Sending..."
                : "Resend code"}
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="ghost" asChild>
            <Link to="/auth/forgot-password" className="flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}