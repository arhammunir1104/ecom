import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, Lock, Loader2, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Form validation schema with password requirements
const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });
  
  // Parse userId and resetToken from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("userId");
    const token = params.get("token");
    
    if (id && token) {
      setUserId(parseInt(id, 10));
      setResetToken(token);
    } else {
      // If missing params, redirect back to forgot password
      toast({
        title: "Error",
        description: "Invalid password reset request. Please try again.",
        variant: "destructive",
      });
      setLocation("/auth/forgot-password");
    }
  }, []);
  
  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!userId || !resetToken) return;
    
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/reset-password", {
        userId,
        resetToken,
        newPassword: values.password,
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.isFirebaseUser) {
          // For Firebase users, we need to handle differently
          toast({
            title: "Firebase Account Detected",
            description: data.message,
          });
          // Redirect to login with special message
          setTimeout(() => {
            setLocation("/auth/login");
          }, 3000);
        } else {
          // Success for regular users
          setIsSuccess(true);
          toast({
            title: "Password Reset Successful",
            description: "Your password has been reset successfully.",
          });
        }
      } else {
        throw new Error(data.message || "Failed to reset password");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleReturnToLogin = () => {
    setLocation("/auth/login");
  };

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isSuccess ? "Password Reset Complete" : "Reset Your Password"}
          </CardTitle>
          <CardDescription className="text-center">
            {isSuccess 
              ? "Your password has been updated successfully"
              : "Create a new secure password for your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSuccess ? (
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
                            {...field}
                            className="pl-10 pr-10"
                            disabled={isLoading}
                          />
                          <Lock className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                          <button
                            type="button"
                            className="absolute right-3 top-2.5 text-muted-foreground"
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        </div>
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
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            {...field}
                            className="pl-10 pr-10"
                            disabled={isLoading}
                          />
                          <Lock className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                          <button
                            type="button"
                            className="absolute right-3 top-2.5 text-muted-foreground"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            tabIndex={-1}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p>Password must:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Be at least 8 characters long</li>
                    <li>Include at least one uppercase letter</li>
                    <li>Include at least one lowercase letter</li>
                    <li>Include at least one number</li>
                  </ul>
                </div>
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
            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center justify-center space-y-2">
                <CheckCircle className="h-16 w-16 text-primary" />
                <p className="text-center">
                  Your password has been reset successfully. You can now log in with your new password.
                </p>
              </div>
              <Button className="w-full" onClick={handleReturnToLogin}>
                Return to Login
              </Button>
            </div>
          )}
        </CardContent>
        {!isSuccess && (
          <CardFooter className="flex justify-center">
            <Button variant="ghost" asChild>
              <Link to="/auth/login">Cancel and return to login</Link>
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}