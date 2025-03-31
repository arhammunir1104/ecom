import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Send a password reset OTP email using the server's email service
 */
export const sendPasswordResetOTP = async (email: string, otp: string): Promise<void> => {
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
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send verification code');
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
  } catch (error) {
    console.error("Error sending password reset OTP:", error);
    throw error;
  }
};