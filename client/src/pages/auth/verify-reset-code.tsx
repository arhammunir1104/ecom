import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import axios from "axios";

// Components
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { ArrowLeft, ShieldCheck, Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

// Form schema
const verifyOTPSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
});

type VerifyOTPFormValues = z.infer<typeof verifyOTPSchema>;

const VerifyResetCode = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");

  // Initialize form
  const form = useForm<VerifyOTPFormValues>({
    resolver: zodResolver(verifyOTPSchema),
    defaultValues: {
      otp: "",
    },
  });

  // Extract email from query parameters on page load
  useEffect(() => {
    const params = new URLSearchParams(location);
    const emailParam = params.get("email");
    
    if (emailParam) {
      setEmail(emailParam);
    } else {
      // If no email was provided, redirect back to forgot password
      toast({
        title: "Missing Email",
        description: "Please start the password reset process again",
        variant: "destructive",
      });
      setLocation("/auth/forgot-password");
    }
  }, [location, setLocation, toast]);

  // Handle form submission
  const onSubmit = async (data: VerifyOTPFormValues) => {
    if (!email) {
      toast({
        title: "Missing Email",
        description: "Please start the password reset process again",
        variant: "destructive",
      });
      setLocation("/auth/forgot-password");
      return;
    }

    setIsLoading(true);
    try {
      // Send request to API with email from URL and OTP from form
      const response = await axios.post("/api/auth/verify-reset-code", {
        email: email,
        otp: data.otp
      });
      
      // Redirect to reset password page with email and OTP in query params
      setLocation(`/auth/reset-password?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(data.otp)}`);
      
      toast({
        title: "Verification Successful",
        description: "You can now reset your password",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Verification Failed", 
        description: error.response?.data?.message || "Invalid or expired verification code",
        variant: "destructive",
      });
      console.error("OTP verification error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Verify Reset Code</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to your email address to verify your identity
          </CardDescription>
        </CardHeader>
        <CardContent>
          {email && (
            <div className="mb-4 flex items-center space-x-2 p-3 bg-muted rounded-md">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium truncate">{email}</span>
            </div>
          )}
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <InputOTP 
                        maxLength={6} 
                        {...field} 
                        disabled={isLoading}
                        render={({ slots }) => (
                          <InputOTPGroup>
                            {slots.map((slot, index) => (
                              <InputOTPSlot key={index} {...slot} />
                            ))}
                          </InputOTPGroup>
                        )} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-2">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying Code...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Verify Code
                    </>
                  )}
                </Button>
                
                <Button 
                  type="button"
                  variant="ghost" 
                  asChild 
                  className="w-full"
                  disabled={isLoading}
                >
                  <Link href="/auth/forgot-password">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Reset Request
                  </Link>
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center border-t pt-4">
          <div className="text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link href="/auth/login" className="font-medium text-primary hover:text-primary/80">
              Back to login
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default VerifyResetCode;