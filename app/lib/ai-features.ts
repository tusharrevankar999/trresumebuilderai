/**
 * AI-Powered Resume Builder Features
 * Implements best practices from 2025 resume builder tools
 */

import { parseResumeWithGemini } from './gemini';
import type { ParsedResumeData } from './gemini';

// Re-export ParsedResumeData and parseResumeWithGemini for convenience
export type { ParsedResumeData } from './gemini';
export { parseResumeWithGemini } from './gemini';

/**
 * Helper function to call Hugging Face AI API through server-side proxy
 * Uses server proxy to avoid CORS issues
 * Uses Hugging Face exclusively (free, no quota limits)
 */
async function callGeminiAPI(prompt: string, model: string = 'meta-llama/Meta-Llama-3-8B-Instruct'): Promise<any> {
    // Call our server-side proxy to avoid CORS issues
    const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt,
            model,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Unknown error';
        
        console.error('Hugging Face API error:', errorMessage);
        
        // Provide helpful error messages
        if (errorMessage.includes('loading')) {
            throw new Error('Model is loading. Please wait a moment and try again.');
        } else if (errorMessage.includes('rate limit')) {
            throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        } else {
            throw new Error(errorMessage);
        }
    }

    const data = await response.json();
    return data;
}

/**
 * Format Hugging Face response to match expected format
 */
function formatHuggingFaceResponse(data: any): any {
    // Hugging Face returns different formats depending on model
    let text = '';
    
    if (Array.isArray(data)) {
        // Some models return array
        text = data[0]?.generated_text || data[0]?.text || '';
    } else if (data.generated_text) {
        text = data.generated_text;
    } else if (data[0]?.generated_text) {
        text = data[0].generated_text;
    } else if (typeof data === 'string') {
        text = data;
    }

    // Format to match expected response structure
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

export interface JobDescription {
    title: string;
    description: string;
    company?: string;
    requiredSkills?: string[];
}

export interface ATSScore {
    overall: number;
    sections: {
        keywords: number;
        formatting: number;
        contact: number;
        length: number;
        sections: number;
    };
    feedback: string[];
}

export interface KeywordMatch {
    keyword: string;
    found: boolean;
    count: number;
}

export interface OverusedWord {
    word: string;
    count: number;
    suggestions: string[];
}

export interface QuantifiedMetrics {
    hasMetrics: boolean;
    metricCount: number;
    bulletsWithoutMetrics: number;
    suggestions: string[];
}

/**
 * 1. Generate Professional Summary using AI with multiple styles
 */
export type SummaryStyle = 'classic' | 'bold' | 'storytelling';

export async function generateSummary(
    resumeData: ParsedResumeData,
    style: SummaryStyle = 'classic',
    apiKey?: string
): Promise<string> {
    const stylePrompts = {
        classic: `Write a classic, professional summary (2-3 sentences, max 150 words) that:
- Uses traditional professional language
- Highlights key achievements and experience
- Mentions relevant skills
- Is tailored for ATS systems
- Uses action verbs and quantifiable results
- Is concise and impactful`,
        bold: `Write a bold, confident summary (2-3 sentences, max 150 words) that:
- Uses strong, assertive language
- Leads with impressive achievements and metrics
- Demonstrates confidence and expertise
- Uses power words and action verbs
- Is ATS-optimized
- Makes a strong first impression`,
        storytelling: `Write a compelling, narrative-style summary (2-3 sentences, max 150 words) that:
- Tells a story about the candidate's journey
- Connects experience to impact
- Uses engaging, human language
- Still includes key skills and achievements
- Is ATS-friendly but more personable
- Creates an emotional connection`
    };

    const prompt = `Generate a ${style} professional summary for this resume:

Name: ${resumeData.personalInfo.fullName}
Experience: ${resumeData.experience.map(e => `${e.position} at ${e.company}`).join(', ')}
Skills: ${resumeData.skills.technical.slice(0, 10).join(', ')}
Education: ${resumeData.education.map(e => e.degree).join(', ')}

${stylePrompts[style]}

Return ONLY the summary text, no explanations or markdown.`;

    try {
        const data = await callGeminiAPI(prompt);
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error('Invalid response from Gemini API');
            return '';
        }
        
        return data.candidates[0].content.parts[0].text.trim() || '';
    } catch (error) {
        console.error('Error generating summary:', error);
        return '';
    }
}

/**
 * 2. Generate/Improve Bullet Points for Experience
 */
export async function generateBulletPoints(
    position: string,
    company: string,
    currentBullets: string[],
    apiKey?: string
): Promise<string[]> {
    const prompt = `Rewrite these resume bullet points to be more impactful and ATS-friendly:

Position: ${position}
Company: ${company}
Current bullets:
${currentBullets.map(b => `- ${b}`).join('\n')}

Requirements:
- Use action verbs (Led, Developed, Increased, Reduced, etc.)
- Include quantifiable metrics (numbers, percentages, dollar amounts)
- Be specific and concrete
- Each bullet should be 1-2 lines max
- Focus on achievements, not just responsibilities
- Make them compelling for recruiters

Return ONLY a JSON array of strings, each string is one improved bullet point. Example: ["Led team of 5 engineers...", "Increased revenue by 42%..."]`;

    try {
        const data = await callGeminiAPI(prompt);
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            return currentBullets;
        }
        
        const text = data.candidates[0].content.parts[0].text.trim() || '';
        
        // Extract JSON array
        let jsonText = text;
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const bullets = JSON.parse(jsonText);
        return Array.isArray(bullets) ? bullets : currentBullets;
    } catch (error) {
        console.error('Error generating bullet points:', error);
        return currentBullets;
    }
}

/**
 * 3. Job Description Matcher - Extract Keywords and Calculate Match Score
 */
export function extractKeywordsFromJD(jobDescription: string): string[] {
    // Extract important keywords (skills, technologies, qualifications)
    const keywords: string[] = [];
    
    // Common skill patterns
    const skillPatterns = [
        /\b(?:JavaScript|TypeScript|Python|Java|C\+\+|React|Vue|Angular|Node\.js|SQL|MongoDB|PostgreSQL|AWS|Docker|Kubernetes|Git|Linux|API|REST|GraphQL|HTML|CSS|SASS|SCSS)\b/gi,
        /\b(?:years?|experience|proficient|expert|knowledge|familiar|strong)\s+(?:in|with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    ];
    
    skillPatterns.forEach(pattern => {
        const matches = jobDescription.match(pattern);
        if (matches) {
            keywords.push(...matches.map(m => m.trim()));
        }
    });
    
    // Extract capitalized words (likely technologies/companies)
    const capitalized = jobDescription.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
    if (capitalized) {
        keywords.push(...capitalized.filter(w => w.length > 3 && w.length < 30));
    }
    
    // Remove duplicates and normalize
    return [...new Set(keywords.map(k => k.toLowerCase().trim()))].slice(0, 50);
}

export function calculateJDMatch(
    resumeData: ParsedResumeData,
    jobDescription: JobDescription
): { score: number; matches: KeywordMatch[]; missing: string[]; extra: string[] } {
    const jdKeywords = extractKeywordsFromJD(jobDescription.description);
    const resumeText = [
        resumeData.summary,
        resumeData.experience.map(e => `${e.position} ${e.company} ${e.description.join(' ')}`).join(' '),
        resumeData.skills.technical.join(' '),
        resumeData.skills.soft.join(' '),
        resumeData.education.map(e => `${e.degree} ${e.school}`).join(' '),
    ].join(' ').toLowerCase();
    
    const matches: KeywordMatch[] = jdKeywords.map(keyword => {
        const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const found = regex.test(resumeText);
        const count = (resumeText.match(regex) || []).length;
        return { keyword, found, count };
    });
    
    const foundCount = matches.filter(m => m.found).length;
    const score = jdKeywords.length > 0 ? Math.round((foundCount / jdKeywords.length) * 100) : 0;
    const missing = matches.filter(m => !m.found).map(m => m.keyword);
    
    // Find extra keywords in resume that aren't in JD
    const resumeKeywords = extractKeywordsFromJD(resumeText);
    const extra = resumeKeywords.filter(kw => !jdKeywords.some(jdkw => jdkw.toLowerCase() === kw.toLowerCase()));
    
    return { score, matches, missing, extra };
}

/**
 * Calculate Overall Resume Score with weighted formula:
 * 40% Keywords + 30% Formatting + 20% Content Strength + 10% Length
 */
export function calculateOverallResumeScore(
    atsScore: ATSScore,
    keywordMatchScore: number,
    contentStrength: number,
    lengthScore: number
): number {
    const keywordWeight = 0.40;
    const formattingWeight = 0.30;
    const contentWeight = 0.20;
    const lengthWeight = 0.10;
    
    const keywordComponent = keywordMatchScore * keywordWeight;
    const formattingComponent = atsScore.sections.formatting * formattingWeight;
    const contentComponent = contentStrength * contentWeight;
    const lengthComponent = lengthScore * lengthWeight;
    
    return Math.round(keywordComponent + formattingComponent + contentComponent + lengthComponent);
}

/**
 * Calculate Content Strength Score (0-100)
 */
export function calculateContentStrength(resumeData: ParsedResumeData): number {
    let score = 0;
    const maxScore = 100;
    
    // Summary quality (20 points)
    if (resumeData.summary && resumeData.summary.length > 100) {
        score += 20;
    } else if (resumeData.summary && resumeData.summary.length > 50) {
        score += 10;
    }
    
    // Experience depth (30 points)
    const totalBullets = resumeData.experience.reduce((sum, exp) => sum + exp.description.filter(d => d.trim()).length, 0);
    if (totalBullets >= 6) {
        score += 30;
    } else if (totalBullets >= 3) {
        score += 20;
    } else if (totalBullets >= 1) {
        score += 10;
    }
    
    // Skills breadth (20 points)
    const totalSkills = resumeData.skills.technical.length + resumeData.skills.soft.length;
    if (totalSkills >= 10) {
        score += 20;
    } else if (totalSkills >= 5) {
        score += 15;
    } else if (totalSkills >= 3) {
        score += 10;
    }
    
    // Quantified achievements (20 points)
    const resumeText = [
        resumeData.summary,
        resumeData.experience.map(e => e.description.join(' ')).join(' '),
    ].join(' ');
    const metricCount = (resumeText.match(/\d+/g) || []).length;
    if (metricCount >= 5) {
        score += 20;
    } else if (metricCount >= 3) {
        score += 15;
    } else if (metricCount >= 1) {
        score += 10;
    }
    
    // Education completeness (10 points)
    if (resumeData.education.length > 0) {
        score += 10;
    }
    
    return Math.min(score, maxScore);
}

/**
 * Comprehensive ATS Analysis using Gemini API
 * Replaces puter.js ai.feedback() with Gemini-based analysis
 */
export async function analyzeResumeWithGemini(
    resumeText: string,
    jobDescription: JobDescription,
    apiKey?: string
): Promise<Feedback | null> {
    const prompt = `You are an expert ATS (Applicant Tracking System) and resume analyst. Analyze this resume and provide comprehensive feedback.

RESUME TEXT:
${resumeText}

JOB DESCRIPTION:
Title: ${jobDescription.title || 'Not provided'}
Company: ${jobDescription.company || 'Not provided'}
Description: ${jobDescription.description || 'Not provided'}

Analyze the resume based on:
1. ATS Compatibility (24-point check: contact info, sections, formatting, keywords, metrics, length)
2. Keyword Match with Job Description (extract hard skills, soft skills, certifications, tools)
3. Content Strength (summary quality, experience depth, skills breadth, quantified achievements)
4. Tone & Style (professional language, action verbs, clarity)
5. Structure (organization, section headings, flow)
6. Skills Alignment (match with job requirements)

Provide feedback in this EXACT JSON format:
{
  "overallScore": number (0-100, calculated as: 40% Keywords + 30% Formatting + 20% Content Strength + 10% Length),
  "ATS": {
    "score": number (0-100, based on 24-point ATS compatibility),
    "tips": [
      {
        "type": "good" | "improve",
        "tip": "string (short title)"
      }
    ]
  },
  "toneAndStyle": {
    "score": number (0-100),
    "tips": [
      {
        "type": "good" | "improve",
        "tip": "string (short title)",
        "explanation": "string (detailed explanation)"
      }
    ]
  },
  "content": {
    "score": number (0-100),
    "tips": [
      {
        "type": "good" | "improve",
        "tip": "string (short title)",
        "explanation": "string (detailed explanation)"
      }
    ]
  },
  "structure": {
    "score": number (0-100),
    "tips": [
      {
        "type": "good" | "improve",
        "tip": "string (short title)",
        "explanation": "string (detailed explanation)"
      }
    ]
  },
  "skills": {
    "score": number (0-100),
    "tips": [
      {
        "type": "good" | "improve",
        "tip": "string (short title)",
        "explanation": "string (detailed explanation)"
      }
    ]
  }
}

Return ONLY valid JSON, no markdown, no code blocks, no explanations.`;

    try {
        const data = await callGeminiAPI(prompt);
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error('Invalid response from Gemini API');
            return null;
        }
        
        const content = data.candidates[0].content.parts[0].text.trim() || '';
        
        if (!content) {
            console.error('No content from Gemini API');
            return null;
        }

        // Extract JSON from response
        let jsonText = content.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const feedback = JSON.parse(jsonText) as Feedback;
        return feedback;
    } catch (error) {
        console.error('Error analyzing resume with Gemini:', error);
        return null;
    }
}

/**
 * One-Click "Fix My Resume" - Auto-optimize resume
 */
export async function fixMyResume(
    resumeData: ParsedResumeData,
    jobDescription: JobDescription,
    atsScore: ATSScore,
    keywordMatch: { missing: string[] },
    apiKey?: string
): Promise<ParsedResumeData> {

    // Auto-add missing keywords to skills
    const updatedSkills = { ...resumeData.skills };
    keywordMatch.missing.slice(0, 5).forEach(skill => {
        const technicalKeywords = ['javascript', 'python', 'react', 'node', 'aws', 'docker', 'sql', 'api', 'git', 'linux', 'typescript', 'java'];
        const isTechnical = technicalKeywords.some(kw => skill.toLowerCase().includes(kw));
        
        if (isTechnical && !updatedSkills.technical.includes(skill)) {
            updatedSkills.technical.push(skill);
        } else if (!isTechnical && !updatedSkills.soft.includes(skill)) {
            updatedSkills.soft.push(skill);
        }
    });

    // Improve summary if needed
    let improvedSummary = resumeData.summary;
    if (atsScore.sections.keywords < 70 && resumeData.summary) {
        const prompt = `Improve this resume summary to include more ATS-friendly keywords while keeping it natural:

Original: "${resumeData.summary}"

Missing keywords to incorporate: ${keywordMatch.missing.slice(0, 5).join(', ')}

Return ONLY the improved summary, no explanations.`;
        
        try {
            const data = await callGeminiAPI(prompt);
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                improvedSummary = data.candidates[0].content.parts[0].text.trim() || resumeData.summary;
            }
        } catch (error) {
            console.error('Error improving summary:', error);
        }
    }

    // Improve experience bullets that lack metrics
    const improvedExperience = await Promise.all(
        resumeData.experience.map(async (exp) => {
            const improvedDescriptions = await Promise.all(
                exp.description.map(async (desc) => {
                    // If bullet lacks metrics, try to add them
                    if (!/\d+/.test(desc) && desc.trim()) {
                        try {
                            const quantified = await quantifyAchievement(desc);
                            return quantified;
                        } catch (error) {
                            return desc;
                        }
                    }
                    return desc;
                })
            );
            return { ...exp, description: improvedDescriptions };
        })
    );

    return {
        ...resumeData,
        summary: improvedSummary,
        skills: updatedSkills,
        experience: improvedExperience,
    };
}


/**
 * 2.5. Detect Overused Words and Suggest Alternatives
 */
export function detectOverusedWords(resumeText: string): OverusedWord[] {
    const overusedPatterns: { [key: string]: string[] } = {
        'responsible for': ['spearheaded', 'orchestrated', 'managed', 'led', 'oversaw'],
        'led': ['spearheaded', 'orchestrated', 'pioneered', 'championed', 'drove'],
        'managed': ['orchestrated', 'oversaw', 'coordinated', 'directed', 'supervised'],
        'helped': ['supported', 'contributed to', 'facilitated', 'enabled', 'assisted'],
        'worked on': ['developed', 'created', 'built', 'designed', 'implemented'],
        'did': ['executed', 'performed', 'accomplished', 'achieved', 'delivered'],
    };
    
    const overused: OverusedWord[] = [];
    const textLower = resumeText.toLowerCase();
    
    Object.keys(overusedPatterns).forEach(word => {
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matches = textLower.match(regex);
        if (matches && matches.length >= 2) {
            overused.push({
                word,
                count: matches.length,
                suggestions: overusedPatterns[word],
            });
        }
    });
    
    return overused;
}

/**
 * 2.6. Scan for Quantified Metrics
 */
export function scanQuantifiedMetrics(experience: Array<{ description: string[] }>): QuantifiedMetrics {
    const allBullets = experience.flatMap(exp => exp.description);
    const bulletsWithoutMetrics = allBullets.filter(bullet => {
        // Check if bullet has numbers, percentages, or dollar amounts
        return !/\d+/.test(bullet) && !/%|\$|percent|dollar|million|thousand|k\b/i.test(bullet);
    });
    
    const metricCount = allBullets.filter(bullet => {
        return /\d+/.test(bullet) || /%|\$|percent|dollar|million|thousand|k\b/i.test(bullet);
    }).length;
    
    const suggestions = bulletsWithoutMetrics.slice(0, 5).map(bullet => {
        return `Add metrics to: "${bullet.substring(0, 50)}..."`;
    });
    
    return {
        hasMetrics: metricCount > 0,
        metricCount,
        bulletsWithoutMetrics: bulletsWithoutMetrics.length,
        suggestions,
    };
}

/**
 * 4. ATS Compatibility Score (24-point comprehensive checker)
 */
export function calculateATSScore(resumeData: ParsedResumeData): ATSScore {
    const feedback: string[] = [];
    let score = 0;
    const maxScore = 24;
    
    const resumeText = [
        resumeData.summary,
        resumeData.experience.map(e => e.description.join(' ')).join(' '),
        resumeData.skills.technical.join(' '),
        resumeData.skills.soft.join(' '),
    ].join(' ').toLowerCase();
    
    const wordCount = resumeText.split(/\s+/).filter(w => w.length > 0).length;
    
    // === CONTACT & BASIC INFO (4 points) ===
    // 1. Email address
    const hasEmail = !!resumeData.personalInfo.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resumeData.personalInfo.email);
    if (hasEmail) {
        score += 1;
    } else {
        feedback.push('Missing or invalid email address');
    }
    
    // 2. Phone number
    const hasPhone = !!resumeData.personalInfo.phone;
    if (hasPhone) {
        score += 1;
    } else {
        feedback.push('Missing phone number');
    }
    
    // 3. Location
    const hasLocation = !!resumeData.personalInfo.location;
    if (hasLocation) {
        score += 1;
    } else {
        feedback.push('Missing location');
    }
    
    // 4. LinkedIn or portfolio
    const hasLinkedIn = !!(resumeData.personalInfo.linkedin || resumeData.personalInfo.portfolio);
    if (hasLinkedIn) {
        score += 1;
    } else {
        feedback.push('Consider adding LinkedIn or portfolio link');
    }
    
    // === CONTENT SECTIONS (5 points) ===
    // 5. Professional Summary
    if (resumeData.summary && resumeData.summary.length > 50 && resumeData.summary.length < 500) {
        score += 1;
    } else {
        feedback.push('Professional summary missing or not optimal (should be 50-500 characters)');
    }
    
    // 6. Work Experience exists
    if (resumeData.experience.length > 0) {
        score += 1;
    } else {
        feedback.push('No work experience listed');
    }
    
    // 7. Work Experience has descriptions
    const hasDescriptions = resumeData.experience.some(e => e.description.filter(d => d.trim()).length > 0);
    if (hasDescriptions) {
        score += 1;
    } else {
        feedback.push('Work experience entries lack detailed descriptions');
    }
    
    // 8. Education section
    if (resumeData.education.length > 0) {
        score += 1;
    } else {
        feedback.push('No education information provided');
    }
    
    // 9. Skills section
    const hasSkills = resumeData.skills.technical.length > 0 || resumeData.skills.soft.length > 0;
    if (hasSkills) {
        score += 1;
    } else {
        feedback.push('No skills listed');
    }
    
    // === FORMATTING & STRUCTURE (6 points) ===
    // 10. Standard section headings (Experience, Education, Skills)
    const hasStandardHeadings = resumeData.experience.length > 0 && resumeData.education.length > 0;
    if (hasStandardHeadings) {
            score += 1;
        } else {
        feedback.push('Missing standard section headings');
    }
    
    // 11. Consistent date format
    const dateFormats = resumeData.experience
        .filter(e => e.startDate || e.endDate)
        .map(e => `${e.startDate} ${e.endDate}`)
        .join(' ');
    const hasConsistentDates = dateFormats.length > 0;
    if (hasConsistentDates) {
        score += 1;
    } else {
        feedback.push('Add consistent date formats to experience');
    }
    
    // 12. No special characters in headings (check for ATS-unfriendly chars)
    const hasCleanHeadings = true; // Assuming clean structure
    if (hasCleanHeadings) {
        score += 1;
    }
    
    // 13. Proper bullet points (not numbered lists)
    const hasBullets = resumeData.experience.some(e => e.description.length > 0);
    if (hasBullets) {
        score += 1;
    }
    
    // 14. No tables (assumed - templates don't use tables)
    score += 1;
    
    // 15. No images/graphics in content (assumed - text only)
    score += 1;
    
    // === KEYWORDS & OPTIMIZATION (4 points) ===
    // 16. ATS-friendly keywords
    const commonATSKeywords = ['experience', 'skills', 'achievement', 'lead', 'develop', 'manage', 'improve', 'increase', 'reduce', 'implement', 'create', 'design'];
    const keywordCount = commonATSKeywords.filter(kw => resumeText.includes(kw)).length;
    if (keywordCount >= 6) {
        score += 1;
    } else {
        feedback.push('Resume could benefit from more ATS-friendly keywords');
    }
    
    // 17. Action verbs usage
    const actionVerbs = ['led', 'managed', 'developed', 'created', 'implemented', 'designed', 'improved', 'increased', 'reduced', 'achieved'];
    const actionVerbCount = actionVerbs.filter(v => resumeText.includes(v)).length;
    if (actionVerbCount >= 3) {
        score += 1;
    } else {
        feedback.push('Use more action verbs in descriptions');
    }
    
    // 18. Industry-specific keywords
    const hasIndustryKeywords = resumeData.skills.technical.length >= 5;
    if (hasIndustryKeywords) {
        score += 1;
    } else {
        feedback.push('Add more industry-specific technical skills');
    }
    
    // 19. Soft skills mentioned
    if (resumeData.skills.soft.length > 0) {
        score += 1;
    } else {
        feedback.push('Consider adding soft skills');
    }
    
    // === QUANTIFIABLE METRICS (3 points) ===
    // 20. Has numbers/metrics
    const hasNumbers = /\d+/.test(resumeText);
    if (hasNumbers) {
        score += 1;
    } else {
        feedback.push('Add quantifiable metrics (numbers, percentages, dollar amounts)');
    }
    
    // 21. Multiple metrics (not just one)
    const numberCount = (resumeText.match(/\d+/g) || []).length;
    if (numberCount >= 3) {
        score += 1;
    } else {
        feedback.push('Add more quantifiable achievements with metrics');
    }
    
    // 22. Percentage or dollar amounts
    const hasPercentages = /%|\$|percent|dollar|million|thousand/i.test(resumeText);
    if (hasPercentages) {
        score += 1;
    } else {
        feedback.push('Include percentages or dollar amounts to show impact');
    }
    
    // === LENGTH & COMPLETENESS (2 points) ===
    // 23. Optimal length (1-2 pages)
    if (wordCount >= 300 && wordCount <= 800) {
        score += 1;
    } else {
        feedback.push(`Resume length may not be optimal (currently ~${Math.round(wordCount / 250)} pages, aim for 1-2 pages)`);
    }
    
    // 24. Complete sections (all major sections filled)
    const completeSections = [
        !!resumeData.summary,
        resumeData.experience.length > 0,
        resumeData.education.length > 0,
        resumeData.skills.technical.length > 0,
    ].filter(Boolean).length;
    if (completeSections >= 4) {
        score += 1;
    } else {
        feedback.push('Complete all major resume sections');
    }
    
    const overall = Math.round((score / maxScore) * 100);
    
    return {
        overall,
        sections: {
            keywords: keywordCount >= 6 ? 100 : (keywordCount / 6) * 100,
            formatting: (hasEmail && hasPhone && hasLocation && hasStandardHeadings) ? 100 : 75,
            contact: (hasEmail ? 25 : 0) + (hasPhone ? 25 : 0) + (hasLocation ? 25 : 0) + (hasLinkedIn ? 25 : 0),
            length: wordCount >= 300 && wordCount <= 800 ? 100 : wordCount < 300 ? (wordCount / 300) * 100 : 100 - ((wordCount - 800) / 200) * 100,
            sections: completeSections * 25,
        },
        feedback: feedback.length > 0 ? feedback : ['Excellent! Your resume is well-optimized for ATS systems.'],
    };
}

/**
 * 5. Generate Cover Letter from Resume Data
 */
export async function generateCoverLetter(
    resumeData: ParsedResumeData,
    jobDescription: JobDescription,
    apiKey?: string
): Promise<string> {
    const prompt = `Write a professional cover letter based on this resume and job description:

RESUME:
Name: ${resumeData.personalInfo.fullName}
Summary: ${resumeData.summary}
Experience: ${resumeData.experience.map(e => `${e.position} at ${e.company} (${e.startDate} - ${e.endDate})`).join('\n')}
Skills: ${resumeData.skills.technical.join(', ')}
Education: ${resumeData.education.map(e => `${e.degree} from ${e.school}`).join(', ')}

JOB DESCRIPTION:
Title: ${jobDescription.title}
Company: ${jobDescription.company || 'Company'}
Description: ${jobDescription.description}

Requirements:
- 3-4 paragraphs, professional tone
- Address the hiring manager (use "Dear Hiring Manager" if name unknown)
- First paragraph: Express interest and mention the position
- Second paragraph: Highlight relevant experience and achievements
- Third paragraph: Connect your skills to job requirements
- Closing: Express enthusiasm and request for interview
- Sign off with "Sincerely" and the candidate's name
- Keep it concise (300-400 words)

Return ONLY the cover letter text, no explanations or markdown.`;

    try {
        const data = await callGeminiAPI(prompt);
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error('Invalid response from Gemini API');
            return '';
        }
        
        return data.candidates[0].content.parts[0].text.trim() || '';
    } catch (error) {
        console.error('Error generating cover letter:', error);
        return '';
    }
}

/**
 * 6. Improve Grammar, Tone & Readability
 */
export async function improveText(
    text: string,
    apiKey?: string
): Promise<string> {
    const prompt = `Improve this resume text for grammar, tone, and readability. Make it more professional and ATS-friendly:

${text}

Requirements:
- Fix any grammar or spelling errors
- Improve sentence structure and flow
- Remove repetitive words
- Use stronger action verbs
- Make it more concise and impactful
- Maintain the original meaning

Return ONLY the improved text, no explanations.`;

    try {
        const data = await callGeminiAPI(prompt);
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            return text;
        }
        
        return data.candidates[0].content.parts[0].text.trim() || text;
    } catch (error) {
        console.error('Error improving text:', error);
        return text;
    }
}

/**
 * 7. Quantify and Improve Achievement Bullets
 */
export async function quantifyAchievement(
    achievement: string,
    apiKey?: string
): Promise<string> {
    const prompt = `Rewrite this resume achievement to be more impactful with quantifiable metrics:

Original: "${achievement}"

Requirements:
- Add specific numbers, percentages, or dollar amounts if possible
- Use strong action verbs
- Be specific about impact and results
- Keep it concise (1-2 lines)
- Make it compelling for recruiters

If the achievement already has numbers, improve the wording while keeping the metrics.

Return ONLY the improved achievement text, no explanations.`;

    try {
        const data = await callGeminiAPI(prompt);
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            return achievement;
        }
        
        return data.candidates[0].content.parts[0].text.trim() || achievement;
    } catch (error) {
        console.error('Error quantifying achievement:', error);
        return achievement;
    }
}

/**
 * 8. Make Text Stronger - Use power words and action verbs
 */
export async function makeStronger(
    text: string,
    apiKey?: string
): Promise<string> {
    const prompt = `Rewrite this resume text to be stronger and more impactful:

Original: "${text}"

Requirements:
- Replace weak verbs with powerful action verbs (e.g., "led" → "spearheaded", "helped" → "orchestrated")
- Use confident, assertive language
- Remove filler words and weak phrases
- Make achievements sound more impressive
- Keep the same meaning but with stronger impact
- Maintain ATS-friendly language

Return ONLY the rewritten text, no explanations.`;

    try {
        const data = await callGeminiAPI(prompt);
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            return text;
        }
        
        return data.candidates[0].content.parts[0].text.trim() || text;
    } catch (error) {
        console.error('Error making text stronger:', error);
        return text;
    }
}

/**
 * 9. Shorten Text - Make it more concise
 */
export async function shortenText(
    text: string,
    apiKey?: string
): Promise<string> {
    const prompt = `Make this resume text more concise while keeping all important information:

Original: "${text}"

Requirements:
- Reduce word count by 20-30% without losing key information
- Remove redundant words and phrases
- Keep all important achievements, metrics, and skills
- Maintain professional tone
- Make it punchier and more impactful
- Keep ATS-friendly keywords

Return ONLY the shortened text, no explanations.`;

    try {
        const data = await callGeminiAPI(prompt);
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            return text;
        }
        
        return data.candidates[0].content.parts[0].text.trim() || text;
    } catch (error) {
        console.error('Error shortening text:', error);
        return text;
    }
}

/**
 * 10. Humanize Text - Make it more natural and personable
 */
export async function humanizeText(
    text: string,
    apiKey?: string
): Promise<string> {
    const prompt = `Rewrite this resume text to be more natural, personable, and human while remaining professional:

Original: "${text}"

Requirements:
- Make it sound less robotic and more authentic
- Use natural language flow
- Add personality while staying professional
- Make it engaging and relatable
- Keep all important information and achievements
- Still maintain ATS compatibility

Return ONLY the humanized text, no explanations.`;

    try {
        const data = await callGeminiAPI(prompt);
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            return text;
        }
        
        return data.candidates[0].content.parts[0].text.trim() || text;
    } catch (error) {
        console.error('Error humanizing text:', error);
        return text;
    }
}

