/**
 * Password Reset Email Functionality
 * 
 * This module contains functions for generating OTP codes and sending password reset emails.
 */

import nodemailer from 'nodemailer';

// Generate a 6-digit OTP code
export function generateOTP(): string {
  // Generate a random 6-digit number
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send password reset email with OTP
export async function sendPasswordResetEmail(
  recipientEmail: string,
  otp: string
): Promise<boolean> {
  try {
    // Check for required environment variables
    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.error('Missing SMTP configuration');
      return false;
    }

    // Create email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: parseInt(process.env.SMTP_PORT, 10) === 465, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Create email content
    const mailOptions = {
      from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      to: recipientEmail,
      subject: 'Password Reset Verification Code',
      text: `Your password reset code is: ${otp}\n\nThis code will expire in 5 minutes. If you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #f06292;">SoftGirl Fashion</h2>
          </div>
          <div style="padding: 20px; background-color: #f9f9f9; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #333;">Password Reset Code</h3>
            <p style="margin-bottom: 20px; color: #666;">We received a request to reset your password. Use the verification code below to complete the process:</p>
            <div style="font-size: 24px; font-weight: bold; text-align: center; padding: 10px; background-color: #f6f6f6; border-radius: 5px; letter-spacing: 5px; margin: 20px 0;">
              ${otp}
            </div>
            <p style="color: #666;">This code will expire in <strong>5 minutes</strong>.</p>
            <p style="color: #666;">If you did not request this code, you can safely ignore this email. Someone may have entered your email address by mistake.</p>
          </div>
          <div style="margin-top: 20px; font-size: 12px; color: #999; text-align: center;">
            <p>This is an automated email, please do not reply.</p>
            <p>&copy; ${new Date().getFullYear()} SoftGirl Fashion. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${recipientEmail}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
}