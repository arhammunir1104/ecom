# Firebase Setup Guide for Feminine Elegance E-Commerce Store

This guide will help you properly configure your Firebase project to work with the e-commerce application. Please follow these steps carefully to avoid authentication issues.

## 1. Enable Authentication Methods

1. Go to the [Firebase Console](https://console.firebase.google.com/) and select your project
2. Navigate to **Authentication** in the left sidebar
3. Select the **Sign-in method** tab
4. Enable the following authentication methods:
   - **Email/Password** - This is required for traditional authentication
   - **Google** - This is required for Google sign-in functionality

## 2. Add Authorized Domains

1. Stay in the **Authentication** section of the Firebase Console
2. Go to the **Settings** tab
3. Scroll down to the **Authorized domains** section
4. Add your Replit domain to the list:
   - Add the exact domain from the address bar of your Replit app (e.g., `your-repl-name.username.repl.co`)
   - For a fully deployed Replit app, also add the `.replit.app` domain

## 3. Configure Firestore Security Rules

1. In the Firebase Console, navigate to **Firestore Database** in the left sidebar 
2. Select the **Rules** tab
3. Replace the existing rules with the ones from the `firebase-security-rules.txt` file in this project
4. Click **Publish** to update the rules

## 4. Verification Steps

To verify your setup is working correctly:

1. Try to register a new user with email and password
2. Check that the user appears in both:
   - The **Authentication** tab in Firebase Console
   - The **Firestore Database** with a document in the `users` collection
3. Try logging in with the credentials
4. Try the Google sign-in option

## Common Issues and Solutions

### "auth/operation-not-allowed" Error
This means Email/Password authentication is not enabled in your Firebase project.
- Solution: Follow step 1 to enable Email/Password authentication

### "auth/unauthorized-domain" Error
This means your domain is not in the authorized domains list.
- Solution: Follow step 2 to add your Replit domain to the authorized domains list

### "permission-denied" Error in Firestore
This means your security rules are not configured correctly.
- Solution: Follow step 3 to update your Firestore security rules

### Empty Firestore Database
If users authenticate but no data appears in Firestore:
- Check the console for specific errors
- Verify your Firestore security rules allow writing to the `users` collection
- Make sure your project has Firestore enabled (not just Realtime Database)