/**
 * Gemini AI integration for resume parsing
 * Uses Google's Gemini API (free tier available)
 */

export interface ParsedResumeData {
    personalInfo: {
        fullName: string;
        email: string;
        phone: string;
        location: string;
        linkedin: string;
        portfolio: string;
    };
    summary: string;
    experience: Array<{
        company: string;
        position: string;
        startDate: string;
        endDate: string;
        location?: string;
        current: boolean;
        description: string[];
    }>;
    education: Array<{
        degree: string;
        school: string;
        gpa: string;
        graduationDate: string;
    }>;
    skills: {
        technical: string[];
        soft: string[];
    };
    projects: Array<{
        name: string;
        description: string;
    }>;
    certifications: Array<{
        name: string;
    }>;
    achievements: Array<{
        name: string;
    }>;
}

/**
 * Parse resume text using Gemini AI
 * @param text - Extracted text from PDF
 * @param apiKey - Gemini API key (optional, can be set via env var)
 * @returns Parsed resume data
 */
export async function parseResumeWithGemini(
    text: string,
    apiKey?: string
): Promise<ParsedResumeData | null> {
    try {
        // Log the first 200 characters of the resume text for debugging
        console.log('📄 Parsing resume text (first 200 chars):', text.substring(0, 200));
        console.log('📏 Total resume text length:', text.length);
        
        const prompt = `You are an expert at parsing resumes. Extract ALL information from the ACTUAL resume text provided below. DO NOT use example data or placeholder values. Parse ONLY the information that exists in the resume text.

IMPORTANT: 
- Extract information ONLY from the resume text provided below
- DO NOT make up or invent information
- DO NOT use example names like "John Doe" or placeholder data
- If information is missing, use empty strings or empty arrays
- Return ONLY valid JSON, no markdown, no code blocks, no explanations

Required JSON structure:
{
  "personalInfo": {
    "fullName": "string (extract from resume)",
    "email": "string (extract from resume)",
    "phone": "string (extract from resume)",
    "location": "string (extract from resume)",
    "linkedin": "string (extract from resume, full URL or username)",
    "portfolio": "string (extract from resume, website URL)"
  },
  "summary": "string (extract professional summary/objective from resume)",
  "experience": [
    {
      "company": "string (extract from resume)",
      "position": "string (extract from resume)",
      "startDate": "string (extract from resume, e.g., 'Jan 2020')",
      "endDate": "string (extract from resume, e.g., 'Present' or 'Dec 2023')",
      "location": "string (optional, extract from resume)",
      "current": boolean (true if endDate is Present/Current),
      "description": ["array of bullet points extracted from resume"]
    }
  ],
  "education": [
    {
      "degree": "string (extract from resume, e.g., 'Bachelor of Science in Computer Science')",
      "school": "string (extract from resume)",
      "gpa": "string (extract from resume if mentioned, otherwise empty string)",
      "graduationDate": "string (extract from resume, e.g., 'May 2020')"
    }
  ],
  "skills": {
    "technical": ["array of technical skills extracted from resume"],
    "soft": ["array of soft skills extracted from resume"]
  },
  "projects": [
    {
      "name": "string (extract from resume)",
      "description": "string (extract from resume)"
    }
  ],
  "certifications": [
    {
      "name": "string (extract from resume)"
    }
  ],
  "achievements": [
    {
      "name": "string (extract from resume)"
    }
  ]
}

ACTUAL RESUME TEXT TO PARSE:
${text}

Now extract the information from the resume text above and return ONLY the JSON object.`;

        // Call Hugging Face AI API through server-side proxy (avoids CORS)
        const hfModel = 'meta-llama/Meta-Llama-3-8B-Instruct';
        
        const response = await fetch('/api/ai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                model: hfModel,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error || 'Unknown error';
            
            console.error('Hugging Face API error:', errorMessage);
            
            // Provide helpful error messages
            if (errorMessage.includes('loading')) {
                console.warn('⚠️ Model is loading. This may take 20-30 seconds on first request.');
            } else if (errorMessage.includes('rate limit')) {
                console.warn('⚠️ Rate limit exceeded. Please wait a moment and try again.');
            }
            
            return null;
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error('❌ Invalid response from Hugging Face API:', data);
            return null;
        }
        
        const content = data.candidates[0].content.parts[0].text;
        console.log('📥 Received AI response (first 500 chars):', content.substring(0, 500));
        
        // Check if AI returned an error message instead of JSON
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes('cannot parse') || 
            lowerContent.includes('not provided') || 
            lowerContent.includes('please provide') ||
            lowerContent.includes('error') && lowerContent.includes('resume')) {
            console.error('❌ AI returned an error message instead of JSON:', content);
            console.error('⚠️ This usually means the resume text extraction failed or text was too short');
            
            // Save error to Firebase
            try {
                const { saveErrorLog } = await import('./firebase');
                await saveErrorLog(new Error('AI returned error message instead of JSON'), {
                    errorType: 'AI_INVALID_RESPONSE',
                    errorMessage: content.substring(0, 500),
                    textLength: text.length,
                    page: 'builder',
                    action: 'parseResumeWithGemini',
                });
            } catch (logError) {
                console.error('Failed to log error to Firebase:', logError);
            }
            
            return null;
        }
        
        // Extract JSON from response (remove markdown code blocks if present)
        let jsonText = content.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        try {
            const parsed = JSON.parse(jsonText) as ParsedResumeData;
            console.log('✅ Successfully parsed resume data:', {
                fullName: parsed.personalInfo?.fullName,
                email: parsed.personalInfo?.email,
                experienceCount: parsed.experience?.length || 0,
                educationCount: parsed.education?.length || 0
            });
            return validateAndCleanParsedData(parsed);
        } catch (parseError) {
            console.error('❌ Error parsing JSON from AI response:', parseError);
            console.error('📄 Raw response text:', jsonText.substring(0, 1000));
            
            // Save error to Firebase
            try {
                const { saveErrorLog } = await import('./firebase');
                await saveErrorLog(parseError instanceof Error ? parseError : new Error(String(parseError)), {
                    errorType: 'AI_JSON_PARSE_ERROR',
                    errorMessage: `Failed to parse JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                    rawResponse: jsonText.substring(0, 1000),
                    textLength: text.length,
                    page: 'builder',
                    action: 'parseResumeWithGemini',
                });
            } catch (logError) {
                console.error('Failed to log error to Firebase:', logError);
            }
            
            return null;
        }

    } catch (error) {
        console.error('❌ Error parsing resume with Hugging Face:', error);
        
        // Save error to Firebase
        try {
            const { saveErrorLog } = await import('./firebase');
            await saveErrorLog(error instanceof Error ? error : new Error(String(error)), {
                errorType: 'AI_RESUME_PARSING',
                textLength: text.length,
                page: 'builder',
                action: 'parseResumeWithGemini',
            });
        } catch (logError) {
            console.error('Failed to log error to Firebase:', logError);
        }
        
        return null;
    }
}

/**
 * Format Hugging Face response to match expected format
 */
function formatHuggingFaceResponse(data: any): any {
    let text = '';
    
    if (Array.isArray(data)) {
        text = data[0]?.generated_text || data[0]?.text || '';
    } else if (data.generated_text) {
        text = data.generated_text;
    } else if (data[0]?.generated_text) {
        text = data[0].generated_text;
    } else if (typeof data === 'string') {
        text = data;
    }

    return {
        candidates: [{
            content: {
                parts: [{
                    text: text.trim()
                }]
            }
        }]
    };
}

/**
 * Validate and clean parsed resume data
 */
function validateAndCleanParsedData(parsed: ParsedResumeData): ParsedResumeData {
    return {
        personalInfo: {
            fullName: parsed.personalInfo?.fullName || '',
            email: parsed.personalInfo?.email || '',
            phone: parsed.personalInfo?.phone || '',
            location: parsed.personalInfo?.location || '',
            linkedin: parsed.personalInfo?.linkedin || '',
            portfolio: parsed.personalInfo?.portfolio || '',
        },
        summary: parsed.summary || '',
        experience: Array.isArray(parsed.experience) ? parsed.experience : [],
        education: Array.isArray(parsed.education) ? parsed.education : [],
        skills: {
            technical: Array.isArray(parsed.skills?.technical) ? parsed.skills.technical : [],
            soft: Array.isArray(parsed.skills?.soft) ? parsed.skills.soft : [],
        },
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
        achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
    };
}

