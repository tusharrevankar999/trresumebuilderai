/**
 * AI-Powered Resume Builder Features
 * Implements best practices from 2025 resume builder tools
 */

import { parseResumeWithGemini } from './gemini';
import type { ParsedResumeData } from './gemini';

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

/**
 * 1. Generate Professional Summary using AI
 */
export async function generateSummary(
    resumeData: ParsedResumeData,
    apiKey?: string
): Promise<string> {
    const key = apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!key) return '';

    const prompt = `Generate a compelling professional summary (2-3 sentences, max 150 words) for this resume:

Name: ${resumeData.personalInfo.fullName}
Experience: ${resumeData.experience.map(e => `${e.position} at ${e.company}`).join(', ')}
Skills: ${resumeData.skills.technical.slice(0, 10).join(', ')}
Education: ${resumeData.education.map(e => e.degree).join(', ')}

Write a professional summary that:
- Highlights key achievements and experience
- Mentions relevant skills
- Is tailored for ATS systems
- Uses action verbs and quantifiable results
- Is concise and impactful

Return ONLY the summary text, no explanations or markdown.`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            }
        );

        if (!response.ok) return '';
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
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
    const key = apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!key) return currentBullets;

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
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            }
        );

        if (!response.ok) return currentBullets;
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        
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
): { score: number; matches: KeywordMatch[]; missing: string[] } {
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
    
    return { score, matches, missing };
}

/**
 * 4. ATS Compatibility Score (Rule-based 10-point checker)
 */
export function calculateATSScore(resumeData: ParsedResumeData): ATSScore {
    const feedback: string[] = [];
    let score = 0;
    
    // 1. Contact Information (1 point)
    const hasEmail = !!resumeData.personalInfo.email;
    const hasPhone = !!resumeData.personalInfo.phone;
    const hasLocation = !!resumeData.personalInfo.location;
    if (hasEmail && hasPhone && hasLocation) {
        score += 1;
    } else {
        feedback.push('Missing contact information (email, phone, or location)');
    }
    
    // 2. Professional Summary (1 point)
    if (resumeData.summary && resumeData.summary.length > 50 && resumeData.summary.length < 500) {
        score += 1;
    } else {
        feedback.push('Professional summary is missing or not optimal (should be 50-500 characters)');
    }
    
    // 3. Work Experience (2 points)
    if (resumeData.experience.length > 0) {
        score += 1;
        const hasDescriptions = resumeData.experience.some(e => e.description.length > 0);
        if (hasDescriptions) {
            score += 1;
        } else {
            feedback.push('Work experience entries lack detailed descriptions');
        }
    } else {
        feedback.push('No work experience listed');
    }
    
    // 4. Education (1 point)
    if (resumeData.education.length > 0) {
        score += 1;
    } else {
        feedback.push('No education information provided');
    }
    
    // 5. Skills Section (2 points)
    const hasTechnicalSkills = resumeData.skills.technical.length > 0;
    const hasSoftSkills = resumeData.skills.soft.length > 0;
    if (hasTechnicalSkills) {
        score += 1;
        if (hasSoftSkills) {
            score += 1;
        } else {
            feedback.push('Consider adding soft skills');
        }
    } else {
        feedback.push('No technical skills listed');
    }
    
    // 6. Keywords/ATS Optimization (1 point)
    const resumeText = [
        resumeData.summary,
        resumeData.experience.map(e => e.description.join(' ')).join(' '),
        resumeData.skills.technical.join(' '),
    ].join(' ').toLowerCase();
    
    const commonATSKeywords = ['experience', 'skills', 'achievement', 'lead', 'develop', 'manage', 'improve', 'increase', 'reduce'];
    const keywordCount = commonATSKeywords.filter(kw => resumeText.includes(kw)).length;
    if (keywordCount >= 5) {
        score += 1;
    } else {
        feedback.push('Resume could benefit from more ATS-friendly keywords');
    }
    
    // 7. Quantifiable Achievements (1 point)
    const hasNumbers = /\d+/.test(resumeText);
    if (hasNumbers) {
        score += 1;
    } else {
        feedback.push('Add quantifiable metrics (numbers, percentages, dollar amounts) to achievements');
    }
    
    // 8. Resume Length (1 point) - should be 1-2 pages equivalent
    const wordCount = resumeText.split(/\s+/).length;
    if (wordCount >= 300 && wordCount <= 800) {
        score += 1;
    } else {
        feedback.push(`Resume length may not be optimal (currently ~${Math.round(wordCount / 250)} pages)`);
    }
    
    const overall = Math.round((score / 10) * 100);
    
    return {
        overall,
        sections: {
            keywords: keywordCount >= 5 ? 100 : (keywordCount / 5) * 100,
            formatting: hasEmail && hasPhone && hasLocation ? 100 : 50,
            contact: (hasEmail ? 33 : 0) + (hasPhone ? 33 : 0) + (hasLocation ? 34 : 0),
            length: wordCount >= 300 && wordCount <= 800 ? 100 : wordCount < 300 ? (wordCount / 300) * 100 : 100 - ((wordCount - 800) / 200) * 100,
            sections: [
                !!resumeData.summary,
                resumeData.experience.length > 0,
                resumeData.education.length > 0,
                resumeData.skills.technical.length > 0,
            ].filter(Boolean).length * 25,
        },
        feedback: feedback.length > 0 ? feedback : ['Resume looks great! All key sections are present.'],
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
    const key = apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!key) return '';

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
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            }
        );

        if (!response.ok) return '';
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
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
    const key = apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!key) return text;

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
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            }
        );

        if (!response.ok) return text;
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
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
    const key = apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!key) return achievement;

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
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            }
        );

        if (!response.ok) return achievement;
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || achievement;
    } catch (error) {
        console.error('Error quantifying achievement:', error);
        return achievement;
    }
}

