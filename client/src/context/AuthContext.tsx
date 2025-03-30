import { createContext, useEffect, useState, ReactNode } from "react";
import { auth, onAuthChange } from "../lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "../lib/queryClient";
import { queryClient } from "../lib/queryClient";
import * as firebaseService from "../lib/firebaseService";
import { User as FirebaseUser } from "firebase/auth";

interface AuthUser {
  id?: number;  // For compatibility with existing code
  uid: string;  // Firebase UID
  username: string;
  email: string;
  fullName?: string;
  role: string;
  twoFactorEnabled?: boolean;
  photoURL?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string, recaptchaToken?: string) => Promise<{ requiresTwoFactor: boolean; email?: string }>;
  loginWithGoogle: () => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyTwoFactor: (email: string, token: string) => Promise<void>;
  setupTwoFactor: () => Promise<{ success: boolean; otpAuthUrl?: string }>;
  verifyTwoFactorSetup: (token: string) => Promise<{ success: boolean }>;
  disableTwoFactor: () => Promise<{ success: boolean }>;
  resendTwoFactorCode: () => Promise<{ success: boolean }>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  isLoading: true,
  login: async () => ({ requiresTwoFactor: false }),
  loginWithGoogle: async () => {},
  signup: async () => {},
  logout: async () => {},
  verifyTwoFactor: async () => {},
  setupTwoFactor: async () => ({ success: false }),
  verifyTwoFactorSetup: async () => ({ success: false }),
  disableTwoFactor: async () => ({ success: false }),
  resendTwoFactorCode: async () => ({ success: false }),
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        try {
          // Get user profile from Firestore
          const userProfile = await firebaseService.getUserProfile(firebaseUser.uid);
          
          if (userProfile) {
            // Convert Firestore profile to AuthUser format
            const authUser: AuthUser = {
              uid: userProfile.uid,
              username: userProfile.username,
              email: userProfile.email,
              fullName: userProfile.fullName,
              role: userProfile.role || "user",
              twoFactorEnabled: userProfile.twoFactorEnabled || false,
              photoURL: userProfile.photoURL
            };
            
            setUser(authUser);
            // Store both complete user object and firebaseUid separately for easier access
            localStorage.setItem('user', JSON.stringify(authUser));
            localStorage.setItem('firebaseUid', authUser.uid);
            console.log("User authenticated from Firestore:", authUser.username);
          } else {
            console.log("No Firestore profile found for user:", firebaseUser.uid);
            setUser(null);
          }
        } catch (error) {
          console.error("Error getting user data from Firestore:", error);
          setUser(null);
        }
      } else {
        console.log("No Firebase user found, clearing auth state");
        setUser(null);
        localStorage.removeItem('user');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string, recaptchaToken?: string): Promise<{ requiresTwoFactor: boolean; email?: string }> => {
    try {
      console.log("Starting email/password login");
      console.log("Attempting to sign in with email/password:", email);
      
      // Verify reCAPTCHA if needed
      if (recaptchaToken) {
        // We could validate the recaptcha token with the server if needed
        console.log("reCAPTCHA token received");
      }
      
      try {
        // Import Firebase authentication methods
        const { signInWithEmailAndPassword } = await import("firebase/auth");
        const { auth } = await import("@/lib/firebase");
        
        // Try to sign in with Firebase first
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("Firebase authentication successful for:", email);
        
        // Get Firebase UID
        const firebaseUid = userCredential.user.uid;
        
        // Use Firebase authentication and also sync with our backend
        try {
          // First, try to get the user from our own backend using the Firebase UID
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Firebase-UID': firebaseUid
          };
          
          // Make a request to our backend to get or create the user record
          const response = await fetch('/api/auth/google', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              displayName: userCredential.user.displayName,
              email: userCredential.user.email,
              uid: firebaseUid,
              photoURL: userCredential.user.photoURL
            }),
          });
          
          if (!response.ok) {
            const data = await response.json();
            console.error("Error syncing with backend:", data);
            throw new Error(data.message || "Failed to sync with backend");
          }
          
          // Get user data from response
          const userData = await response.json();
          console.log("User data from backend:", userData);
          
          // Check if two-factor authentication is enabled
          if (userData.twoFactorEnabled) {
            console.log("Two-factor authentication required for:", email);
            
            // Trigger 2FA verification process
            try {
              await apiRequest("POST", "/api/auth/2fa/send-code", { email });
            } catch (tfaError) {
              console.error("Error sending 2FA code:", tfaError);
              // Continue anyway - we'll show the 2FA input form
            }
            
            return { requiresTwoFactor: true, email: email };
          }
          
          // Create AuthUser from backend data
          const authUser: AuthUser = {
            uid: userData.firebaseUid || firebaseUid,
            username: userData.username,
            email: userData.email,
            fullName: userData.fullName,
            role: userData.role || "user",
            twoFactorEnabled: userData.twoFactorEnabled || false,
            photoURL: userData.photoURL || userCredential.user.photoURL
          };
          
          // Store authenticated user
          setUser(authUser);
          localStorage.setItem('user', JSON.stringify(authUser));
          
          // Invalidate queries that depend on authentication
          queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
          
          toast({
            title: "Login Successful",
            description: `Welcome back, ${authUser.username}!`,
          });
          
          return { requiresTwoFactor: false };
        } catch (backendError) {
          console.error("Error with backend synchronization:", backendError);
          // Fallback to using just the Firebase user data
          
          // Create minimal AuthUser from Firebase data
          const authUser: AuthUser = {
            uid: firebaseUid,
            username: userCredential.user.displayName || email.split('@')[0],
            email: email,
            fullName: userCredential.user.displayName,
            role: "user",
            twoFactorEnabled: false,
            photoURL: userCredential.user.photoURL
          };
          
          // Store authenticated user
          setUser(authUser);
          localStorage.setItem('user', JSON.stringify(authUser));
          
          toast({
            title: "Login Successful",
            description: `Welcome back, ${authUser.username}!`,
          });
          
          return { requiresTwoFactor: false };
        }
      } catch (firebaseError: any) {
        console.error("Error signing in with Firebase:", firebaseError);
        
        let errorMessage = "Invalid credentials. Please try again.";
        
        // Provide more specific error messages for common Firebase errors
        if (firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/invalid-credential') {
          errorMessage = "Incorrect email or password.";
        } else if (firebaseError.code === 'auth/too-many-requests') {
          errorMessage = "Too many login attempts. Please try again later or reset your password.";
        } else if (firebaseError.code === 'auth/user-disabled') {
          errorMessage = "This account has been disabled.";
        }
        
        // Try to create an account if the user doesn't exist in Firebase
        if (firebaseError.code === 'auth/user-not-found') {
          try {
            // Check if they exist in our backend but not in Firebase
            const backendResponse = await fetch('/api/auth/check-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            });
            
            if (backendResponse.ok) {
              toast({
                title: "Account migration needed",
                description: "Your account needs to be migrated. Please use the 'Forgot Password' option to set up a new password.",
                variant: "destructive",
              });
              return { requiresTwoFactor: false };
            }
          } catch (backendError) {
            console.error("Error checking backend for user:", backendError);
          }
        }
        
        toast({
          title: "Login Failed",
          description: errorMessage,
          variant: "destructive",
        });
        
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error("Login error:", error);
      
      // If we haven't shown a toast already, show one now
      if (!error.message?.includes("Login Failed")) {
        toast({
          title: "Login Failed",
          description: error.message || "An unexpected error occurred",
          variant: "destructive",
        });
      }
      
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    try {
      console.log("Starting Google login process");
      
      // Use the Firebase service to sign in with Google
      const firebaseUser = await firebaseService.signInWithGoogle();
      console.log("Firebase user authenticated:", firebaseUser.email);
      
      // The user profile is already stored in Firestore by signInWithGoogle function
      // We just need to get the user profile
      const userProfile = await firebaseService.getUserProfile(firebaseUser.uid);
      
      if (!userProfile) {
        throw new Error("Failed to retrieve user profile");
      }
      
      // Convert the Firestore profile to our AuthUser format
      const authUser: AuthUser = {
        uid: userProfile.uid,
        username: userProfile.username,
        email: userProfile.email,
        fullName: userProfile.fullName,
        role: userProfile.role,
        twoFactorEnabled: userProfile.twoFactorEnabled,
        photoURL: userProfile.photoURL
      };
      
      console.log("User authenticated successfully:", authUser.username);
      
      setUser(authUser);
      localStorage.setItem('user', JSON.stringify(authUser));
      localStorage.setItem('firebaseUid', authUser.uid);
      
      // Invalidate queries that depend on authentication
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      
      toast({
        title: "Login Successful",
        description: `Welcome, ${authUser.username}!`,
      });
      
      // Redirect to home page after successful Google login
      // Use setTimeout to ensure the toast is visible before redirect
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (error: any) {
      console.error("Google login error:", error);
      toast({
        title: "Login Failed",
        description: error.message || "Unable to log in with Google. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const signup = async (username: string, email: string, password: string) => {
    try {
      console.log("Starting user registration");
      
      // Register the user with Firebase and create their Firestore profile
      const firebaseUser = await firebaseService.registerWithEmailAndPassword(
        email,
        password,
        username
      );
      
      console.log("Firebase user created:", firebaseUser.uid);
      
      // Get the user profile from Firestore
      const userProfile = await firebaseService.getUserProfile(firebaseUser.uid);
      
      if (!userProfile) {
        throw new Error("Failed to retrieve user profile after signup");
      }
      
      // Convert Firestore profile to AuthUser format
      const authUser: AuthUser = {
        uid: userProfile.uid,
        username: userProfile.username,
        email: userProfile.email,
        fullName: userProfile.fullName,
        role: userProfile.role,
        twoFactorEnabled: false,
        photoURL: userProfile.photoURL
      };
      
      setUser(authUser);
      localStorage.setItem('user', JSON.stringify(authUser));
      localStorage.setItem('firebaseUid', authUser.uid);
      
      toast({
        title: "Signup Successful",
        description: "Your account has been created!",
      });
      
      // If there's any server-side functionality needed (like sending welcome emails)
      // we can still make an API call to inform the server about the new user
      try {
        await apiRequest("POST", "/api/auth/register-complete", { 
          uid: firebaseUser.uid,
          email: firebaseUser.email 
        });
      } catch (apiError) {
        console.error("Error notifying server about new user:", apiError);
        // Non-critical error - don't show to user
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      
      let errorMessage = "Unable to create account. Please try again.";
      
      // Provide more specific error messages for common Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email is already in use. Please try logging in instead.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "The email address is not valid.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "The password is too weak. Please choose a stronger password.";
      }
      
      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Sign out from Firebase Authentication
      await firebaseService.signOut();
      
      // Clear local user state
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('firebaseUid');
      
      // Clear any user-specific queries
      queryClient.invalidateQueries();
      
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({
        title: "Logout Failed",
        description: error.message || "Unable to log out. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const verifyTwoFactor = async (email: string, token: string): Promise<void> => {
    try {
      // First validate the 2FA token with our backend
      const res = await apiRequest("POST", "/api/auth/2fa/validate", { email, token });
      
      if (!res.ok) {
        throw new Error("Invalid verification code");
      }
      
      // Get the Firebase user
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Authentication session expired");
      }
      
      // Get the user profile from Firestore
      const userProfile = await firebaseService.getUserProfile(currentUser.uid);
      
      if (!userProfile) {
        throw new Error("User profile not found");
      }
      
      // After successful 2FA verification, set the user in state
      const authUser: AuthUser = {
        uid: userProfile.uid,
        username: userProfile.username,
        email: userProfile.email,
        fullName: userProfile.fullName,
        role: userProfile.role || "user",
        twoFactorEnabled: true,
        photoURL: userProfile.photoURL
      };
      
      setUser(authUser);
      localStorage.setItem('user', JSON.stringify(authUser));
      localStorage.setItem('firebaseUid', authUser.uid);
      
      // Invalidate queries that depend on authentication
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      
      toast({
        title: "Login Successful",
        description: `Welcome back, ${authUser.username}!`,
      });
    } catch (error: any) {
      console.error("2FA verification error:", error);
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid verification code. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };
  
  const setupTwoFactor = async (): Promise<{ success: boolean; otpAuthUrl?: string }> => {
    try {
      if (!user) {
        throw new Error("You must be logged in to setup two-factor authentication");
      }
      
      // Get the current Firebase user
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Authentication session expired");
      }
      
      console.log("Setting up 2FA for user:", currentUser.uid);
      
      // Call our backend to set up 2FA and send verification code
      const res = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Firebase-UID": currentUser.uid // Add Firebase UID directly in header
        },
        body: JSON.stringify({
          uid: currentUser.uid,
          email: currentUser.email
        }),
        credentials: "include"
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error("2FA setup error:", errorData);
        throw new Error(errorData.message || "Failed to set up two-factor authentication");
      }
      
      const data = await res.json();
      
      if (data.emailSent) {
        toast({
          title: "Verification Code Sent",
          description: "A verification code has been sent to your email. Enter it to enable two-factor authentication.",
        });
        return { 
          success: true,
          otpAuthUrl: data.otpAuthUrl || null
        };
      } else {
        throw new Error(data.message || "Failed to send verification code");
      }
    } catch (error: any) {
      console.error("2FA setup error:", error);
      toast({
        title: "2FA Setup Failed",
        description: error.message || "Unable to setup two-factor authentication. Please try again.",
        variant: "destructive",
      });
      return { success: false };
    }
  };
  
  const verifyTwoFactorSetup = async (token: string): Promise<{ success: boolean }> => {
    try {
      if (!user) {
        throw new Error("You must be logged in to verify two-factor authentication");
      }
      
      // Get the current Firebase user
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Authentication session expired");
      }
      
      console.log("Verifying 2FA setup for user:", currentUser.uid);
      
      // Verify the token with our backend
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Firebase-UID": currentUser.uid // Add Firebase UID directly in header
        },
        body: JSON.stringify({ 
          token,
          uid: currentUser.uid 
        }),
        credentials: "include"
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error("2FA verification error:", errorData);
        throw new Error(errorData.message || "Invalid verification code");
      }
      
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.message || "Failed to verify 2FA setup");
      }
      
      // Update the user profile in Firestore to enable 2FA
      await firebaseService.setTwoFactorAuthentication(currentUser.uid, true);
      
      // Update the local user data to reflect that 2FA is now enabled
      const updatedUser = { ...user, twoFactorEnabled: true };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      localStorage.setItem('firebaseUid', updatedUser.uid);
      
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been successfully enabled for your account.",
      });
      
      return { success: true };
    } catch (error: any) {
      console.error("2FA verification error:", error);
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid verification code. Please try again.",
        variant: "destructive",
      });
      return { success: false };
    }
  };
  
  const disableTwoFactor = async (): Promise<{ success: boolean }> => {
    try {
      if (!user) {
        throw new Error("You must be logged in to disable two-factor authentication");
      }
      
      // Get the current Firebase user
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Authentication session expired");
      }
      
      console.log("Disabling 2FA for user:", currentUser.uid);
      
      // Call our backend to disable 2FA (for any server-side cleanup needed)
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Firebase-UID": currentUser.uid // Add Firebase UID directly in header
        },
        body: JSON.stringify({
          uid: currentUser.uid
        }),
        credentials: "include"
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error("2FA disable error:", errorData);
        throw new Error(errorData.message || "Failed to disable two-factor authentication");
      }
      
      // Update the user profile in Firestore to disable 2FA
      await firebaseService.setTwoFactorAuthentication(currentUser.uid, false);
      
      // Update the local user data to reflect that 2FA is now disabled
      const updatedUser = { ...user, twoFactorEnabled: false };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      localStorage.setItem('firebaseUid', updatedUser.uid);
      
      toast({
        title: "2FA Disabled",
        description: "Two-factor authentication has been successfully disabled for your account.",
      });
      
      return { success: true };
    } catch (error: any) {
      console.error("2FA disable error:", error);
      toast({
        title: "Disable Failed",
        description: error.message || "Unable to disable two-factor authentication. Please try again.",
        variant: "destructive",
      });
      return { success: false };
    }
  };
  
  const resendTwoFactorCode = async (): Promise<{ success: boolean }> => {
    try {
      if (!user) {
        throw new Error("You must be logged in to resend verification code");
      }
      
      // Get the current Firebase user
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Authentication session expired");
      }
      
      console.log("Resending 2FA code for user:", currentUser.uid);
      
      // Call our backend to send a new verification code
      const res = await fetch("/api/auth/2fa/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Firebase-UID": currentUser.uid // Add Firebase UID directly in header
        },
        body: JSON.stringify({
          uid: currentUser.uid,
          email: currentUser.email
        }),
        credentials: "include"
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error("2FA resend error:", errorData);
        throw new Error(errorData.message || "Failed to resend verification code");
      }
      
      const data = await res.json();
      
      if (data.emailSent) {
        toast({
          title: "Verification Code Resent",
          description: "A new verification code has been sent to your email.",
        });
        return { success: true };
      } else {
        throw new Error(data.message || "Failed to resend verification code");
      }
    } catch (error: any) {
      console.error("2FA resend error:", error);
      toast({
        title: "Resend Failed",
        description: error.message || "Unable to resend verification code. Please try again.",
        variant: "destructive",
      });
      return { success: false };
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isLoading,
    login,
    loginWithGoogle,
    signup,
    logout,
    verifyTwoFactor,
    setupTwoFactor,
    verifyTwoFactorSetup,
    disableTwoFactor,
    resendTwoFactorCode
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
