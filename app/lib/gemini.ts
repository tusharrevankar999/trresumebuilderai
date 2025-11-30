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
        // Get API key from parameter, env var, or use a default (user should set their own)
        const key = apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
        
        if (!key) {
            console.warn('Gemini API key not found. Falling back to basic parsing.');
            return null;
        }

        const prompt = `You are an expert at parsing resumes. Extract all information from the following resume text and return it as a JSON object with this exact structure:

{
  "personalInfo": {
    "fullName": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedin": "string (full URL or username)",
    "portfolio": "string (website URL)"
  },
  "summary": "string (professional summary/objective)",
  "experience": [
    {
      "company": "string",
      "position": "string",
      "startDate": "string (e.g., 'Jan 2020')",
      "endDate": "string (e.g., 'Present' or 'Dec 2023')",
      "location": "string (optional)",
      "current": boolean,
      "description": ["string array of bullet points"]
    }
  ],
  "education": [
    {
      "degree": "string (e.g., 'Bachelor of Science in Computer Science')",
      "school": "string",
      "gpa": "string (if mentioned)",
      "graduationDate": "string (e.g., 'May 2020')"
    }
  ],
  "skills": {
    "technical": ["array of technical skills"],
    "soft": ["array of soft skills"]
  },
  "projects": [
    {
      "name": "string",
      "description": "string"
    }
  ],
  "certifications": [
    {
      "name": "string"
    }
  ],
  "achievements": [
    {
      "name": "string"
    }
  ]
}

Resume text:
${text}

Return ONLY valid JSON, no markdown, no code blocks, no explanations. If a field is not found, use an empty string or empty array.`;

        // Use gemini-2.5-pro
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${key}`,
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
            console.error('Gemini API error:', errorText);
            return null;
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error('Invalid response from Gemini API');
            return null;
        }

        const content = data.candidates[0].content.parts[0].text;
        
        // Extract JSON from response (remove markdown code blocks if present)
        let jsonText = content.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const parsed = JSON.parse(jsonText) as ParsedResumeData;
        
        // Validate and clean the parsed data
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

    } catch (error) {
        console.error('Error parsing resume with Gemini:', error);
        return null;
    }
}

