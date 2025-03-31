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
import { getAuth, confirmPasswordReset, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
  const auth = getAuth();

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
        
        // Get the current Firebase user
        const currentUser = auth.currentUser;
        
        // Create an API endpoint request to update the password
        const response = await fetch('/api/auth/firebase-password-reset', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            newPassword: values.password,
            resetDocId
          })
        });
        
        // If the server can't handle it directly, we'll use the Firebase client SDK
        if (!response.ok) {
          // If no current user is logged in, re-authenticate using the reset email flow
          if (!currentUser) {
            // Send a regular Firebase password reset email
            await sendPasswordResetEmail(auth, email);
            
            toast({
              title: "Password Reset Email Sent",
              description: "Please check your email to complete the password reset process.",
              variant: "default",
            });
            
            // Mark the reset as processed
            await updateDoc(resetDocRef, {
              resetProcessed: true,
              resetProcessedAt: new Date(),
            });
            
            setResetComplete(true);
            
            // Clear session storage
            sessionStorage.removeItem("resetEmail");
            sessionStorage.removeItem("resetDocId");
            return;
          }
          
          // If user is logged in, update their password directly
          await currentUser.updatePassword(values.password);
        }
        
        // If we got here, either the API call worked or we updated the password via client SDK
        
        // Mark the reset as complete in Firestore
        await updateDoc(resetDocRef, {
          resetComplete: true,
          resetCompletedAt: new Date(),
        });
        
        setResetComplete(true);
        toast({
          title: "Password Reset Successful",
          description: "Your password has been successfully reset. You can now log in with your new password.",
        });
        
        // Clear session storage
        sessionStorage.removeItem("resetEmail");
        sessionStorage.removeItem("resetDocId");
        
        // Sign out any current session to ensure the user logs in with new password
        await auth.signOut();
        
      } catch (authError: any) {
        console.error("Auth error:", authError);
        
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
        
        // Handle other errors
        toast({
          title: "Password Reset Failed",
          description: authError.message || "An error occurred while resetting your password.",
          variant: "destructive",
        });
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