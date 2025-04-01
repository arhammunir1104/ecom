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
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Lock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Password validation schema
const passwordSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    otp: z.string().min(6, "OTP must be 6 digits"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordFormValues = z.infer<typeof passwordSchema>;

const ResetPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [searchParams, setLocation] = useLocation();
  const { toast } = useToast();

  // Extract email and OTP from URL query parameters
  const params = new URLSearchParams(searchParams);
  const emailParam = params.get("email") || "";
  const otpParam = params.get("otp") || "";

  // Initialize form
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      email: emailParam,
      otp: otpParam,
      password: "",
      confirmPassword: "",
    },
  });

  // Update form values if URL parameters change
  useEffect(() => {
    form.setValue("email", emailParam);
    form.setValue("otp", otpParam);
  }, [emailParam, otpParam, form]);

  // Handle form submission
  const onSubmit = async (data: ResetPasswordFormValues) => {
    setIsLoading(true);
    try {
      // Send request to API
      const response = await axios.post("/api/auth/reset-password", data);
      
      // Handle success
      setResetComplete(true);
      toast({
        title: "Password Reset Successful",
        description: "Your password has been reset successfully. You can now log in with your new password.",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Reset Failed",
        description: error.response?.data?.message || "Failed to reset password. Please try again.",
        variant: "destructive",
      });
      console.error("Password reset error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Success view after password reset
  if (resetComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Password Reset Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-primary/10 p-4">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
              <p className="text-center text-muted-foreground">
                Your password has been reset successfully. You can now log in with your new password.
              </p>
              <Button asChild className="w-full mt-4">
                <Link href="/auth/login">
                  Continue to Login
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error view if no email or OTP
  if (!emailParam || !otpParam) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Invalid Reset Request</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                The reset link is invalid or missing required information. Please restart the password reset process.
              </AlertDescription>
            </Alert>
            <Button asChild className="w-full">
              <Link href="/auth/forgot-password">
                Start Password Reset
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main form view
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Reset Your Password</CardTitle>
          <CardDescription>
            Create a new strong password that you don't use for other websites
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Enter your new password" 
                        {...field} 
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Confirm your new password" 
                        {...field} 
                        disabled={isLoading}
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
                      Resetting Password...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Reset Password
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
                  <Link href="/auth/verify-reset-code">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Verification
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

export default ResetPassword;