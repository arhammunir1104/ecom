import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function DirectSignup() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      console.log("Creating user account with Firebase...");
      // Create the user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log("User created successfully:", user.uid);
      
      // Update the user's display name
      await updateProfile(user, {
        displayName: username
      });
      
      console.log("User profile updated in Firebase Auth");
      
      // Create a user document in Firestore
      const userDocRef = doc(db, "users", user.uid);
      
      console.log("Creating user profile in Firestore...");
      // Create user profile document structure
      const userData = {
        uid: user.uid,
        email: email,
        username: username,
        fullName: username,
        role: "user",
        twoFactorEnabled: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Create user profile in Firestore
      await setDoc(userDocRef, userData);
      
      console.log("Firestore document created successfully");
      
      // Register with the backend server for synchronization
      try {
        console.log("Syncing user with backend server...");
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            displayName: username,
            email: email,
            uid: user.uid,
            photoURL: user.photoURL
          }),
        });
        
        if (response.ok) {
          console.log("User synchronized with backend server successfully");
        } else {
          console.warn("Failed to sync user with backend server:", await response.json());
        }
      } catch (syncError) {
        console.error("Error syncing with backend:", syncError);
        // Non-critical, continue with signup
      }
      
      setSuccess("Account created successfully! You can now log in.");
      toast({
        title: "Account Created",
        description: "Your account has been created successfully. You can now log in.",
      });
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate("/login");
      }, 2000);
      
    } catch (error: any) {
      console.error("Error creating account:", error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        setError("This email is already registered. Try logging in instead.");
      } else if (error.code === 'auth/invalid-email') {
        setError("Please enter a valid email address.");
      } else if (error.code === 'auth/weak-password') {
        setError("Password should be at least 6 characters.");
      } else if (error.code === 'auth/operation-not-allowed') {
        setError("Email/password sign-up is disabled. Please contact administrator.");
      } else if (error.code === 'auth/network-request-failed') {
        setError("Network error. Please check your internet connection.");
      } else {
        setError(error.message || "An error occurred during signup. Please try again.");
      }
      
      toast({
        title: "Signup Failed",
        description: error.message || "Failed to create account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Direct Signup</CardTitle>
          <p className="text-center text-muted-foreground">
            Create a new account directly with Firebase
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters
              </p>
            </div>
            
            {error && (
              <div className="p-3 bg-destructive/15 text-destructive text-sm rounded-md">
                {error}
              </div>
            )}
            
            {success && (
              <div className="p-3 bg-green-100 text-green-800 text-sm rounded-md">
                {success}
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating Account..." : "Sign Up"}
            </Button>
            
            <div className="text-center text-sm">
              <p>
                Already have an account?{" "}
                <a href="/login" className="text-primary hover:underline">
                  Log in
                </a>
              </p>
            </div>
            
            <div className="text-xs text-muted-foreground mt-4">
              <p>
                This is a direct signup that bypasses our custom authentication flow
                and works directly with Firebase. Use this if you're having issues with
                the normal signup process.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}