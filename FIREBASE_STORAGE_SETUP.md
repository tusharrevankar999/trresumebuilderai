# How to Activate Firebase Storage

## Step-by-Step Guide

### 1. Go to Firebase Console
1. Visit [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **trstyle-bd6e4**

### 2. Navigate to Storage
1. In the left sidebar, click on **"Storage"** (or "Build" → "Storage")
2. If you see a "Get started" button, click it
3. If Storage is already enabled, you'll see the Storage dashboard

### 3. Initialize Storage (First Time Setup)
If this is your first time:

1. Click **"Get started"** button
2. You'll see a setup wizard with these steps:

   **Step 1: Security Rules**
   - Choose **"Start in test mode"** (for development)
   - Or **"Start in production mode"** (more secure, requires authentication)
   - Click **"Next"**

   **Step 2: Storage Location**
   - Select a **Cloud Storage location** (choose closest to your users)
   - Recommended: `us-central1` or `asia-south1` (for India)
   - Click **"Done"**

3. Wait for Storage to initialize (usually takes 10-30 seconds)

### 4. Update Storage Security Rules
After Storage is activated:

1. Go to **Storage** → **Rules** tab
2. Replace the default rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow uploads to resumes folder
    match /resumes/{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

3. Click **"Publish"**

### 5. Verify Storage is Active
You should see:
- ✅ Storage bucket URL: `gs://trstyle-bd6e4.firebasestorage.app`
- ✅ Files tab (initially empty)
- ✅ Rules tab
- ✅ Usage tab

## Alternative: Enable via Firebase CLI

If you prefer command line:

```bash
# Install Firebase CLI (if not installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Storage
firebase init storage

# Follow the prompts to enable Storage
```

## Troubleshooting

### Issue: "Storage is not enabled"
- Make sure you're in the correct Firebase project
- Check that you have Owner or Editor permissions
- Try refreshing the page

### Issue: "Permission denied" errors
- Update Storage security rules (see Step 4 above)
- Make sure rules are published

### Issue: "Bucket not found"
- Wait a few minutes after enabling Storage
- Refresh the Firebase Console
- Check that the bucket name matches: `trstyle-bd6e4.firebasestorage.app`

## Quick Checklist

- [ ] Firebase Storage is enabled in Console
- [ ] Storage location is selected
- [ ] Security rules are updated and published
- [ ] Bucket URL is visible: `gs://trstyle-bd6e4.firebasestorage.app`

## After Activation

Once Storage is activated:
1. Your app will automatically start uploading files
2. Files will appear in: Storage → Files → `resumes/` folder
3. You can view/download files from Firebase Console
4. Download URLs will be saved in Firestore `cvs` collection

