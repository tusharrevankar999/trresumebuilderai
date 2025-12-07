# Firebase Setup & Troubleshooting Guide

## Firebase Services Used

1. **Firestore Database** - Stores resume metadata and ATS analysis records
   - Nested Collection: `users/{email}/cvs` - Resume download records (organized by user email)
   - Collection: `ats_analyses` - ATS analysis records

## Important Notes

### Collections Won't Appear Until They Have Data
- Firestore collections are **only visible in the console after the first document is saved**
- If you don't see the collections, try downloading a resume or running an ATS analysis first

### How to Verify Data is Being Saved

1. **Check Browser Console**
   - Open Developer Tools (F12)
   - Look for messages like:
     - `✅ Resume record saved successfully!`
     - `📄 Collection path: users/{email}/cvs`
     - `🆔 Document ID: [some-id]`

2. **Check Firebase Console**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Navigate to: Firestore Database
   - Navigate to: `users` → `{email}` → `cvs` collection
   - Look for collections: `users/{email}/cvs` and `ats_analyses`

3. **Check Network Tab**
   - Open Developer Tools → Network tab
   - Filter by "firestore"
   - Look for POST requests to `firestore.googleapis.com`
   - Status should be 200 OK

## Common Issues

### Issue: Collections Not Showing in Firebase Console

**Solution:**
1. Make sure you've actually downloaded a resume or run an analysis
2. Refresh the Firebase Console
3. Check browser console for errors
4. Verify Firestore security rules allow writes

### Issue: Permission Denied Error

**Solution:** Update Firestore Security Rules:

1. Go to Firebase Console → Firestore Database → Rules
2. Update rules to allow writes (for testing):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow access to nested cvs collection under users
    match /users/{userId}/cvs/{document=**} {
      allow read, write: if true;
    }
    
    // Allow reads and writes to ats_analyses collection
    match /ats_analyses/{document=**} {
      allow read, write: if true;
    }
  }
}
```

**⚠️ Warning:** The above rules allow anyone to read/write. For production, implement proper authentication-based rules.

### Issue: Data Not Saving

**Check:**
1. Browser console for error messages
2. Network tab for failed requests
3. Firestore security rules
4. Firebase project configuration matches `app/lib/firebase.ts`

## Testing Firebase Connection

You can test the Firebase connection by running this in the browser console:

```javascript
import { testFirebaseConnection } from './app/lib/firebase';
testFirebaseConnection();
```

## Data Structure

### Users/{Email}/CVs Collection Document Structure:
**Path:** `users/{email}/cvs/{documentId}`
```typescript
{
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  summary?: string;
  experience?: Array<{...}>;
  education?: Array<{...}>;
  skills?: { technical: string[], soft: string[] };
  projects?: Array<{...}>;
  certifications?: Array<{...}>;
  achievements?: Array<{...}>;
  template?: string;
  exportFormat: 'PDF' | 'DOC' | 'PNG' | 'JPG';
  downloadedAt: Timestamp;
}
```

### ATS Analyses Collection Document Structure:
```typescript
{
  fullName?: string;
  email?: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  overallScore?: number;
  keywordMatch?: number;
  atsCompatibility?: number;
  contentStrength?: number;
  lengthScore?: number;
  missingSkills?: string[];
  overusedWords?: string[];
  analyzedAt: Timestamp;
}
```

