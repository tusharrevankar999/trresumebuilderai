# Firestore Security Rules Update Guide

## Problem
You're getting "Missing or insufficient permissions" error when trying to fetch resume records and cover letter records in the admin dashboard.

## Solution
Update your Firestore security rules to allow collectionGroup queries and reading from the users collection.

## Steps to Fix

1. **Go to Firebase Console**
   - Navigate to: https://console.firebase.google.com/
   - Select your project: `trstyle-bd6e4`
   - Go to: **Firestore Database** → **Rules** tab

2. **Copy and Paste These Rules**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Allow access to nested cvs collection under users
    // This allows: users/{userId}/cvs/{document}
    // This also allows collectionGroup queries on 'cvs' collection
    match /users/{userId}/cvs/{document} {
      allow read, write: if true;
    }
    
    // Allow reads and writes to ats_analyses collection
    match /ats_analyses/{document} {
      allow read, write: if true;
    }
    
    // Allow reads and writes to cover_letters collection
    match /cover_letters/{document} {
      allow read, write: if true;
    }
    
    // Allow reading users collection (for fallback method)
    match /users/{userId} {
      allow read: if true;
      // Allow writes only to create user documents if needed
      allow write: if false; // Users are created automatically, no manual writes needed
    }
  }
}
```

3. **Click "Publish"** to save the rules

4. **Wait 1-2 minutes** for the rules to propagate

5. **Refresh your admin dashboard** and try again

## What These Rules Do

- **`match /users/{userId}/cvs/{document}`**: Allows reading/writing to the nested `cvs` collection under each user. This rule also automatically allows collectionGroup queries on the `cvs` collection (needed for admin dashboard)
- **`match /ats_analyses/{document}`**: Allows reading/writing ATS analysis records
- **`match /cover_letters/{document}`**: Allows reading/writing cover letter records
- **`match /users/{userId}`**: Allows reading the users collection (for fallback method)

## Security Note

⚠️ **These rules allow public read/write access for testing purposes.**

For production, you should implement proper authentication-based rules, for example:

```javascript
match /users/{userId}/cvs/{document=**} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.token.email == userId;
}
```

## Verify Rules Are Working

After updating the rules:
1. Go to your admin dashboard: `/tradmin`
2. Click "Check AI Resume Records"
3. Check browser console - you should see:
   - `✅ Retrieved X resume records via collectionGroup` (or via users collection)
   - No permission-denied errors

## Troubleshooting

If you still get permission errors:
1. Make sure you clicked "Publish" in Firebase Console
2. Wait 2-3 minutes for rules to propagate
3. Clear browser cache and refresh
4. Check browser console for specific error messages
5. Verify you're using the correct Firebase project ID: `trstyle-bd6e4`

