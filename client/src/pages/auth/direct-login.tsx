import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { getAuth, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function DirectLogin() {
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      
      // Add scopes
      provider.addScope('email');
      provider.addScope('profile');
      
      // Set custom parameters
      provider.setCustomParameters({
        prompt: "select_account"
      });
      
      // Sign in with popup
      const result = await signInWithPopup(auth, provider);
      
      // Success! Show toast and redirect
      toast({
        title: "Login Successful",
        description: `Welcome, ${result.user.displayName || result.user.email}!`,
      });
      
      // Redirect after successful login
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (error: any) {
      console.error("Google login error:", error);
      
      // Show specific error message
      let errorMessage = "Failed to login with Google. Please try again.";
      if (error.code === 'auth/popup-blocked') {
        errorMessage = "Popup was blocked. Please allow popups for this site.";
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = "This domain is not authorized in Firebase. Please contact support.";
      }
      
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Missing Fields",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      const auth = getAuth();
      
      // Try to login
      await signInWithEmailAndPassword(auth, email, password);
      
      // Success! Show toast and redirect
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
      
      // Redirect after successful login
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (error: any) {
      console.error("Email login error:", error);
      
      // If user doesn't exist, try to create account
      if (error.code === 'auth/user-not-found') {
        try {
          // Try to create a new account
          const auth = getAuth();
          await createUserWithEmailAndPassword(auth, email, password);
          
          toast({
            title: "Account Created",
            description: "Your account has been created and you're now signed in!",
          });
          
          // Redirect after successful registration
          setTimeout(() => {
            window.location.href = "/";
          }, 1000);
          return;
        } catch (createError: any) {
          console.error("Account creation error:", createError);
          
          if (createError.code === 'auth/email-already-in-use') {
            toast({
              title: "Login Failed",
              description: "This email is already in use but the password is incorrect",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Account Creation Failed",
              description: "Could not create a new account. Please try again.",
              variant: "destructive",
            });
          }
        }
      } else {
        // Show proper error message for login failures
        let errorMessage = "Invalid email or password";
        if (error.code === 'auth/too-many-requests') {
          errorMessage = "Too many failed login attempts. Please try again later.";
        }
        
        toast({
          title: "Login Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Direct Authentication</CardTitle>
          <CardDescription className="text-center">
            Login directly with Firebase Authentication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="your.email@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Authenticating..." : "Login / Sign Up"}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleGoogleLogin}
            className="w-full"
            disabled={isLoading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
              <path d="M1 1h22v22H1z" fill="none" />
            </svg>
            Continue with Google
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Back to{" "}
            <a href="/" className="text-primary hover:underline">
              Home
            </a>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}