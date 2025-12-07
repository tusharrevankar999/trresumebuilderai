# How to Get a New Gemini API Key

Your current Gemini API key was reported as leaked and has been disabled. Follow these steps to get a new one:

## Step 1: Get a New API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"** or **"Get API Key"**
4. Select your Google Cloud project (or create a new one)
5. Copy the new API key

## Step 2: Set Up the API Key

### Create `.env` file in project root:

```bash
# In your project root directory
touch .env
```

### Add your API key to `.env`:

```bash
GEMINI_API_KEY=AIzaSyAfZCM-IdEtXgk21f5TX5N-relisJVty44
```

**Replace `AIzaSyAfZCM-IdEtXgk21f5TX5N-relisJVty44` with your actual API key from Step 1**

⚠️ **Important**: 
- Use `GEMINI_API_KEY` (NOT `VITE_GEMINI_API_KEY`) - this keeps the key server-side only
- The API key is now handled by a server-side proxy (`/api/gemini`) to prevent it from being exposed in the browser
- Your API key will NEVER appear in browser network requests or client-side code

## Step 3: Restart Your Development Server

After creating/updating the `.env` file:

```bash
# Stop your current dev server (Ctrl+C)
# Then restart it
npm run dev
```

## Step 4: Verify It Works

1. Try uploading a resume or using AI features
2. Check browser console - you should NOT see "leaked" errors
3. The API should work normally

## Important Security Notes

✅ **DO:**
- Keep your `.env` file local only
- Add `.env` to `.gitignore` (already done)
- Use environment variables for API keys
- Rotate keys if they're exposed

❌ **DON'T:**
- Commit `.env` to git
- Share API keys publicly
- Hardcode API keys in source code
- Include API keys in screenshots or documentation

## Troubleshooting

### "API key not found"
- Make sure `.env` file exists in project root
- Make sure variable name is exactly: `GEMINI_API_KEY` (NOT `VITE_GEMINI_API_KEY`)
- Restart your dev server after creating `.env`
- Check server console logs for API key errors

### "Still getting leaked error"
- Make sure you're using the NEW API key, not the old one
- Clear browser cache
- Restart dev server

### "Permission denied"
- Check that your API key is valid
- Make sure Gemini API is enabled in your Google Cloud project
- Verify you copied the entire key correctly

