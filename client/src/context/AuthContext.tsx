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
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        try {
          // Check if we have a localStorage cached user first for quick UI display
          const cachedUserStr = localStorage.getItem('user');
          const cachedFirebaseUid = localStorage.getItem('firebaseUid');
          
          // If we have a cached user and it matches the current Firebase UID, use it temporarily
          if (cachedUserStr && cachedFirebaseUid === firebaseUser.uid) {
            try {
              const cachedUser = JSON.parse(cachedUserStr) as AuthUser;
              // Set the cached user for immediate UI response
              setUser(cachedUser);
              setIsAdmin(cachedUser.role === "admin");
              console.log("Using cached user data while fetching fresh data:", cachedUser.username);
            } catch (cacheError) {
              console.error("Error parsing cached user:", cacheError);
            }
          }
          
          // Get user profile from Firestore - even if we're using cached data, still fetch fresh data
          console.log("Fetching latest user profile from Firestore for:", firebaseUser.uid);
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
            // Check and set admin status
            setIsAdmin(authUser.role === "admin");
            // Store both complete user object and firebaseUid separately for easier access
            localStorage.setItem('user', JSON.stringify(authUser));
            localStorage.setItem('firebaseUid', authUser.uid);
            console.log("User authenticated from Firestore:", authUser.username);
            console.log("User role:", authUser.role);
          } else {
            // No profile exists in Firestore, but we have a Firebase auth user.
            // Let's create a basic profile for them
            console.log("No Firestore profile found for authenticated user, creating one:", firebaseUser.uid);
            
            try {
              const displayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'user';
              
              // Create new user profile in Firestore
              await firebaseService.createUserProfile(firebaseUser.uid, {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                username: displayName,
                fullName: firebaseUser.displayName || displayName,
                role: "user",
                twoFactorEnabled: false,
                photoURL: firebaseUser.photoURL || undefined,
                createdAt: new Date() as any,
                updatedAt: new Date() as any
              });
              
              // Now fetch the profile we just created
              const newUserProfile = await firebaseService.getUserProfile(firebaseUser.uid);
              
              if (newUserProfile) {
                // Convert Firestore profile to AuthUser format
                const newAuthUser: AuthUser = {
                  uid: newUserProfile.uid,
                  username: newUserProfile.username,
                  email: newUserProfile.email,
                  fullName: newUserProfile.fullName,
                  role: newUserProfile.role || "user",
                  twoFactorEnabled: newUserProfile.twoFactorEnabled || false,
                  photoURL: newUserProfile.photoURL
                };
                
                setUser(newAuthUser);
                setIsAdmin(newAuthUser.role === "admin");
                localStorage.setItem('user', JSON.stringify(newAuthUser));
                localStorage.setItem('firebaseUid', newAuthUser.uid);
                console.log("Created and authenticated new user profile:", newAuthUser.username);
              } else {
                throw new Error("Failed to retrieve newly created user profile");
              }
            } catch (createError) {
              console.error("Error creating user profile in Firestore:", createError);
              
              // Fallback to a basic user object if we can't create a profile
              const basicUser: AuthUser = {
                uid: firebaseUser.uid,
                username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'user',
                email: firebaseUser.email || '',
                role: "user",
                twoFactorEnabled: false,
                photoURL: firebaseUser.photoURL || undefined
              };
              
              setUser(basicUser);
              setIsAdmin(false);
              localStorage.setItem('user', JSON.stringify(basicUser));
              localStorage.setItem('firebaseUid', basicUser.uid);
              console.log("Using fallback basic user data:", basicUser.username);
            }
          }
        } catch (error) {
          console.error("Error getting user data from Firestore:", error);
          
          // Even if Firestore fails, we still have an authenticated Firebase user
          // Let's use the Firebase user data as a fallback to keep the user logged in
          const fallbackUser: AuthUser = {
            uid: firebaseUser.uid,
            username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'user',
            email: firebaseUser.email || '',
            role: "user",
            twoFactorEnabled: false,
            photoURL: firebaseUser.photoURL || undefined
          };
          
          setUser(fallbackUser);
          setIsAdmin(false);
          localStorage.setItem('user', JSON.stringify(fallbackUser));
          localStorage.setItem('firebaseUid', fallbackUser.uid);
          console.log("Using fallback user data from Firebase Auth:", fallbackUser.username);
        }
      } else {
        console.log("No Firebase user found, clearing auth state");
        setUser(null);
        setIsAdmin(false);
        localStorage.removeItem('user');
        localStorage.removeItem('firebaseUid');
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
        
        // Use our backend login endpoint with the Firebase UID
        try {
          // Make a request to our backend login endpoint with the Firebase UID
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              password, // This won't be used when firebaseUid is provided
              recaptchaToken,
              firebaseUid
            }),
          });
          
          if (!response.ok) {
            const data = await response.json();
            console.error("Error logging in with backend:", data);
            throw new Error(data.message || "Failed to login with backend");
          }
          
          // Get user data from response
          const userData = await response.json();
          console.log("User data from backend:", userData);
          
          // Check if two-factor authentication is enabled
          if (userData.twoFactorEnabled) {
            console.log("Two-factor authentication required for:", email);
            
            // Trigger 2FA verification process if needed
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
          localStorage.setItem('firebaseUid', authUser.uid);
          
          // Invalidate queries that depend on authentication
          queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
          
          toast({
            title: "Login Successful",
            description: `Welcome back, ${authUser.username}!`,
          });
          
          return { requiresTwoFactor: false };
        } catch (backendError) {
          console.error("Error with backend authentication:", backendError);
          
          // Try to create/sync user with the backend via Google endpoint
          try {
            console.log("Attempting to sync user with backend via Google endpoint");
            // First, try to get the user from our own backend using the Firebase UID
            const syncResponse = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                displayName: userCredential.user.displayName,
                email: userCredential.user.email,
                uid: firebaseUid,
                photoURL: userCredential.user.photoURL
              }),
            });
            
            if (!syncResponse.ok) {
              const data = await syncResponse.json();
              console.error("Error syncing with backend:", data);
              throw new Error(data.message || "Failed to sync with backend");
            }
            
            // Get user data from response
            const syncUserData = await syncResponse.json();
            console.log("User data from backend sync:", syncUserData);
            
            // Create AuthUser from backend data
            const authUser: AuthUser = {
              uid: syncUserData.firebaseUid || firebaseUid,
              username: syncUserData.username,
              email: syncUserData.email,
              fullName: syncUserData.fullName,
              role: syncUserData.role || "user",
              twoFactorEnabled: syncUserData.twoFactorEnabled || false,
              photoURL: syncUserData.photoURL || userCredential.user.photoURL
            };
            
            // Store authenticated user
            setUser(authUser);
            localStorage.setItem('user', JSON.stringify(authUser));
            localStorage.setItem('firebaseUid', authUser.uid);
            
            toast({
              title: "Login Successful",
              description: `Welcome back, ${authUser.username}!`,
            });
            
            return { requiresTwoFactor: false };
          } catch (syncError) {
            console.error("Error with backend sync:", syncError);
            // Fallback to using just the Firebase user data
            
            // Create minimal AuthUser from Firebase data
            const authUser: AuthUser = {
              uid: firebaseUid,
              username: userCredential.user.displayName || email.split('@')[0],
              email: email,
              fullName: userCredential.user.displayName || undefined,
              role: "user",
              twoFactorEnabled: false,
              photoURL: userCredential.user.photoURL || undefined
            };
            
            // Store authenticated user
            setUser(authUser);
            localStorage.setItem('user', JSON.stringify(authUser));
            localStorage.setItem('firebaseUid', authUser.uid);
            
            toast({
              title: "Login Successful",
              description: `Welcome back, ${authUser.username}!`,
            });
            
            return { requiresTwoFactor: false };
          }
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
      console.log("Starting Google login process with simplified approach");
      
      // Use the direct Firebase approach without relying on firebaseService
      const { signInWithPopup, GoogleAuthProvider } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");
      
      // Create a new instance of the Google provider
      const provider = new GoogleAuthProvider();
      
      // Configure additional scopes if needed
      provider.addScope('email');
      provider.addScope('profile');
      
      // Sign in with Google directly
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      
      console.log("Firebase user authenticated directly:", firebaseUser.email);
      
      // Simplified approach - create AuthUser directly from Firebase user without Firestore lookup
      const authUser: AuthUser = {
        uid: firebaseUser.uid,
        username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'user',
        email: firebaseUser.email || '',
        fullName: firebaseUser.displayName || undefined,
        role: "user", // Default to user role
        twoFactorEnabled: false, // Disable 2FA by default for simplicity
        photoURL: firebaseUser.photoURL || undefined
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
      
      // First check if the user already exists in our backend
      try {
        const response = await fetch('/api/auth/check-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.exists) {
            throw new Error("This email is already in use. Please try logging in instead.");
          }
        }
      } catch (checkError: any) {
        // If it's our own error message about email in use, throw it
        if (checkError.message === "This email is already in use. Please try logging in instead.") {
          throw checkError;
        }
        // Otherwise, continue with registration attempt 
        // (this might be a network error or the endpoint doesn't exist)
        console.warn("Could not check if user exists:", checkError);
      }
      
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
        fullName: userProfile.fullName || undefined,
        role: userProfile.role,
        twoFactorEnabled: false,
        photoURL: userProfile.photoURL || undefined
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
      
      // Check if it's our own error first
      if (typeof error.message === 'string') {
        if (error.message.includes("email is already in use") || 
            error.message.includes("Email already in use")) {
          errorMessage = "This email is already in use. Please try logging in instead.";
        }
      }
      
      // Provide more specific error messages for common Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email is already in use. Please try logging in instead.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "The email address is not valid.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "The password is too weak. Please choose a stronger password.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many requests. Please try again later.";
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
      console.log("Starting logout process with simplified approach");
      
      // Use Firebase directly
      const { signOut } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");
      
      // Sign out from Firebase Authentication
      await signOut(auth);
      
      // Clear local user state
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('firebaseUid');
      localStorage.removeItem('pendingAuth');
      
      // Clear any user-specific queries
      queryClient.invalidateQueries();
      
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      
      // Redirect to login page
      window.location.href = '/login';
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({
        title: "Logout Failed",
        description: error.message || "Unable to log out. Please try again.",
        variant: "destructive",
      });
      
      // Force clear the user state even if Firebase signOut fails
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('firebaseUid');
      localStorage.removeItem('pendingAuth');
      
      // Redirect to login page to ensure they can attempt to login again
      window.location.href = '/login';
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
        fullName: userProfile.fullName || undefined,
        role: userProfile.role || "user",
        twoFactorEnabled: true,
        photoURL: userProfile.photoURL || undefined
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
          otpAuthUrl: data.otpAuthUrl || undefined
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
      
      // The backend doesn't actually return "success", it returns the 
      // message directly, so we'll check based on the response
      if (data.message && data.message.includes("enabled successfully")) {
        console.log("2FA enabled successfully with response:", data);
      } else if (!data.twoFactorEnabled) {
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
