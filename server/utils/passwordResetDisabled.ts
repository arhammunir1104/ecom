/**
 * Password Reset Functionality
 * 
 * This module contains placeholder endpoints that handle any password reset related requests.
 * As per business requirements, password reset functionality has been disabled.
 * All endpoints now return a 501 Not Implemented response.
 */

import { Express } from 'express';

export function setupPasswordResetHandlers(app: Express) {
  // Array of all password reset related endpoints
  const passwordResetEndpoints = [
    "/api/auth/send-reset-otp",
    "/api/auth/forgot-password",
    "/api/auth/verify-reset-code-old",
    "/api/auth/get-temp-token",
    "/api/auth/firebase-password-reset",
    "/api/auth/reset-password",
    "/api/auth/generate-reset-code",
    "/api/auth/verify-reset-code",
    "/api/auth/request-password-reset"
  ];

  // Register a handler for all password reset endpoints
  passwordResetEndpoints.forEach(endpoint => {
    app.post(endpoint, (req, res) => {
      console.log(`Received password reset request to disabled endpoint: ${req.path}`);
      return res.status(501).json({
        success: false,
        message: "Password reset functionality has been disabled"
      });
    });
  });

  // This ensures any old links or client calls get a proper response
  console.log("Password reset functionality has been disabled. All related endpoints return 501 Not Implemented.");
}