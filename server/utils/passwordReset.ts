/**
 * Password Reset Functionality
 * 
 * This module contains the implementation of password reset with OTP verification through email.
 */

import { Express } from 'express';
import { forgotPasswordSchema, verifyOTPSchema, resetPasswordSchema } from '@shared/schema';
import { storage } from '../storage';
import { generateOTP, sendPasswordResetEmail } from './passwordResetEmail';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Function to hash a password
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

export function setupPasswordResetHandlers(app: Express) {
  // Step 1: Forgot Password - Request OTP
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      // Validate request body
      const validation = forgotPasswordSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request',
          errors: validation.error.flatten().fieldErrors
        });
      }

      const { email } = validation.data;

      // Check if the email exists in our database
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // For security reasons, we still send a success response even if the email doesn't exist
        // This prevents attackers from enumerating valid emails
        return res.status(200).json({
          success: true,
          message: 'If the email exists, a password reset code has been sent'
        });
      }

      // Generate a 6-digit OTP
      const otp = generateOTP();

      // Store the OTP in the database
      await storage.createPasswordResetOTP(email, otp);

      // Send OTP via email
      const emailSent = await sendPasswordResetEmail(email, otp);

      if (!emailSent) {
        console.error(`Failed to send password reset email to ${email}`);
        return res.status(500).json({
          success: false,
          message: 'Failed to send password reset email'
        });
      }

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Password reset code has been sent to your email'
      });
    } catch (error) {
      console.error('Error in forgot-password endpoint:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while processing your request'
      });
    }
  });

  // Step 2: Verify OTP
  app.post('/api/auth/verify-reset-code', async (req, res) => {
    try {
      // Validate request body
      const validation = verifyOTPSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request',
          errors: validation.error.flatten().fieldErrors
        });
      }

      const { email, otp } = validation.data;

      // Increment attempt count for this OTP
      const otpRecord = await storage.incrementOTPAttempts(email);
      
      if (!otpRecord) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP'
        });
      }

      // Check if too many attempts
      if (otpRecord.attempts > 5) {
        return res.status(400).json({
          success: false,
          message: 'Too many attempts. Please request a new OTP.'
        });
      }

      // Verify the OTP
      const isValid = await storage.verifyPasswordResetOTP(email, otp);
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP'
        });
      }

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'OTP verified successfully',
        email
      });
    } catch (error) {
      console.error('Error in verify-reset-code endpoint:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while processing your request'
      });
    }
  });

  // Step 3: Reset Password
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      // Validate request body
      const validation = resetPasswordSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request',
          errors: validation.error.flatten().fieldErrors
        });
      }

      const { email, otp, password: newPassword } = validation.data;

      // Final verification of OTP
      const isValid = await storage.verifyPasswordResetOTP(email, otp);
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP'
        });
      }

      // Get the user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'User not found'
        });
      }

      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);

      // Update the user's password
      await storage.updateUserPassword(user.id, hashedPassword);

      // Mark OTP as used
      await storage.markOTPAsUsed(email);

      // If the user has a Firebase account, update Firebase password as well
      if (user.firebaseUid) {
        try {
          await updateFirebasePassword(user.firebaseUid, newPassword);
        } catch (firebaseError) {
          console.error('Error updating Firebase password:', firebaseError);
          // Continue with the process even if Firebase update fails
          // We'll log the error but still consider the reset successful
        }
      }

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Password has been reset successfully'
      });
    } catch (error) {
      console.error('Error in reset-password endpoint:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while processing your request'
      });
    }
  });

  console.log("Password reset functionality has been enabled with email OTP verification.");
}

// Function to update Firebase password
async function updateFirebasePassword(firebaseUid: string, newPassword: string): Promise<void> {
  try {
    // This feature uses the Firebase Admin SDK
    const firebaseAdmin = await import('../utils/firebase');
    
    // Get the Firebase Admin Auth instance
    const authAdmin = firebaseAdmin.auth();
    
    // Update the password in Firebase
    await authAdmin.updateUser(firebaseUid, {
      password: newPassword,
    });

    console.log(`Firebase password updated for user ${firebaseUid}`);
  } catch (error) {
    console.error('Error updating Firebase password:', error);
    throw error;
  }
}