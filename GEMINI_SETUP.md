# Gemini AI Setup for Resume Parsing

This application uses Google's Gemini AI (free tier) to intelligently parse resume PDFs and extract structured data.

## Getting Your Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key" or "Get API Key"
4. Copy your API key

## Setting Up the API Key

### Option 1: Environment Variable (Recommended)

Create a `.env` file in the root directory:

```bash
VITE_GEMINI_API_KEY=AIzaSyAq64nfJv9jpkCK9DDrTakb920KfMGvbkY
```

### Option 2: Pass as Parameter

The `parseResumeWithGemini` function accepts an optional `apiKey` parameter if you prefer to pass it directly.

## How It Works

1. When a user uploads a PDF resume, the text is extracted
2. The extracted text is sent to Gemini AI with a structured prompt
3. Gemini returns parsed JSON with all resume sections (personal info, experience, education, skills, etc.)
4. The parsed data automatically populates the form fields
5. The resume preview updates in real-time with the extracted data

## Fallback Behavior

If the Gemini API key is not set or the API call fails, the application will automatically fall back to regex-based parsing, which is less accurate but still functional.

## API Limits

- Gemini Pro (free tier) has generous rate limits
- No credit card required for basic usage
- Suitable for development and moderate production use

## Troubleshooting

- **"Gemini API key not found"**: Make sure you've set `VITE_GEMINI_API_KEY` in your `.env` file
- **API errors**: Check that your API key is valid and hasn't been revoked
- **Slow parsing**: The AI parsing takes 2-5 seconds depending on resume complexity


