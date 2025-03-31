import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';

// OTP length
const OTP_LENGTH = 6;

// Create a nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email', // Default to ethereal for development
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASSWORD || '',
  },
});

// Generate a 6-digit OTP
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate a secure reset token
export const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Send password reset email with OTP
export const sendPasswordResetEmail = async (email: string, otp: string): Promise<boolean> => {
  try {
    const storeName = 'Feminine Elegance';
    
    // Send email with OTP
    const info = await transporter.sendMail({
      from: `"${storeName}" <${process.env.SMTP_FROM_EMAIL || 'noreply@feminineelegance.com'}>`,
      to: email,
      subject: 'Password Reset Code',
      text: `Your password reset code is: ${otp}. This code will expire in 10 minutes. If you didn't request this, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d6336c;">Password Reset Code</h2>
          <p>Hello,</p>
          <p>You've requested to reset your password for your ${storeName} account.</p>
          <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold; margin: 20px 0;">
            ${otp}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this password reset, please ignore this email or contact customer support if you have concerns.</p>
          <p>Thank you,<br>${storeName} Team</p>
        </div>
      `,
    });
    
    console.log('Password reset email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
};