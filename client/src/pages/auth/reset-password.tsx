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
    // Get email and reset document ID from session storage
    const storedEmail = sessionStorage.getItem("resetEmail");
    const docId = sessionStorage.getItem("resetDocId");
    
    if (!storedEmail || !docId) {
      toast({
        title: "Session Expired",
        description: "Please restart the password reset process",
        variant: "destructive",
      });
      setLocation("/auth/forgot-password");
      return;
    }
    
    setEmail(storedEmail);
    setResetDocId(docId);
    
    // Validate that the reset request was verified
    const validateResetRequest = async () => {
      try {
        const resetDocRef = doc(db, "passwordResets", docId);
        const resetDoc = await getDoc(resetDocRef);
        
        if (!resetDoc.exists()) {
          toast({
            title: "Invalid Reset Request",
            description: "Please restart the password reset process",
            variant: "destructive",
          });
          setLocation("/auth/forgot-password");
          return;
        }
        
        const data = resetDoc.data();
        
        // Check if verified
        if (!data.verified) {
          toast({
            title: "Verification Required",
            description: "Please verify your email first",
            variant: "destructive",
          });
          setLocation("/auth/verify-reset-code");
          return;
        }
        
        // Check expiration (10 minutes after verification)
        const verifiedAt = data.verifiedAt.toDate();
        const expiryTime = new Date(verifiedAt.getTime() + 10 * 60000); // 10 minutes
        const now = new Date();
        
        if (now > expiryTime) {
          toast({
            title: "Reset Link Expired",
            description: "Please restart the password reset process",
            variant: "destructive",
          });
          setLocation("/auth/forgot-password");
          return;
        }
      } catch (error) {
        console.error("Error validating reset request:", error);
        toast({
          title: "Error",
          description: "An error occurred. Please try again.",
          variant: "destructive",
        });
        setLocation("/auth/forgot-password");
      }
    };
    
    validateResetRequest();
  }, [toast, setLocation]);

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!email || !resetDocId) return;
    
    setIsLoading(true);
    try {
      // First, check if the OTP and reset process is valid
      try {
        const resetDocRef = doc(db, "passwordResets", resetDocId);
        const resetDoc = await getDoc(resetDocRef);
        
        // Ensure that the OTP verification was completed
        if (!resetDoc.exists() || !resetDoc.data().verified) {
          toast({
            title: "Verification Required",
            description: "You must verify your identity first",
            variant: "destructive",
          });
          setLocation("/auth/verify-reset-code");
          return;
        }
        
        console.log("Verified reset document found, proceeding with password reset");
        
        // Add detailed logging to track the reset process
        const verificationCode = resetDoc.data().otp === "VERIFIED" 
          ? resetDocId 
          : resetDoc.data().otp || resetDocId;
        
        // First, use the server to verify the reset code before attempting to reset the password
        try {
          console.log(`Verifying reset code with server for email: ${email}`);
          const verifyResponse = await axios.post('/api/auth/verify-reset-code', {
            email,
            code: verificationCode
          });
          
          if (verifyResponse?.data?.success) {
            console.log("Server verification successful:", verifyResponse.data);
          } else {
            console.warn("Server verification returned invalid status:", verifyResponse?.data);
          }
        } catch (verifyError) {
          console.error("Error verifying reset code with server:", verifyError);
          // We'll still proceed with Firebase reset even if this fails
        }
        
        // Use our improved resetPasswordWithOTP function
        const success = await resetPasswordWithOTP(
          email,
          values.password,
          resetDocId
        );
        
        if (success) {
          console.log("Password reset request processed successfully");
          setResetComplete(true);
          
          // Explicitly sync the password with the database too
          try {
            await axios.post('/api/auth/sync-password', {
              email,
              password: values.password,
              forceSyncAll: true // Force sync across all systems
            });
            console.log("Password sync with database completed");
          } catch (syncError) {
            console.warn("Password sync with database failed:", syncError);
            // Continue anyway since Firebase Auth was updated
          }
          
          toast({
            title: "Password Reset Successful",
            description: "Your password has been reset. You can now log in with your new password.",
            variant: "default",
          });
          
          // Clear session storage
          sessionStorage.removeItem("resetEmail");
          sessionStorage.removeItem("resetDocId");
          
          // Sign out any current session to ensure the user logs in with new password
          if (auth.currentUser) {
            await auth.signOut();
          }
        } else {
          throw new Error("Failed to reset password. Please try again.");
        }
        
      } catch (authError: any) {
        console.error("Auth error during password reset:", authError);
        
        if (authError.code === 'auth/requires-recent-login') {
          // User needs to re-authenticate before changing password
          toast({
            title: "Authentication Required",
            description: "For security reasons, please log in again before changing your password.",
            variant: "destructive",
          });
          
          // Sign out and redirect to login
          await auth.signOut();
          setLocation("/auth/login");
          return;
        }
        
        // Fall back to standard email reset if there was an error with direct update
        try {
          console.log("Falling back to standard password reset email for:", email);
          await sendPasswordResetEmail(auth, email);
          
          // Also attempt to sync with the PostgreSQL database
          try {
            await axios.post('/api/auth/request-password-reset', {
              email,
              resetCode: resetDocId
            });
            console.log("Database password reset request sent");
          } catch (dbResetError) {
            console.warn("Error requesting database password reset:", dbResetError);
          }
          
          setResetComplete(true);
          
          toast({
            title: "Password Reset Email Sent",
            description: "Please check your email to complete the password reset process.",
            variant: "default",
          });
          
          // Clear session storage
          sessionStorage.removeItem("resetEmail");
          sessionStorage.removeItem("resetDocId");
        } catch (resetError: any) {
          console.error("Reset email error:", resetError);
          
          let errorMessage = "An error occurred while resetting your password.";
          
          if (resetError.code === "auth/user-not-found") {
            errorMessage = "No account found with this email address.";
          } else if (resetError.code === "auth/invalid-email") {
            errorMessage = "Invalid email address format.";
          }
          
          toast({
            title: "Reset Failed",
            description: errorMessage,
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast({
        title: "Error",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
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