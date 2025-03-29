import { createContext, useEffect, useState, ReactNode } from "react";
import { auth, onAuthChange, signInWithGoogle, logOut } from "../lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "../lib/queryClient";
import { queryClient } from "../lib/queryClient";

interface AuthUser {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  role: string;
  twoFactorEnabled?: boolean;
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
  setupTwoFactor: () => Promise<{ success: boolean }>;
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
          // Get user info from backend
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          } else {
            // This would be where we'd make an API call to get user details 
            // if we weren't using local storage
            setUser(null);
          }
        } catch (error) {
          console.error("Error getting user data:", error);
          setUser(null);
        }
      } else {
        setUser(null);
        localStorage.removeItem('user');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string, recaptchaToken?: string): Promise<{ requiresTwoFactor: boolean; email?: string }> => {
    try {
      const res = await apiRequest("POST", "/api/auth/login", { email, password, recaptchaToken });
      
      // Check the response status to see if it's a 2FA redirect
      if (res.status === 200) {
        const userData = await res.json();
        
        // Check if the user has 2FA enabled
        if (userData.twoFactorEnabled) {
          // Return that 2FA is required and the email for verification
          return { requiresTwoFactor: true, email: userData.email };
        }
        
        // Normal login - no 2FA required
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Invalidate queries that depend on authentication
        queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
        
        toast({
          title: "Login Successful",
          description: `Welcome back, ${userData.username}!`,
        });
        
        return { requiresTwoFactor: false };
      } else {
        throw new Error("Login failed");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    try {
      const firebaseUser = await signInWithGoogle();
      
      // In a real app, we would call our backend to create/verify the user
      // and then return the user data
      
      const userData = {
        id: 1,
        username: firebaseUser.displayName || "User",
        email: firebaseUser.email || "",
        role: "user"
      };
      
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      
      toast({
        title: "Login Successful",
        description: `Welcome, ${userData.username}!`,
      });
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
      const res = await apiRequest("POST", "/api/auth/register", { username, email, password });
      const userData = await res.json();
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      
      toast({
        title: "Signup Successful",
        description: "Your account has been created!",
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Signup Failed",
        description: error.message || "Unable to create account. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await logOut();
      setUser(null);
      localStorage.removeItem('user');
      
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
      const res = await apiRequest("POST", "/api/auth/2fa/validate", { email, token });
      const userData = await res.json();
      
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Invalidate queries that depend on authentication
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      
      toast({
        title: "Login Successful",
        description: `Welcome back, ${userData.username}!`,
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
  
  const setupTwoFactor = async (): Promise<{ success: boolean }> => {
    try {
      if (!user) {
        throw new Error("You must be logged in to setup two-factor authentication");
      }
      
      const res = await apiRequest("POST", "/api/auth/2fa/setup", {});
      const data = await res.json();
      
      if (data.emailSent) {
        toast({
          title: "Verification Code Sent",
          description: "A verification code has been sent to your email. Enter it to enable two-factor authentication.",
        });
        return { success: true };
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
      
      const res = await apiRequest("POST", "/api/auth/2fa/verify", { token });
      const data = await res.json();
      
      // Update the local user data to reflect that 2FA is now enabled
      const updatedUser = { ...user, twoFactorEnabled: true };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
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
      
      const res = await apiRequest("POST", "/api/auth/2fa/disable", {});
      const data = await res.json();
      
      // Update the local user data to reflect that 2FA is now disabled
      const updatedUser = { ...user, twoFactorEnabled: false };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
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
      
      const res = await apiRequest("POST", "/api/auth/2fa/resend", {});
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
