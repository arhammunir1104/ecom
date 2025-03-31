import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Link, useLocation } from "wouter";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { sendPasswordResetOTP } from "@/lib/emailService";
import { doc, setDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Form validation schema
const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  // Generate a 6-digit OTP
  const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setIsLoading(true);
    try {
      const email = values.email.trim().toLowerCase();
      setEmailAddress(email);
      
      // Generate a 6-digit OTP
      const otp = generateOTP();
      
      // Store OTP in Firestore with 5-minute expiration
      const otpRef = doc(collection(db, "passwordResets"));
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5-minute expiry
      
      await setDoc(otpRef, {
        email,
        otp,
        expiresAt: Timestamp.fromDate(expiresAt),
        attempts: 0,
        createdAt: Timestamp.fromDate(new Date())
      });
      
      // Send the OTP via email
      await sendPasswordResetOTP(email, otp);
      
      setEmailSent(true);
      toast({
        title: "Verification Code Sent",
        description: "Check your email for a 6-digit verification code"
      });
      
      // Store the document ID in session storage for the next step
      sessionStorage.setItem("resetDocId", otpRef.id);
    } catch (error: any) {
      console.error("Error sending reset code:", error);
      toast({
        title: "Error",
        description: "There was an error sending the verification code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    // Navigate to the OTP verification page
    setLocation("/auth/verify-reset-code");
  };

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {emailSent ? "Check Your Email" : "Forgot Password"}
          </CardTitle>
          <CardDescription className="text-center">
            {emailSent
              ? "We've sent you a verification code"
              : "Enter your email address and we'll send you a verification code"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!emailSent ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="email@example.com"
                            {...field}
                            className="pl-10"
                            disabled={isLoading}
                          />
                          <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Verification Code"
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-center">
                We've sent a 6-digit verification code to <strong>{emailAddress}</strong>.
                The code will expire in 5 minutes.
              </p>
              <p className="text-sm text-center text-muted-foreground">
                If you don't see the email, check your spam folder.
              </p>
              <Button className="w-full" onClick={handleContinue}>
                Enter Verification Code
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="ghost" asChild>
            <Link to="/auth/login" className="flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to login
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}