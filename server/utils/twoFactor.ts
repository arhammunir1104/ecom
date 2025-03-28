import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

// Generate a new secret for two-factor authentication
export const generateSecret = (email: string): { secret: string; otpAuthUrl: string } => {
  const appName = 'Feminine Elegance E-Commerce';
  
  // Generate a new secret using speakeasy
  const secretObj = speakeasy.generateSecret({
    name: `${appName}:${email}`
  });
  
  return {
    secret: secretObj.base32,
    otpAuthUrl: secretObj.otpauth_url || ''
  };
};

// Generate a QR code from an OTP auth URL
export const generateQRCode = async (otpAuthUrl: string): Promise<string> => {
  try {
    // Generate a QR code as a data URL
    return await QRCode.toDataURL(otpAuthUrl);
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

// Verify a token against a secret
export const verifyToken = (token: string, secret: string): boolean => {
  try {
    // Verify the token using speakeasy
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: token.replace(/\s+/g, '') // Remove any spaces from the token
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
};