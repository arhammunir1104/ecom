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
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  isLoading: true,
  login: async () => {},
  loginWithGoogle: async () => {},
  signup: async () => {},
  logout: async () => {},
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

  const login = async (email: string, password: string) => {
    try {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
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

  const value = {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isLoading,
    login,
    loginWithGoogle,
    signup,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
