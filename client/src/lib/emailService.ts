import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Send a password reset OTP email
 * This is a mock implementation that stores the OTP in Firestore
 * In a production app, this would send an actual email
 */
export const sendPasswordResetOTP = async (email: string, otp: string): Promise<void> => {
  try {
    console.log(`Sending password reset OTP to ${email}: ${otp}`);
    
    // For demonstration purposes, we're logging the OTP
    // In a real app, we would use a service like SendGrid, Mailgun, etc.
    
    // Store email sending attempt in Firestore for demo purposes
    await addDoc(collection(db, "emailLogs"), {
      email,
      subject: "Your Password Reset Code",
      otp, // We include this only for demo purposes
      type: "password_reset",
      sentAt: Timestamp.fromDate(new Date()),
      status: "sent" // In a real implementation, we'd get this from the email service
    });
    
    // In development, we'd show the OTP in the console to facilitate testing
    console.info(`[DEV ONLY] Password reset OTP for ${email}: ${otp}`);
    
    // Display an alert in development to simulate email delivery
    if (process.env.NODE_ENV !== 'production') {
      alert(`
        DEVELOPMENT MODE: Password Reset OTP
        ------------------------------
        Email: ${email}
        OTP: ${otp}
        ------------------------------
        This alert simulates an email delivery and is only shown in development mode.
      `);
    }
  } catch (error) {
    console.error("Error sending password reset OTP:", error);
    throw error;
  }
};