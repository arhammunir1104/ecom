import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "wouter";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Form schema
const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

const ForgotPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  // Initialize form
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  // Handle form submission
  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsLoading(true);
    try {
      // Send request to API
      const response = await axios.post("/api/auth/forgot-password", data);
      
      // Handle success
      setIsSuccess(true);
      toast({
        title: "Reset Code Sent",
        description: "If your email exists in our system, you'll receive a reset code shortly.",
      });
    } catch (error) {
      // Even if the request fails, we don't want to reveal if the email exists
      // So we still show a success message
      setIsSuccess(true);
      toast({
        title: "Reset Code Sent",
        description: "If your email exists in our system, you'll receive a reset code shortly.",
      });
      
      // Log error for debugging
      console.error("Forgot password error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Show success view after form submission
  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
            <CardDescription>
              We've sent a password reset code to your email address. Please check your inbox and spam folders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="bg-primary/10 border-primary/20 mb-4">
              <Mail className="h-4 w-4 text-primary" />
              <AlertDescription>
                The verification code will expire in 5 minutes. If you don't see the email, you may need to check your spam folder.
              </AlertDescription>
            </Alert>
            <div className="flex flex-col gap-4">
              <Button asChild variant="outline">
                <Link to={`/auth/verify-reset-code?email=${encodeURIComponent(form.getValues().email)}`}>
                  I have a reset code
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/auth/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to login
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show form for initial request
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a code to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="your.email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending reset code...
                  </>
                ) : (
                  "Send Reset Code"
                )}
              </Button>
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

export default ForgotPassword;