import type { ActionFunctionArgs } from "react-router";

/**
 * Server-side API proxy for Gemini API
 * This keeps the API key secure on the server and prevents it from being exposed in the browser
 */
export async function action({ request }: ActionFunctionArgs) {
    try {
        // Get API key from server-side environment variable (NOT VITE_ prefix)
        // Note: In React Router v7, VITE_ prefixed vars are available on server too
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        
        if (!apiKey) {
            console.error('❌ Gemini API key not found in environment variables');
            console.error('💡 Make sure you have GEMINI_API_KEY or VITE_GEMINI_API_KEY in your .env file');
            return new Response(
                JSON.stringify({ error: "Gemini API key not configured on server. Check server console for details." }),
                { 
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                }
            );
        }

        // Log that we're using an API key (but not the actual key)
        console.log('✅ Using Gemini API key (key length:', apiKey.length, 'characters)');

        const body = await request.json();
        const { prompt, model = "gemini-2.5-pro" } = body;

        if (!prompt) {
            return new Response(
                JSON.stringify({ error: "Prompt is required" }),
                { 
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                }
            );
        }

        // Make request to Gemini API from server-side
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt,
                                },
                            ],
                        },
                    ],
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: { message: errorText } };
            }

            const errorMessage = errorData.error?.message || errorText || 'Unknown error';
            
            // Check for leaked API key error - only if message specifically mentions "leaked"
            if (errorMessage.toLowerCase().includes('leaked') || errorMessage.toLowerCase().includes('reported as leaked')) {
                console.error('❌ Gemini API Key Error: Your API key was reported as leaked.');
                console.error('🔑 Please get a new API key from: https://makersuite.google.com/app/apikey');
                console.error('📝 Update your .env file with: GEMINI_API_KEY=your_new_key');
                return new Response(
                    JSON.stringify({ 
                        error: "API Key Error: Please get a new Gemini API key and update your .env file. Check server console for details.",
                        code: "LEAKED_KEY"
                    }),
                    { 
                        status: 403,
                        headers: { "Content-Type": "application/json" }
                    }
                );
            }

            // Log the actual error for debugging (but don't log the full error if it's a leaked key)
            if (!errorMessage.toLowerCase().includes('leaked')) {
                console.error('Gemini API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorMessage,
                    fullError: errorData
                });
            } else {
                console.error('Full Gemini API Error Response:', JSON.stringify(errorData, null, 2));
            }

            return new Response(
                JSON.stringify({ 
                    error: errorMessage,
                    status: response.status
                }),
                { 
                    status: response.status,
                    headers: { "Content-Type": "application/json" }
                }
            );
        }

        const data = await response.json();
        return new Response(
            JSON.stringify(data),
            { 
                status: 200,
                headers: { "Content-Type": "application/json" }
            }
        );

    } catch (error: any) {
        console.error('Error in Gemini API proxy:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { 
                status: 500,
                headers: { "Content-Type": "application/json" }
            }
        );
    }
}

