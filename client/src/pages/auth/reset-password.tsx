import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import { resetPasswordWithOTP } from "@/lib/firebaseService";
import axios from "axios";

// Password validation schema
const passwordSchema = z
  .object({
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

export default function ResetPassword() {
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [resetDocId, setResetDocId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    // Get email from session storage
    const storedEmail = sessionStorage.getItem("resetEmail");
    const docId = sessionStorage.getItem("resetDocId");
    const resetToken = sessionStorage.getItem("resetToken");
    
    console.log("Init reset password with:", { storedEmail, docId, hasToken: !!resetToken });
    
    if (!storedEmail) {
      toast({
        title: "Session Expired",
        description: "Please restart the password reset process",
        variant: "destructive",
      });
      setLocation("/auth/forgot-password");
      return;
    }
    
    if (!resetToken) {
      toast({
        title: "Verification Required",
        description: "You need to verify your identity first",
        variant: "destructive",
      });
      setLocation("/auth/verify-reset-code");
      return;
    }
    
    setEmail(storedEmail);
    if (docId) setResetDocId(docId);
    
    // We don't need to validate from Firebase document anymore
    // We trust the server-side token validation instead
    console.log("Reset token is present, ready to reset password");
  }, [toast, setLocation]);

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!email) return;
    
    setIsLoading(true);
    try {
      console.log("Processing direct password reset for email:", email);
      
      // Get the resetToken from multiple storage locations for redundancy
      let resetToken = sessionStorage.getItem("resetToken");
      
      // Try localStorage as a backup if session storage failed
      if (!resetToken) {
        resetToken = localStorage.getItem("temp_resetToken");
        
        if (resetToken) {
          console.log("Retrieved reset token from localStorage backup");
          // Move it back to session storage where it belongs
          sessionStorage.setItem("resetToken", resetToken);
        }
      }
      
      // If no reset token in any storage, we need to go back to verification
      if (!resetToken) {
        console.error("No reset token found in any storage location");
        // We should not proceed without a valid reset token from the server
        toast({
          title: "Verification Required",
          description: "You must verify your identity first",
          variant: "destructive",
        });
        setLocation("/auth/verify-reset-code");
        return;
      }
      
      // Get user ID from session storage if available (for more reliable verification)
      const userId = sessionStorage.getItem("resetUserId");
      
      console.log(`Using reset token: ${resetToken} for password reset`);
      
      // Prepare request payload with all available identifiers for redundancy
      const resetPayload: any = {
        email: email,
        resetToken: resetToken,
        newPassword: values.password
      };
      
      // Add userId to payload if available
      if (userId) {
        resetPayload.userId = userId;
        console.log(`Including userId: ${userId} in reset request`);
      }
      
      // If we have a Firebase document ID, include it as well
      if (resetDocId) {
        resetPayload.resetDocId = resetDocId;
        console.log(`Including resetDocId: ${resetDocId} in reset request`);
      }
      
      // Directly call our server-side reset endpoint that handles both Firebase and PostgreSQL
      console.log("Sending reset request with payload:", resetPayload);
      const response = await axios.post('/api/auth/reset-password', resetPayload);
      
      console.log("Password reset response:", response.data);
      
      if (response.data.success) {
        console.log("Password reset successful");
        setResetComplete(true);
        
        toast({
          title: "Password Reset Successful",
          description: "Your password has been reset. You can now log in with your new password.",
          variant: "default",
        });
        
        // Clear all storage
        sessionStorage.removeItem("resetEmail");
        sessionStorage.removeItem("resetDocId");
        sessionStorage.removeItem("resetToken");
        sessionStorage.removeItem("resetUserId");
        localStorage.removeItem("temp_resetToken");
        
        // Sign out any current session to ensure the user logs in with new password
        if (auth.currentUser) {
          await auth.signOut();
        }
      } else {
        throw new Error(response.data.message || "Failed to reset password. Please try again.");
      }
    } catch (error: any) {
      console.error("Error in password reset:", error);
      
      // Handle specific error codes
      if (error.response?.data?.message) {
        toast({
          title: "Error",
          description: error.response.data.message,
          variant: "destructive",
        });
      } else if (error.code === 'auth/requires-recent-login') {
        toast({
          title: "Authentication Required",
          description: "For security reasons, please log in again before changing your password.",
          variant: "destructive",
        });
        
        // Sign out and redirect to login
        await auth.signOut();
        setLocation("/auth/login");
        return;
      } else {
        toast({
          title: "Error",
          description: error.message || "An error occurred while resetting your password. Please try again.",
          variant: "destructive",
        });
      }
      
      // If there was a critical error, redirect back to the forgot password page
      if (error.response?.status === 400 || error.response?.status === 404) {
        toast({
          title: "Reset Failed",
          description: "Your reset token may have expired. Please restart the password reset process.",
          variant: "destructive",
        });
        
        setTimeout(() => {
          setLocation("/auth/forgot-password");
        }, 3000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {resetComplete ? "Password Reset Complete" : "Create New Password"}
          </CardTitle>
          <CardDescription className="text-center">
            {resetComplete
              ? "Your password has been successfully updated"
              : "Enter a new password for your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!resetComplete ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter new password"
                            {...field}
                            className="pr-10"
                            disabled={isLoading}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-2.5"
                            onClick={togglePasswordVisibility}
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Password must be at least 8 characters and include uppercase, lowercase, 
                        number, and special character.
                      </FormDescription>
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
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm new password"
                            {...field}
                            className="pr-10"
                            disabled={isLoading}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-2.5"
                            onClick={toggleConfirmPasswordVisibility}
                            tabIndex={-1}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
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
                      Resetting Password...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <Lock className="h-16 w-16 text-primary" />
              </div>
              <p className="text-sm">
                Your password has been successfully reset. You can now log in with your new password.
              </p>
              <Button className="w-full" asChild>
                <Link to="/auth/login">Go to Login</Link>
              </Button>
            </div>
          )}
        </CardContent>
        {!resetComplete && (
          <CardFooter className="flex justify-center">
            <Button variant="ghost" asChild>
              <Link to="/auth/login" className="flex items-center">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Link>
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}