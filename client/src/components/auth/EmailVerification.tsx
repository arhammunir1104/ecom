import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface EmailVerificationProps {
  email: string;
  onSuccess: () => void;
  onCancel: () => void;
  userData?: any;
}

export default function EmailVerification({ email, onSuccess, onCancel, userData }: EmailVerificationProps) {
  const { toast } = useToast();
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const handleVerification = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the complete 6-digit code.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const res = await apiRequest("POST", "/api/auth/verify-email", { 
        email, 
        token: verificationCode,
        userData: userData
      });
      
      if (res.ok) {
        toast({
          title: "Verification successful",
          description: "Your email has been verified.",
        });
        onSuccess();
      } else {
        const data = await res.json();
        throw new Error(data.message || "Verification failed");
      }
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "The code you entered is invalid or expired.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      setIsResending(true);
      const res = await apiRequest("POST", "/api/auth/resend-verification", { email });
      
      if (res.ok) {
        setSecondsLeft(60);
        
        const countdown = setInterval(() => {
          setSecondsLeft((prev) => {
            if (prev <= 1) {
              clearInterval(countdown);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        toast({
          title: "Code resent",
          description: "A new verification code has been sent to your email.",
        });
      } else {
        const data = await res.json();
        throw new Error(data.message || "Failed to resend code");
      }
    } catch (error: any) {
      toast({
        title: "Failed to resend code",
        description: error.message || "An unexpected error occurred.",
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
          <CardTitle className="text-2xl font-bold text-center">Email Verification</CardTitle>
          <CardDescription className="text-center">
            Enter the 6-digit code sent to {email}
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
          <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
            Back to signup
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}