import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Send a password reset OTP email using the server's email service
 */
export const sendPasswordResetOTP = async (email: string, otp: string): Promise<boolean> => {
  try {
    console.log(`Initiating password reset OTP for ${email}`);
    
    // Log attempt in Firestore for tracking
    await addDoc(collection(db, "emailLogs"), {
      email,
      subject: "Your Password Reset Code",
      type: "password_reset",
      sentAt: Timestamp.fromDate(new Date()),
      status: "initiated" 
    });
    
    // Call our backend API to send the actual email
    const response = await fetch('/api/auth/send-reset-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, otp })
    });
    
    // Check for success response
    if (!response.ok) {
      // Extract error details
      const errorData = await response.json();
      console.error(`API error sending reset OTP: ${errorData.message}`);
      
      // In development, show the OTP in console
      if (process.env.NODE_ENV !== 'production') {
        console.info(`[DEV ONLY] Password reset OTP for ${email}: ${otp}`);
        alert(`[DEV ONLY] Password reset OTP for ${email}: ${otp}`);
        
        // Log the fallback
        await addDoc(collection(db, "emailLogs"), {
          email,
          subject: "Your Password Reset Code",
          type: "password_reset",
          sentAt: Timestamp.fromDate(new Date()),
          status: "fallback_dev_alert" 
        });
        
        // Return true since we're using a fallback
        return true;
      }
      
      // Log the failure in production
      await addDoc(collection(db, "emailLogs"), {
        email,
        subject: "Your Password Reset Code",
        type: "password_reset",
        sentAt: Timestamp.fromDate(new Date()),
        status: "failed",
        error: errorData.message
      });
      
      return false;
    }
    
    // Update the log with success status
    await addDoc(collection(db, "emailLogs"), {
      email,
      subject: "Your Password Reset Code",
      type: "password_reset",
      sentAt: Timestamp.fromDate(new Date()),
      status: "sent" 
    });
    
    // Log OTP in development for debugging, but don't show it to user
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[DEV ONLY] Password reset OTP for ${email}: ${otp}`);
    }
    
    return true;
  } catch (error) {
    console.error("Error sending password reset OTP:", error);
    
    // Log the failure
    await addDoc(collection(db, "emailLogs"), {
      email,
      subject: "Your Password Reset Code",
      type: "password_reset",
      sentAt: Timestamp.fromDate(new Date()),
      status: "exception",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // In development, allow testing to continue with console/alert OTP
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[DEV ONLY] Password reset OTP for ${email}: ${otp}`);
      alert(`[DEV ONLY] Password reset OTP for ${email}: ${otp}`);
      return true;
    }
    
    return false;
  }
};