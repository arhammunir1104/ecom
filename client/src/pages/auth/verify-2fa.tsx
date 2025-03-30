import { useState, useEffect } from 'react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';
import { useLocation } from 'wouter';

export default function VerifyTwoFactor() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const { toast } = useToast();
  const authContext = useContext(AuthContext);
  const { verifyTwoFactor, user } = authContext || {};
  const [, navigate] = useLocation();

  useEffect(() => {
    // If the user is already authenticated, redirect to home
    if (user) {
      navigate('/', { replace: true });
      return;
    }

    // Read from localStorage
    const pendingAuth = localStorage.getItem('pendingAuth');
    if (pendingAuth) {
      try {
        const authData = JSON.parse(pendingAuth);
        if (authData.email) setEmail(authData.email);
        if (authData.uid) setUid(authData.uid);
      } catch (error) {
        console.error('Error parsing pending auth data:', error);
      }
    }

    // If no email is found, redirect to login
    if (!email && !uid) {
      toast({
        title: 'Authentication Error',
        description: 'No pending authentication found. Please login again.',
        variant: 'destructive',
      });
      navigate('/auth/login', { replace: true });
    }
  }, [user, navigate, toast, email, uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: 'Error',
        description: 'No email address found for verification.',
        variant: 'destructive',
      });
      return;
    }

    if (token.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter a valid 6-digit verification code.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // If verifyTwoFactor from context is available, use it
      if (verifyTwoFactor) {
        await verifyTwoFactor(email, token);
        localStorage.removeItem('pendingAuth');
        navigate('/', { replace: true });
      } else {
        // Fallback direct API call if context method not available
        const response = await fetch('/api/auth/2fa/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(uid ? { 'Firebase-UID': uid } : {})
          },
          body: JSON.stringify({ 
            email,
            token,
            uid
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Invalid verification code');
        }

        // Get the user data from the response
        const userData = await response.json();
        
        // Set auth state
        localStorage.removeItem('pendingAuth');
        localStorage.setItem('user', JSON.stringify(userData));
        
        toast({
          title: 'Login Successful',
          description: `Welcome back, ${userData.username}!`,
        });
        
        // Redirect to home
        navigate('/', { replace: true });
      }
    } catch (error: any) {
      console.error('2FA verification error:', error);
      toast({
        title: 'Verification Failed',
        description: error.message || 'Invalid verification code. Please try again.',
        variant: 'destructive',
      });
      // Don't clear pendingAuth here to allow retry
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      toast({
        title: 'Error',
        description: 'No email address found for verification.',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingCode(true);
    try {
      const response = await fetch('/api/auth/2fa/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(uid ? { 'Firebase-UID': uid } : {})
        },
        body: JSON.stringify({ 
          email,
          uid
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to send verification code');
      }

      toast({
        title: 'Code Sent',
        description: 'A new verification code has been sent to your email.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send verification code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingCode(false);
    }
  };

  if (!email && !uid) {
    return null; // Redirect will happen in useEffect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Two-Factor Verification</CardTitle>
          <CardDescription>
            Please enter the 6-digit verification code that was sent to your email.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <div className="flex flex-col space-y-6">
              <div className="flex flex-col items-center space-y-2">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Enter verification code:
                </div>
                <InputOTP
                  maxLength={6}
                  value={token}
                  onChange={(value: string) => setToken(value)}
                  disabled={isLoading}
                  className="justify-center"
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <InputOTPSlot key={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || token.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResendCode}
              disabled={isSendingCode}
            >
              {isSendingCode ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Resend Code'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}