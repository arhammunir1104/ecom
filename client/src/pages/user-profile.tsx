import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { 
  AlertDialog, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction
} from "@/components/ui/alert-dialog";
import { 
  Shield, 
  User as UserIcon, 
  Mail, 
  Key, 
  Check, 
  AlertCircle, 
  Loader2,
  LockKeyhole
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import QRCode from 'qrcode';
import { useEffect, useRef } from "react";

// Schema for profile update
const profileSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  fullName: z.string().optional(),
});

// Schema for password change
const passwordSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required" }),
  newPassword: z.string().min(8, { message: "Password must be at least 8 characters" }),
  confirmPassword: z.string().min(8, { message: "Password must be at least 8 characters" }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export default function UserProfile() {
  const { user, setupTwoFactor, verifyTwoFactorSetup, disableTwoFactor } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [isLoading, setIsLoading] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled || false);
  
  // Two factor setup states
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [setupInProgress, setSetupInProgress] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [setupStep, setSetupStep] = useState<"initial" | "qrcode" | "verification">("initial");
  const qrCodeRef = useRef<HTMLDivElement>(null);
  
  // Disable 2FA dialog state
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  
  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      fullName: user?.fullName || "",
    },
  });
  
  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  
  // Handle profile update
  const onProfileSubmit = async (values: z.infer<typeof profileSchema>) => {
    try {
      setIsLoading(true);
      
      // In a real app, you would make an API call to update the profile
      toast({
        title: "Profile updated",
        description: "Your profile information has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle password change
  const onPasswordSubmit = async (values: z.infer<typeof passwordSchema>) => {
    try {
      setIsLoading(true);
      
      // In a real app, you would make an API call to change the password
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully.",
      });
      
      passwordForm.reset({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Start two-factor setup
  const handleSetupTwoFactor = async () => {
    try {
      setSetupInProgress(true);
      setShowSetupDialog(true);
      setSetupStep("qrcode");
      
      const result = await setupTwoFactor();
      
      if (result.success) {
        // Generate QR code after dialog is shown
        setTimeout(() => {
          if (qrCodeRef.current && result.otpAuthUrl) {
            qrCodeRef.current.innerHTML = '';
            QRCode.toCanvas(
              qrCodeRef.current,
              result.otpAuthUrl,  // Use the server-provided OTP auth URL
              {
                width: 200,
                color: {
                  dark: '#000',
                  light: '#FFF',
                },
              },
              (error: Error | null | undefined) => {
                if (error) {
                  console.error("Error generating QR code:", error);
                }
              }
            );
          }
        }, 100);
      }
    } catch (error: any) {
      toast({
        title: "Setup failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      setShowSetupDialog(false);
    } finally {
      setSetupInProgress(false);
    }
  };
  
  // Verify two-factor setup
  const handleVerifySetup = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the complete 6-digit code.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      const result = await verifyTwoFactorSetup(verificationCode);
      
      if (result.success) {
        setTwoFactorEnabled(true);
        setShowSetupDialog(false);
        toast({
          title: "Two-factor authentication enabled",
          description: "Your account is now protected with 2FA.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "The code you entered is invalid.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Disable two-factor authentication
  const handleDisableTwoFactor = async () => {
    try {
      setIsLoading(true);
      const result = await disableTwoFactor();
      
      if (result.success) {
        setTwoFactorEnabled(false);
        setShowDisableDialog(false);
        toast({
          title: "Two-factor authentication disabled",
          description: "2FA has been turned off for your account.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Disable failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    // Update state when user data changes (e.g., after login)
    if (user) {
      setTwoFactorEnabled(user.twoFactorEnabled || false);
      
      profileForm.reset({
        username: user.username || "",
        email: user.email || "",
        fullName: user.fullName || "",
      });
    }
  }, [user, profileForm]);
  
  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="mt-2 text-xl font-semibold">Not Authenticated</h2>
          <p className="mt-1 text-muted-foreground">
            Please log in to access your profile.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">My Account</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>
        
        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your account details here.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                  <FormField
                    control={profileForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              className="pl-10"
                              disabled={isLoading}
                            />
                            <UserIcon className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={profileForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
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
                  
                  <FormField
                    control={profileForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isLoading} />
                        </FormControl>
                        <FormDescription>
                          This is your public display name.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save changes"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>Change your password here.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="password"
                              {...field}
                              className="pl-10"
                              disabled={isLoading}
                            />
                            <Key className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update password"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-full ${twoFactorEnabled ? "bg-green-100" : "bg-muted"}`}>
                    <Shield className={`h-6 w-6 ${twoFactorEnabled ? "text-green-600" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="font-medium">Two-factor authentication</p>
                    <p className="text-sm text-muted-foreground">
                      {twoFactorEnabled 
                        ? "Your account is protected with 2FA" 
                        : "Protect your account with an additional verification step"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {twoFactorEnabled ? (
                    <Button 
                      variant="outline" 
                      onClick={() => setShowDisableDialog(true)}
                      disabled={isLoading}
                    >
                      Disable
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleSetupTwoFactor}
                      disabled={isLoading || setupInProgress}
                    >
                      {setupInProgress ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Setting up...
                        </>
                      ) : (
                        "Enable 2FA"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Order History</CardTitle>
              <CardDescription>View your previous orders.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">You haven't placed any orders yet.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Two-Factor Setup Dialog */}
      <AlertDialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Set up Two-Factor Authentication</AlertDialogTitle>
            <AlertDialogDescription>
              {setupStep === "qrcode" ? (
                <>
                  Scan this QR code with your authenticator app, then enter the 6-digit code below.
                  <div className="flex justify-center my-4">
                    <div ref={qrCodeRef} className="p-2 bg-white border rounded-md"></div>
                  </div>
                </>
              ) : (
                "Verify your identity with a 6-digit code from your authenticator app."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="flex justify-center mt-2">
            <InputOTP
              maxLength={6}
              value={verificationCode}
              onChange={setVerificationCode}
              disabled={isLoading}
              render={({ slots }) => (
                <InputOTPGroup>
                  {slots.map((slot, index) => (
                    <InputOTPSlot key={index} {...slot} />
                  ))}
                </InputOTPGroup>
              )}
            />
          </div>
          
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleVerifySetup}
              disabled={isLoading || verificationCode.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Enable"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Disable Two-Factor Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disable two-factor authentication? This will make your account less secure.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDisableTwoFactor}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disabling...
                </>
              ) : (
                "Disable 2FA"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}