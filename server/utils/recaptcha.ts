import axios from 'axios';

export const verifyRecaptcha = async (token: string): Promise<boolean> => {
  // Get the secret key from environment variables
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    console.error('Missing required reCAPTCHA secret key');
    return false;
  }

  try {
    // Make a POST request to the Google reCAPTCHA verification API
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: secretKey,
          response: token
        }
      }
    );

    // Check if the verification was successful
    return response.data.success;
  } catch (error) {
    console.error('reCAPTCHA verification failed:', error);
    return false;
  }
};