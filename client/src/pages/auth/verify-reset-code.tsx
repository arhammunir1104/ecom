import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Loader2, KeyRound } from "lucide-react";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

// Form validation schema
const verifyOtpSchema = z.object({
  otp: z.string().length(6, "Verification code must be 6 digits")
});

type VerifyOtpFormValues = z.infer<typeof verifyOtpSchema>;

export default function VerifyResetCode() {
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [resetDocId, setResetDocId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  
  const form = useForm<VerifyOtpFormValues>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: {
      otp: ""
    }
  });

  useEffect(() => {
    // Get document ID from session storage (set in forgot-password page)
    const docId = sessionStorage.getItem("resetDocId");
    if (!docId) {
      toast({
        title: "Session Expired",
        description: "Please restart the password reset process",
        variant: "destructive"
      });
      setLocation("/auth/forgot-password");
      return;
    }

    setResetDocId(docId);

    // Get reset document details
    const fetchResetDetails = async () => {
      try {
        const resetDocRef = doc(db, "passwordResets", docId);
        const resetDoc = await getDoc(resetDocRef);
        
        if (!resetDoc.exists()) {
          toast({
            title: "Invalid Reset Request",
            description: "Please restart the password reset process",
            variant: "destructive"
          });
          setLocation("/auth/forgot-password");
          return;
        }
        
        const data = resetDoc.data();
        setEmail(data.email);
        
        // Calculate time left
        const expiresAt = data.expiresAt.toDate();
        const now = new Date();
        const diffInMs = expiresAt.getTime() - now.getTime();
        const diffInMinutes = Math.floor(diffInMs / 60000);
        
        if (diffInMinutes <= 0) {
          toast({
            title: "Code Expired",
            description: "The verification code has expired. Please request a new one.",
            variant: "destructive"
          });
          setLocation("/auth/forgot-password");
          return;
        }
        
        setTimeLeft(diffInMinutes);
      } catch (error) {
        console.error("Error fetching reset details:", error);
        toast({
          title: "Error",
          description: "An error occurred. Please try again.",
          variant: "destructive"
        });
      }
    };
    
    fetchResetDetails();
  }, [toast, setLocation]);

  // Update timer every minute
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          toast({
            title: "Code Expired",
            description: "The verification code has expired. Please request a new one.",
            variant: "destructive"
          });
          setLocation("/auth/forgot-password");
          return 0;
        }
        return prev - 1;
      });
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, [timeLeft, toast, setLocation]);

  const onSubmit = async (values: VerifyOtpFormValues) => {
    if (!resetDocId) return;
    
    setIsLoading(true);
    try {
      const resetDocRef = doc(db, "passwordResets", resetDocId);
      const resetDoc = await getDoc(resetDocRef);
      
      if (!resetDoc.exists()) {
        toast({
          title: "Invalid Reset Request",
          description: "Please restart the password reset process",
          variant: "destructive"
        });
        setLocation("/auth/forgot-password");
        return;
      }
      
      const data = resetDoc.data();
      
      // Verify expiration
      const expiresAt = data.expiresAt.toDate();
      const now = new Date();
      if (now > expiresAt) {
        toast({
          title: "Code Expired",
          description: "The verification code has expired. Please request a new one.",
          variant: "destructive"
        });
        setLocation("/auth/forgot-password");
        return;
      }
      
      // Verify attempts
      if (data.attempts >= 5) {
        toast({
          title: "Too Many Attempts",
          description: "You've made too many incorrect attempts. Please request a new code.",
          variant: "destructive"
        });
        setLocation("/auth/forgot-password");
        return;
      }
      
      // Check OTP
      if (data.otp !== values.otp) {
        // Increment attempts
        await updateDoc(resetDocRef, {
          attempts: (data.attempts || 0) + 1
        });
        
        toast({
          title: "Invalid Code",
          description: "The verification code you entered is incorrect.",
          variant: "destructive"
        });
        return;
      }
      
      // Mark code as verified and erase OTP for security
      await updateDoc(resetDocRef, {
        verified: true,
        verifiedAt: Timestamp.fromDate(new Date()),
        otp: "VERIFIED" // Overwrite the OTP so it can't be reused
      });
      
      setVerified(true);
      
      toast({
        title: "Verification Successful",
        description: "You can now reset your password."
      });
      
    } catch (error: any) {
      console.error("Error verifying code:", error);
      toast({
        title: "Error",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    // Store email in session storage for the reset page
    if (email) {
      sessionStorage.setItem("resetEmail", email);
    }
    
    // Navigate to reset password page
    setLocation("/auth/reset-password");
  };

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {verified ? "Verification Successful" : "Verify Reset Code"}
          </CardTitle>
          <CardDescription className="text-center">
            {verified
              ? "You've successfully verified your identity"
              : `Enter the 6-digit code sent to your email ${timeLeft ? `(expires in ${timeLeft} min)` : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!verified ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem className="flex flex-col items-center justify-center">
                      <FormLabel className="text-center w-full mb-2">Verification Code</FormLabel>
                      <FormControl>
                        <div className="flex justify-center w-full">
                          <InputOTP 
                            maxLength={6} 
                            {...field} 
                            disabled={isLoading}
                            render={({ slots }) => (
                              <InputOTPGroup className="gap-2">
                                {slots.map((slot, index) => (
                                  <InputOTPSlot 
                                    key={index} 
                                    {...slot} 
                                    className="w-10 h-12 text-lg font-medium border-border"
                                  />
                                ))}
                              </InputOTPGroup>
                            )}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-center mt-2" />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify Code"
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <KeyRound className="h-16 w-16 text-primary" />
              </div>
              <p className="text-sm">
                Your identity has been verified. You can now create a new password.
              </p>
              <Button className="w-full" onClick={handleContinue}>
                Create New Password
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          {!verified && (
            <Button variant="ghost" asChild>
              <Link to="/auth/forgot-password" className="flex items-center">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Password Reset
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}