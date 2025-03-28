import * as speakeasy from 'speakeasy';
import * as nodemailer from 'nodemailer';

// Secret key length for OTP
const OTP_SECRET_LENGTH = 20;
// OTP expiration time in minutes
const OTP_EXPIRY_MINUTES = 10;

// Create a nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email', // Default to ethereal for development
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASSWORD || '',
  },
});

// Generate a random OTP code (6 digits)
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate a new secret and OTP for email-based two-factor authentication
export const generateSecret = (email: string): { secret: string; otp: string } => {
  // Generate a random OTP
  const otp = generateOTP();
  
  // Generate a timestamp that the OTP is valid until (expiry time)
  const expiryTime = new Date();
  expiryTime.setMinutes(expiryTime.getMinutes() + OTP_EXPIRY_MINUTES);
  
  // Create a secret containing the OTP and expiry time
  const secret = JSON.stringify({
    otp,
    expiryTime: expiryTime.toISOString()
  });
  
  return { secret, otp };
};

// Send OTP to user's email
export const sendOTPEmail = async (email: string, otp: string): Promise<boolean> => {
  try {
    const storeName = 'Feminine Elegance';
    
    // Send email with OTP
    const info = await transporter.sendMail({
      from: `"${storeName}" <${process.env.SMTP_FROM || 'noreply@feminineelegance.com'}>`,
      to: email,
      subject: 'Your Verification Code',
      text: `Your verification code is: ${otp}. This code will expire in ${OTP_EXPIRY_MINUTES} minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d6336c;">Your Verification Code</h2>
          <p>Hello,</p>
          <p>You've requested a verification code for your ${storeName} account.</p>
          <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold; margin: 20px 0;">
            ${otp}
          </div>
          <p>This code will expire in ${OTP_EXPIRY_MINUTES} minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <p>Thank you,<br>${storeName} Team</p>
        </div>
      `,
    });
    
    console.log('OTP email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
};

// Setup 2FA for a user - generate OTP and send email
export const setupTwoFactor = async (email: string): Promise<{ secret: string; success: boolean }> => {
  try {
    const { secret, otp } = generateSecret(email);
    const emailSent = await sendOTPEmail(email, otp);
    
    return { 
      secret,
      success: emailSent
    };
  } catch (error) {
    console.error('Setup 2FA error:', error);
    throw new Error('Failed to setup two-factor authentication');
  }
};

// Verify a token against a secret
export const verifyToken = (token: string, secret: string): boolean => {
  try {
    // Parse the secret to get the stored OTP and expiry time
    const secretData = JSON.parse(secret);
    const storedOTP = secretData.otp;
    const expiryTime = new Date(secretData.expiryTime);
    
    // Check if OTP has expired
    if (new Date() > expiryTime) {
      console.log('OTP has expired');
      return false;
    }
    
    // Compare the provided token with the stored OTP
    return token.trim() === storedOTP;
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
};