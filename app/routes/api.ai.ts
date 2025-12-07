import type { ActionFunctionArgs } from "react-router";

/**
 * Hugging Face AI API proxy
 * Uses Hugging Face Inference API exclusively (free, high quality)
 * This keeps API keys secure on the server
 */
export async function action({ request }: ActionFunctionArgs) {
    try {
        const body = await request.json();
        const { prompt, model } = body;

        if (!prompt) {
            return new Response(
                JSON.stringify({ error: "Prompt is required" }),
                { 
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                }
            );
        }

        // Use Hugging Face exclusively
        return await callHuggingFace(prompt, model);

    } catch (error: any) {
        console.error('Error in Hugging Face API proxy:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { 
                status: 500,
                headers: { "Content-Type": "application/json" }
            }
        );
    }
}

/**
 * Call Hugging Face Inference API
 * Uses API key for better rate limits and access to more models
 */
async function callHuggingFace(prompt: string, model?: string): Promise<Response> {
    // Use Meta-Llama-3-8B-Instruct - Most stable + best for resume apps
    const hfModel = model || "meta-llama/Meta-Llama-3-8B-Instruct";
    
    // Get Hugging Face API key (required for better rate limits)
    const hfToken = process.env.HUGGINGFACE_API_KEY || process.env.VITE_HUGGINGFACE_API_KEY;
    
    if (!hfToken) {
        console.warn('⚠️ Hugging Face API key not found. Using public access (lower rate limits).');
    }
    
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    
    if (hfToken) {
        headers['Authorization'] = `Bearer ${hfToken}`;
        console.log('✅ Using Hugging Face API with authentication');
    }

    // Use the new OpenAI-compatible endpoint
    const hfApiUrl = `https://router.huggingface.co/v1/chat/completions`;
    console.log('🔗 Calling Hugging Face API:', hfApiUrl);
    console.log('📝 Model:', hfModel);
    console.log('🔑 API Key present:', !!hfToken);

    const response = await fetch(
        hfApiUrl,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: hfModel,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 2000,
                temperature: 0.7,
            }),
        }
    );

    if (!response.ok) {
        // If model is loading, wait and retry
        if (response.status === 503) {
            const errorData = await response.json();
            if (errorData.error?.includes('loading')) {
                // Wait 10 seconds and retry once
                console.log('⏳ Model is loading, waiting 10 seconds...');
                await new Promise(resolve => setTimeout(resolve, 10000));
                const retryResponse = await fetch(
                    hfApiUrl,
                    {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            model: hfModel,
                            messages: [
                                {
                                    role: 'user',
                                    content: prompt
                                }
                            ],
                            max_tokens: 2000,
                            temperature: 0.7,
                        }),
                    }
                );
                
                if (retryResponse.ok) {
                    const retryData = await retryResponse.json();
                    return formatHuggingFaceResponse(retryData);
                }
            }
        }
        
        const errorText = await response.text();
        console.error('❌ Hugging Face API error:', {
            status: response.status,
            statusText: response.statusText,
            url: hfApiUrl,
            error: errorText
        });
        throw new Error(`Hugging Face API error: ${errorText}`);
    }

    const data = await response.json();
    return formatHuggingFaceResponse(data);
}

/**
 * Format Hugging Face response to match Gemini format
 * New OpenAI-compatible endpoint returns data in OpenAI format
 */
function formatHuggingFaceResponse(data: any): Response {
    // OpenAI-compatible format: data.choices[0].message.content
    let text = '';
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
        // OpenAI-compatible format
        text = data.choices[0].message.content || '';
    } else if (Array.isArray(data)) {
        // Fallback: Some models return array
        text = data[0]?.generated_text || data[0]?.text || '';
    } else if (data.generated_text) {
        // Old inference API format
        text = data.generated_text;
    } else if (data[0]?.generated_text) {
        text = data[0].generated_text;
    } else if (typeof data === 'string') {
        text = data;
    }

    // Format to match Gemini response structure
    const formattedResponse = {
        candidates: [{
            content: {
                parts: [{
                    text: text.trim()
                }]
            }
        }]
    };

    return new Response(
        JSON.stringify(formattedResponse),
        { 
            status: 200,
            headers: { "Content-Type": "application/json" }
        }
    );
}


