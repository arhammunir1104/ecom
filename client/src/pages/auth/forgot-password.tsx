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
import { resetPassword } from "@/lib/firebaseService";
import { apiRequest } from "@/lib/queryClient";

// Form validation schema
const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setIsLoading(true);
    try {
      // First check if this is a Firebase user
      try {
        // Try Firebase password reset first
        await resetPassword(values.email);
        setEmailSent(true);
        toast({
          title: "Reset Email Sent",
          description: "Check your email for password reset instructions",
        });
      } catch (firebaseError: any) {
        // If Firebase error is auth/user-not-found, try our custom backend
        if (firebaseError.code === 'auth/user-not-found') {
          // Try the custom backend for non-Firebase users
          const response = await apiRequest("POST", "/api/auth/forgot-password", {
            email: values.email,
          });
          
          const data = await response.json();
          
          if (response.ok) {
            if (data.userId) {
              setUserId(data.userId);
              setEmailSent(true);
            } else {
              // User not found in our system either, but we don't tell the user for security
              setEmailSent(true);
            }
            
            toast({
              title: "Reset Email Sent",
              description: "If an account exists with that email, a reset code has been sent",
            });
          } else {
            throw new Error(data.message || "Failed to process password reset request");
          }
        } else {
          // This is a different Firebase error, rethrow
          throw firebaseError;
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
      console.error("Password reset error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    if (userId) {
      // If we have a userId, this is a non-Firebase user and we redirect to the verification page
      setLocation(`/auth/verify-reset-code?userId=${userId}`);
    } else {
      // Otherwise, it's a Firebase user and they'll get email instructions
      setLocation("/auth/login");
    }
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
              ? "We've sent you instructions to reset your password"
              : "Enter your email address and we'll send you a reset link"}
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
                    "Send Reset Instructions"
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-center">
                We've sent instructions to reset your password to the email address you provided.
                Please check your inbox and follow the instructions.
              </p>
              <p className="text-sm text-center text-muted-foreground">
                If you don't see the email, check your spam folder.
              </p>
              <Button className="w-full" onClick={handleContinue}>
                Continue
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