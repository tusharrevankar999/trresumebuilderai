import {Link, useNavigate} from "react-router";
import {useState, useEffect, useRef} from "react";
import FileUploader from "~/components/FileUploader";
import {convertPdfToImage, extractTextFromPdf} from "~/lib/pdf2img";
import {parseResumeWithGemini} from "~/lib/gemini";
import AIFeatures from "~/components/AIFeatures";
import {generateSummary, generateBulletPoints, improveText, quantifyAchievement} from "~/lib/ai-features";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export const meta = () => ([
    { title: 'Resumind | Resume Builder' },
    { name: 'description', content: 'Build professional resumes with AI assistance' },
])

interface ResumeData {
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

const Builder = () => {
    const navigate = useNavigate();
    const resumePreviewRef = useRef<HTMLDivElement>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [resumeImageUrl, setResumeImageUrl] = useState<string>('');
    const [resumePdfUrl, setResumePdfUrl] = useState<string>('');
    const [isConvertingPdf, setIsConvertingPdf] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [professionalResumeImageUrl, setProfessionalResumeImageUrl] = useState<string>('');
    const [selectedTemplate, setSelectedTemplate] = useState<string>('modern-professional');
    const [activeSection, setActiveSection] = useState<string>('personal');
    const [isExporting, setIsExporting] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    const [resumeData, setResumeData] = useState<ResumeData>({
        personalInfo: {
            fullName: '',
            email: '',
            phone: '',
            location: '',
            linkedin: '',
            portfolio: ''
        },
        summary: '',
        experience: [{
            company: '',
            position: '',
            startDate: '',
            endDate: '',
            location: '',
            current: false,
            description: ['']
        }],
        education: [{
            degree: '',
            school: '',
            gpa: '',
            graduationDate: ''
        }],
        skills: {
            technical: [''],
            soft: ['']
        },
        projects: [{
            name: '',
            description: ''
        }],
        certifications: [{
            name: ''
        }],
        achievements: [{
            name: ''
        }]
    });

    // ---- Demo/Sample content for "Modern Professional" template ----
    const getModernProfessionalSample = (): ResumeData => ({
        personalInfo: {
            fullName: 'John Smith',
            email: 'john.smith@email.com',
            phone: '+1 (555) 123-4567',
            location: 'San Francisco, CA',
            linkedin: 'linkedin.com/in/johnsmith',
            portfolio: 'github.com/johnsmith'
        },
        summary:
            'Results‑driven Software Engineer with 5+ years of experience building scalable web applications. Specialized in React, Node.js, and cloud technologies with a proven track record of delivering high‑impact projects.',
        experience: [
            {
                company: 'Tech Corp',
                position: 'Senior Software Engineer',
                startDate: 'Jan 2021',
                endDate: 'Present',
                location: 'San Francisco, CA',
                current: true,
                description: [
                    'Led development of microservices architecture serving 10M+ users, improving system reliability by 40%.',
                    'Reduced deployment time by 60% through implementation of CI/CD pipelines.',
                    'Mentored a team of 5 junior engineers, improving code quality and review practices.'
                ]
            }
        ],
        education: [
            {
                degree: 'Bachelor of Science',
                school: 'University of California',
                gpa: '3.8/4.0',
                graduationDate: 'May 2019',
                // optional fields kept default/empty
            }
        ],
        skills: {
            technical: [
                'JavaScript',
                'TypeScript',
                'React',
                'Node.js',
                'Python',
                'AWS',
                'Docker',
                'PostgreSQL'
            ],
            soft: ['Leadership', 'Problem Solving', 'Communication']
        },
        projects: [
            {
                name: 'E‑commerce Platform',
                description:
                    'Built full‑stack platform processing $1M+ in monthly transactions. Integrated payments, search, and analytics. Tech: React, Node.js, MongoDB, Stripe.'
            }
        ],
        certifications: [{ name: 'AWS Certified Solutions Architect' }],
        achievements: [
            { name: 'Hackathon Winner 2022' },
            { name: 'Employee of the Quarter Q3 2023' }
        ]
    });

    // Parse extracted text and populate form fields
    const parseResumeText = (text: string) => {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        // Extract email
        const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
        const email = emailMatch ? emailMatch[0] : '';

        // Extract phone (various formats)
        const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{10}/);
        const phone = phoneMatch ? phoneMatch[0] : '';

        // Extract LinkedIn URL
        const linkedinMatch = text.match(/(linkedin\.com\/in\/[\w-]+|linkedin\.com\/pub\/[\w-]+)/i);
        const linkedin = linkedinMatch ? linkedinMatch[0] : '';

        // Extract GitHub URL
        const githubMatch = text.match(/(github\.com\/[\w-]+)/i);
        
        // Extract portfolio/website (excluding LinkedIn and GitHub)
        const portfolioMatch = text.match(/(www\.|https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-]*)?/i);
        let portfolio = '';
        if (portfolioMatch && !linkedinMatch && !githubMatch) {
            portfolio = portfolioMatch[0];
        } else if (githubMatch) {
            portfolio = githubMatch[0];
        }

        // Extract name (usually first line or before email)
        let fullName = '';
        if (lines.length > 0) {
            const firstLine = lines[0];
            // If first line doesn't contain email/phone, it's likely the name
            if (!firstLine.includes('@') && !firstLine.match(/\d{3}/) && firstLine.length < 50) {
                fullName = firstLine;
            } else {
                // Look for name pattern (2-4 words, capitalized)
                const namePattern = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/;
                for (const line of lines.slice(0, 5)) {
                    if (namePattern.test(line) && !line.includes('@') && !line.match(/\d/)) {
                        fullName = line;
                        break;
                    }
                }
            }
        }

        // Extract location (common patterns)
        const locationMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})|([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z][a-z]+)/);
        const location = locationMatch ? locationMatch[0] : '';

        // Extract summary (text after name/contact, before experience/education)
        let summary = '';
        const summaryKeywords = ['summary', 'objective', 'profile', 'about'];
        const experienceKeywords = ['experience', 'employment', 'work history', 'professional experience'];
        const educationKeywords = ['education', 'academic', 'university', 'degree'];
        
        let summaryStart = -1;
        let summaryEnd = text.length;
        
        for (let i = 0; i < lines.length; i++) {
            const lowerLine = lines[i].toLowerCase();
            if (summaryKeywords.some(kw => lowerLine.includes(kw)) && summaryStart === -1) {
                summaryStart = i + 1;
            }
            if (experienceKeywords.some(kw => lowerLine.includes(kw)) || 
                educationKeywords.some(kw => lowerLine.includes(kw))) {
                if (summaryStart !== -1 && summaryEnd === text.length) {
                    summaryEnd = i;
                }
            }
        }
        
        if (summaryStart !== -1) {
            summary = lines.slice(summaryStart, summaryEnd).join(' ').substring(0, 500);
        }

        // Extract experience
        const experience: Array<{
            company: string;
            position: string;
            startDate: string;
            endDate: string;
            location?: string;
            current: boolean;
            description: string[];
        }> = [];
        
        const expSectionMatch = text.match(/(experience|employment|work history|professional experience)[\s\S]*?(?=(education|skills|projects|$))/i);
        if (expSectionMatch) {
            const expText = expSectionMatch[0];
            // Simple extraction - look for company names and positions
            const expEntries = expText.split(/\n(?=[A-Z])/).slice(1); // Skip header
            expEntries.slice(0, 5).forEach(entry => {
                const entryLines = entry.split('\n').filter(l => l.trim());
                if (entryLines.length >= 2) {
                    const position = entryLines[0].trim();
                    const companyLine = entryLines[1].trim();
                    const dateMatch = entry.match(/(\w+\s+\d{4})\s*[-–]\s*(\w+\s+\d{4}|present|current)/i);
                    experience.push({
                        company: companyLine.split('•')[0].trim(),
                        position: position,
                        startDate: dateMatch ? dateMatch[1] : '',
                        endDate: dateMatch ? (dateMatch[2].toLowerCase().includes('present') || dateMatch[2].toLowerCase().includes('current') ? 'Present' : dateMatch[2]) : '',
                        current: dateMatch ? (dateMatch[2].toLowerCase().includes('present') || dateMatch[2].toLowerCase().includes('current')) : false,
                        description: entryLines.slice(2).filter(l => l.trim().startsWith('•') || l.trim().startsWith('-')).map(l => l.replace(/^[•\-]\s*/, '').trim()).filter(l => l.length > 0)
                    });
                }
            });
        }

        // Extract education
        const education: Array<{
            degree: string;
            school: string;
            gpa: string;
            graduationDate: string;
        }> = [];
        
        const eduSectionMatch = text.match(/(education|academic background)[\s\S]*?(?=(experience|skills|projects|$))/i);
        if (eduSectionMatch) {
            const eduText = eduSectionMatch[0];
            const eduEntries = eduText.split(/\n(?=[A-Z])/).slice(1);
            eduEntries.slice(0, 3).forEach(entry => {
                const entryLines = entry.split('\n').filter(l => l.trim());
                if (entryLines.length >= 1) {
                    const degreeMatch = entry.match(/(bachelor|master|phd|doctorate|associate|degree)[\s\S]*?in[\s\S]*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
                    const gpaMatch = entry.match(/gpa[:\s]*([\d.]+)/i);
                    const dateMatch = entry.match(/(\w+\s+\d{4}|\d{4})/);
                    education.push({
                        degree: degreeMatch ? degreeMatch[0].substring(0, 100) : entryLines[0],
                        school: entryLines.find(l => l.includes('university') || l.includes('college') || l.includes('institute')) || entryLines[1] || '',
                        gpa: gpaMatch ? gpaMatch[1] : '',
                        graduationDate: dateMatch ? dateMatch[1] : ''
                    });
                }
            });
        }

        // Extract skills
        const skillsSectionMatch = text.match(/(technical\s+skills?|skills?|competencies)[\s\S]*?(?=(experience|education|projects|$))/i);
        const technical: string[] = [];
        const soft: string[] = [];
        
        if (skillsSectionMatch) {
            const skillsText = skillsSectionMatch[0];
            // Common technical skills keywords
            const techKeywords = ['javascript', 'python', 'java', 'react', 'node', 'sql', 'html', 'css', 'typescript', 'angular', 'vue', 'aws', 'docker', 'kubernetes', 'git', 'mongodb', 'postgresql', 'linux', 'api', 'rest', 'graphql'];
            const softKeywords = ['leadership', 'communication', 'teamwork', 'problem solving', 'analytical', 'creative', 'time management', 'collaboration'];
            
            const skillWords = skillsText.toLowerCase().split(/[,;•\n]/).map(s => s.trim()).filter(s => s.length > 0);
            skillWords.forEach(skill => {
                if (techKeywords.some(kw => skill.includes(kw))) {
                    technical.push(skill);
                } else if (softKeywords.some(kw => skill.includes(kw))) {
                    soft.push(skill);
                } else if (skill.length > 2 && skill.length < 30) {
                    technical.push(skill);
                }
            });
        }

        // Update resume data
        setResumeData(prev => ({
            ...prev,
            personalInfo: {
                fullName: fullName || prev.personalInfo.fullName,
                email: email || prev.personalInfo.email,
                phone: phone || prev.personalInfo.phone,
                location: location || prev.personalInfo.location,
                linkedin: linkedin || prev.personalInfo.linkedin,
                portfolio: portfolio || prev.personalInfo.portfolio
            },
            summary: summary || prev.summary,
            experience: experience.length > 0 ? experience : prev.experience,
            education: education.length > 0 ? education : prev.education,
            skills: {
                technical: technical.length > 0 ? technical : prev.skills.technical,
                soft: soft.length > 0 ? soft : prev.skills.soft
            }
        }));
    };

    // Convert PDF to image and extract text when file is uploaded
    useEffect(() => {
        const convertPdf = async () => {
            if (uploadedFile) {
                setIsConvertingPdf(true);
                try {
                    // Create PDF URL for download
                    const pdfBlob = new Blob([uploadedFile], { type: 'application/pdf' });
                    const pdfUrl = URL.createObjectURL(pdfBlob);
                    setResumePdfUrl(pdfUrl);

                    // Convert to image for display
                    const result = await convertPdfToImage(uploadedFile);
                    if (result.imageUrl) {
                        setResumeImageUrl(result.imageUrl);
                    }

                    // Extract text and populate form using Gemini AI
                    setIsParsing(true);
                    const extractedText = await extractTextFromPdf(uploadedFile);
                    if (extractedText) {
                        // Try Gemini AI first for better accuracy
                        const geminiParsed = await parseResumeWithGemini(extractedText);
                        if (geminiParsed) {
                            // Use Gemini parsed data
                            setResumeData(prev => ({
                                ...prev,
                                personalInfo: {
                                    fullName: geminiParsed.personalInfo.fullName || prev.personalInfo.fullName,
                                    email: geminiParsed.personalInfo.email || prev.personalInfo.email,
                                    phone: geminiParsed.personalInfo.phone || prev.personalInfo.phone,
                                    location: geminiParsed.personalInfo.location || prev.personalInfo.location,
                                    linkedin: geminiParsed.personalInfo.linkedin || prev.personalInfo.linkedin,
                                    portfolio: geminiParsed.personalInfo.portfolio || prev.personalInfo.portfolio
                                },
                                summary: geminiParsed.summary || prev.summary,
                                experience: geminiParsed.experience.length > 0 ? geminiParsed.experience : prev.experience,
                                education: geminiParsed.education.length > 0 ? geminiParsed.education : prev.education,
                                skills: {
                                    technical: geminiParsed.skills.technical.length > 0 ? geminiParsed.skills.technical : prev.skills.technical,
                                    soft: geminiParsed.skills.soft.length > 0 ? geminiParsed.skills.soft : prev.skills.soft
                                },
                                projects: geminiParsed.projects.length > 0 ? geminiParsed.projects : prev.projects,
                                certifications: geminiParsed.certifications.length > 0 ? geminiParsed.certifications : prev.certifications,
                                achievements: geminiParsed.achievements.length > 0 ? geminiParsed.achievements : prev.achievements
                            }));
                        } else {
                            // Fallback to regex parsing if Gemini fails
                        parseResumeText(extractedText);
                    }
                    }
                    setIsParsing(false);
                } catch (error) {
                    console.error('Error processing PDF:', error);
                } finally {
                    setIsConvertingPdf(false);
                }
            } else {
                setResumeImageUrl('');
                setResumePdfUrl('');
            }
        };

        convertPdf();
    }, [uploadedFile]);

    // When user selects "Modern Professional" and form is empty (no user/parsed data and no upload),
    // prefill with a polished sample so the preview looks like the shared screenshot.
    useEffect(() => {
        if (
            selectedTemplate === 'modern-professional' &&
            !hasFormData() &&
            !uploadedFile &&
            !isConvertingPdf
        ) {
            setResumeData(prev => {
                // Only prefill if still empty at the moment of applying
                const empty =
                    !prev.personalInfo?.fullName &&
                    !prev.summary &&
                    !(prev.experience && prev.experience[0] && prev.experience[0].company);
                return empty ? getModernProfessionalSample() : prev;
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTemplate, isConvertingPdf, uploadedFile]);

    // Load and convert Professional CV Resume.pdf to image on mount
    useEffect(() => {
        const loadProfessionalResume = async () => {
            try {
                const response = await fetch('/images/Professional CV Resume.pdf');
                const blob = await response.blob();
                const file = new File([blob], 'Professional CV Resume.pdf', { type: 'application/pdf' });
                const result = await convertPdfToImage(file);
                if (result.imageUrl) {
                    setProfessionalResumeImageUrl(result.imageUrl);
                }
            } catch (error) {
                console.error('Error loading professional resume:', error);
            }
        };
        loadProfessionalResume();
    }, []);

    const updatePersonalInfo = (field: string, value: string) => {
        setResumeData(prev => ({
            ...prev,
            personalInfo: { ...prev.personalInfo, [field]: value }
        }));
    };

    const updateSummary = (value: string) => {
        setResumeData(prev => ({ ...prev, summary: value }));
    };

    const addExperience = () => {
        setResumeData(prev => ({
            ...prev,
            experience: [...prev.experience, {
                company: '',
                position: '',
                startDate: '',
                endDate: '',
                location: '',
                current: false,
                description: ['']
            }]
        }));
    };

    const updateExperience = (index: number, field: string, value: any) => {
        setResumeData(prev => ({
            ...prev,
            experience: prev.experience.map((exp, i) => 
                i === index ? { ...exp, [field]: value } : exp
            )
        }));
    };

    const addExperienceDescription = (expIndex: number) => {
        setResumeData(prev => ({
            ...prev,
            experience: prev.experience.map((exp, i) => 
                i === expIndex ? { ...exp, description: [...exp.description, ''] } : exp
            )
        }));
    };

    const updateExperienceDescription = (expIndex: number, descIndex: number, value: string) => {
        setResumeData(prev => ({
            ...prev,
            experience: prev.experience.map((exp, i) => 
                i === expIndex ? {
                    ...exp,
                    description: exp.description.map((desc, j) => j === descIndex ? value : desc)
                } : exp
            )
        }));
    };

    const addEducation = () => {
        setResumeData(prev => ({
            ...prev,
            education: [...prev.education, {
                degree: '',
                school: '',
                gpa: '',
                graduationDate: ''
            }]
        }));
    };

    const updateEducation = (index: number, field: string, value: string) => {
        setResumeData(prev => ({
            ...prev,
            education: prev.education.map((edu, i) => 
                i === index ? { ...edu, [field]: value } : edu
            )
        }));
    };

    const addSkill = (type: 'technical' | 'soft') => {
        setResumeData(prev => ({
            ...prev,
            skills: {
                ...prev.skills,
                [type]: [...prev.skills[type], '']
            }
        }));
    };

    const updateSkill = (type: 'technical' | 'soft', index: number, value: string) => {
        setResumeData(prev => ({
            ...prev,
            skills: {
                ...prev.skills,
                [type]: prev.skills[type].map((skill, i) => i === index ? value : skill)
            }
        }));
    };

    const removeSkill = (type: 'technical' | 'soft', index: number) => {
        setResumeData(prev => ({
            ...prev,
            skills: {
                ...prev.skills,
                [type]: prev.skills[type].filter((_, i) => i !== index)
            }
        }));
    };

    const addCertification = () => {
        setResumeData(prev => ({
            ...prev,
            certifications: [...prev.certifications, { name: '' }]
        }));
    };

    const updateCertification = (index: number, value: string) => {
        setResumeData(prev => ({
            ...prev,
            certifications: prev.certifications.map((cert, i) => 
                i === index ? { ...cert, name: value } : cert
            )
        }));
    };

    const removeCertification = (index: number) => {
        setResumeData(prev => ({
            ...prev,
            certifications: prev.certifications.filter((_, i) => i !== index)
        }));
    };

    const addAchievement = () => {
        setResumeData(prev => ({
            ...prev,
            achievements: [...prev.achievements, { name: '' }]
        }));
    };

    const updateAchievement = (index: number, value: string) => {
        setResumeData(prev => ({
            ...prev,
            achievements: prev.achievements.map((ach, i) => 
                i === index ? { ...ach, name: value } : ach
            )
        }));
    };

    const removeAchievement = (index: number) => {
        setResumeData(prev => ({
            ...prev,
            achievements: prev.achievements.filter((_, i) => i !== index)
        }));
    };

    const addProject = () => {
        setResumeData(prev => ({
            ...prev,
            projects: [...prev.projects, { name: '', description: '' }]
        }));
    };

    const updateProject = (index: number, field: string, value: string) => {
        setResumeData(prev => ({
            ...prev,
            projects: prev.projects.map((proj, i) => 
                i === index ? { ...proj, [field]: value } : proj
            )
        }));
    };

    const templates = [
        {
            id: 'modern-professional',
            name: 'Modern Professional',
            description: 'Clean and ATS-friendly',
            previewBg: 'bg-white'
        },
        {
            id: 'tech-company',
            name: 'Tech Company Style',
            description: 'Colorful accents (Google/Meta)',
            previewBg: 'bg-gradient-to-r from-blue-100 to-yellow-100'
        },
        {
            id: 'corporate-professional',
            name: 'Corporate Professional',
            description: 'Professional blue theme (Microsoft)',
            previewBg: 'bg-gradient-to-b from-blue-200 to-blue-100'
        },
        {
            id: 'creative-modern',
            name: 'Creative Modern',
            description: 'Stand out design',
            previewBg: 'bg-gradient-to-b from-purple-200 to-purple-100'
        }
    ];

    const sections = [
        { id: 'personal', label: 'Personal Information' },
        { id: 'summary', label: 'Summary' },
        { id: 'experience', label: 'Experience' },
        { id: 'education', label: 'Education' },
        { id: 'skills', label: 'Skills' },
        { id: 'projects', label: 'Projects' },
        { id: 'certifications', label: 'Certifications' },
        { id: 'achievements', label: 'Achievements' },
        { id: 'ai-tools', label: '✨ AI Tools' },
    ];

    const getTemplateStyles = () => {
        switch (selectedTemplate) {
            case 'tech-company':
                return {
                    headerBorder: 'border-b-2 border-blue-400',
                    headerText: 'text-blue-600',
                    sectionHeader: 'text-blue-600',
                    sectionBorder: 'border-blue-600',
                    accent: 'bg-blue-50'
                };
            case 'corporate-professional':
                return {
                    headerBorder: 'border-b-2 border-blue-600',
                    headerText: 'text-blue-700',
                    sectionHeader: 'text-blue-700',
                    sectionBorder: 'border-blue-700',
                    accent: 'bg-blue-50'
                };
            case 'creative-modern':
                return {
                    headerBorder: 'border-b-2 border-purple-400',
                    headerText: 'text-purple-600',
                    sectionHeader: 'text-purple-600',
                    sectionBorder: 'border-purple-600',
                    accent: 'bg-purple-50'
                };
            default: // modern-professional
                return {
                    headerBorder: 'border-b border-gray-300',
                    headerText: 'text-gray-900',
                    sectionHeader: 'text-gray-900',
                    sectionBorder: 'border-gray-900',
                    accent: 'bg-gray-50'
                };
        }
    };

    const templateStyles = getTemplateStyles();

    // Check if user has entered any form data
    const hasFormData = () => {
        return !!(
            resumeData.personalInfo.fullName ||
            resumeData.personalInfo.email ||
            resumeData.personalInfo.phone ||
            resumeData.personalInfo.location ||
            resumeData.personalInfo.linkedin ||
            resumeData.personalInfo.portfolio ||
            resumeData.summary ||
            (resumeData.experience.length > 0 && (resumeData.experience[0].company || resumeData.experience[0].position)) ||
            (resumeData.education.length > 0 && (resumeData.education[0].degree || resumeData.education[0].school)) ||
            (resumeData.skills.technical.length > 0 && resumeData.skills.technical[0]) ||
            (resumeData.skills.soft.length > 0 && resumeData.skills.soft[0]) ||
            (resumeData.projects.length > 0 && resumeData.projects[0].name) ||
            (resumeData.certifications.length > 0 && resumeData.certifications[0].name) ||
            (resumeData.achievements.length > 0 && resumeData.achievements[0].name)
        );
    };

    // Helper function to capture resume as canvas
    const captureResumeAsCanvas = async (): Promise<HTMLCanvasElement> => {
        if (!resumePreviewRef.current) {
            throw new Error('Resume preview not available');
        }

        const element = resumePreviewRef.current;
        
        // Scroll element into view to ensure it's fully rendered
        element.scrollIntoView({ behavior: 'instant', block: 'start' });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Clone the element and remove SVG elements before html2canvas processes it
        const clone = element.cloneNode(true) as HTMLElement;
        const svgs = clone.querySelectorAll('svg');
        svgs.forEach(svg => {
            const parent = svg.parentElement;
            if (parent) {
                // Determine icon type from parent context
                const parentText = parent.textContent || '';
                const iconText = parentText.includes('@') ? '✉' :
                               parentText.includes('+') || parentText.match(/\d/) ? '📞' :
                               parentText.includes('linkedin') ? 'in' :
                               parentText.includes('github') || parentText.includes('portfolio') ? '🔗' :
                               '📍';
                
                // Replace SVG with simple span
                const span = document.createElement('span');
                span.textContent = iconText;
                span.style.display = 'inline-block';
                span.style.marginRight = '4px';
                span.style.width = '16px';
                span.style.height = '16px';
                span.style.textAlign = 'center';
                span.style.fontSize = '14px';
                span.style.color = 'rgb(0, 0, 0)';
                parent.replaceChild(span, svg);
            }
        });
        
        // Temporarily append clone to body (off-screen) for html2canvas
        clone.style.position = 'absolute';
        clone.style.left = '-9999px';
        clone.style.top = '0';
        clone.style.width = element.offsetWidth + 'px';
        clone.style.maxWidth = element.offsetWidth + 'px';
        clone.style.overflow = 'visible';
        document.body.appendChild(clone);
        
        // Wait a moment for styles to apply
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Capture the cloned element with comprehensive options
        const canvas = await html2canvas(clone, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: element.scrollWidth,
            height: element.scrollHeight,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
            scrollX: 0,
            scrollY: 0,
            allowTaint: false,
            removeContainer: false,
            imageTimeout: 15000,
            onclone: (clonedDoc, clonedElement) => {
                // Remove all stylesheets from cloned document to avoid oklch parsing
                const styleSheets = Array.from(clonedDoc.styleSheets);
                styleSheets.forEach((sheet) => {
                    try {
                        if (sheet.ownerNode) {
                            sheet.ownerNode.remove();
                        }
                    } catch (e) {
                        // Some stylesheets may not be removable
                    }
                });
                
                // Remove all style and link tags
                const styleTags = Array.from(clonedDoc.querySelectorAll('style, link[rel="stylesheet"]'));
                styleTags.forEach(tag => tag.remove());
                
                // Inject comprehensive safe stylesheet with rgb colors only
                const safeStyle = clonedDoc.createElement('style');
                safeStyle.textContent = `
                    * {
                        box-sizing: border-box;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: "Mona Sans", ui-sans-serif, system-ui, sans-serif;
                        background: white;
                        color: rgb(0, 0, 0);
                    }
                    .gradient-border {
                        background: linear-gradient(to bottom, rgba(193, 211, 248, 0.1), rgba(167, 191, 241, 0.3)) !important;
                        padding: 2.5rem !important;
                        border-radius: 1rem !important;
                    }
                    .text-gradient {
                        color: rgb(0, 0, 0) !important;
                        background: none !important;
                    }
                    h1 {
                        font-size: 1.875rem;
                        font-weight: 700;
                        line-height: 1.2;
                        margin: 0;
                        color: rgb(17, 24, 39);
                    }
                    h2 {
                        font-size: 0.75rem;
                        font-weight: 700;
                        text-transform: uppercase;
                        margin: 0;
                        margin-top: 1.25rem;
                        margin-bottom: 0.75rem;
                        color: rgb(17, 24, 39);
                        border-bottom: 1px solid rgb(17, 24, 39);
                        padding-bottom: 0.25rem;
                        line-height: 1.5;
                        display: block;
                    }
                    h3 {
                        font-size: 0.875rem;
                        font-weight: 600;
                        margin: 0;
                        color: rgb(17, 24, 39);
                    }
                    p {
                        margin: 0;
                        color: rgb(55, 65, 81);
                        font-size: 0.875rem;
                        line-height: 1.5;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                    }
                    span {
                        color: inherit;
                        font-size: inherit;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                    }
                    div {
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                    }
                    ul, ol {
                        margin: 0;
                        padding-left: 1.5rem;
                    }
                    li {
                        margin: 0.125rem 0;
                        color: rgb(55, 65, 81);
                        font-size: 0.875rem;
                        line-height: 1.5;
                    }
                    .flex {
                        display: flex;
                    }
                    .flex-wrap {
                        flex-wrap: wrap;
                    }
                    .items-center {
                        align-items: center;
                    }
                    .gap-2 {
                        gap: 0.5rem;
                    }
                    .gap-3 {
                        gap: 0.75rem;
                    }
                    .space-y-3 > * + * {
                        margin-top: 0.75rem;
                    }
                    .space-y-4 > * + * {
                        margin-top: 1rem;
                    }
                    .space-y-5 > * + * {
                        margin-top: 1.25rem;
                    }
                    .mb-1 {
                        margin-bottom: 0.25rem;
                    }
                    .mb-2 {
                        margin-bottom: 0.5rem;
                    }
                    .mb-3 {
                        margin-bottom: 0.75rem;
                    }
                    .mt-2 {
                        margin-top: 0.5rem;
                    }
                    .mt-3 {
                        margin-top: 0.75rem;
                    }
                    .pb-3 {
                        padding-bottom: 0.75rem;
                    }
                    .px-3 {
                        padding-left: 0.75rem;
                        padding-right: 0.75rem;
                    }
                    .py-1 {
                        padding-top: 0.25rem;
                        padding-bottom: 0.25rem;
                    }
                    .bg-gray-100 {
                        background-color: rgb(243, 244, 246);
                    }
                    .rounded {
                        border-radius: 0.25rem;
                    }
                    .text-sm {
                        font-size: 0.875rem;
                    }
                    .text-gray-700 {
                        color: rgb(55, 65, 81);
                    }
                    .text-gray-900 {
                        color: rgb(17, 24, 39);
                    }
                    .text-gray-600 {
                        color: rgb(75, 85, 99);
                    }
                    .font-bold {
                        font-weight: 700;
                    }
                    .font-semibold {
                        font-weight: 600;
                    }
                    .font-medium {
                        font-weight: 500;
                    }
                    .justify-between {
                        justify-content: space-between;
                    }
                    .text-right {
                        text-align: right;
                    }
                    .leading-relaxed {
                        line-height: 1.625;
                    }
                `;
                clonedDoc.head.appendChild(safeStyle);
                
                // Copy ALL computed styles as inline styles for all elements to preserve exact appearance
                const allElements = clonedDoc.querySelectorAll('*');
                const originalElements = clone.querySelectorAll('*');
                
                allElements.forEach((clonedEl, index) => {
                    if (index < originalElements.length) {
                        const originalEl = originalElements[index] as HTMLElement;
                        const htmlEl = clonedEl as HTMLElement;
                        
                        try {
                            const computed = window.getComputedStyle(originalEl);
                            
                            // Copy comprehensive list of all CSS properties
                            const allProps = [
                                // Typography
                                'color', 'fontSize', 'fontWeight', 'fontFamily', 'fontStyle', 
                                'textDecoration', 'textTransform', 'letterSpacing', 'lineHeight',
                                'textAlign', 'whiteSpace', 'wordWrap', 'textOverflow',
                                // Spacing
                                'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
                                'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
                                // Layout
                                'display', 'position', 'top', 'right', 'bottom', 'left',
                                'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
                                'flex', 'flexDirection', 'flexWrap', 'flexGrow', 'flexShrink', 'flexBasis',
                                'justifyContent', 'alignItems', 'alignSelf', 'alignContent',
                                'gap', 'rowGap', 'columnGap',
                                'grid', 'gridTemplateColumns', 'gridTemplateRows', 'gridColumn', 'gridRow',
                                // Borders & Background
                                'border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
                                'borderWidth', 'borderStyle', 'borderColor', 'borderRadius',
                                'backgroundColor', 'background', 'backgroundImage', 'backgroundSize',
                                'backgroundPosition', 'backgroundRepeat',
                                // Visual
                                'opacity', 'visibility', 'overflow', 'overflowX', 'overflowY',
                                'boxShadow', 'textShadow', 'transform', 'transformOrigin',
                                // Text overflow
                                'wordWrap', 'overflowWrap', 'wordBreak', 'textOverflow',
                                // Other
                                'zIndex', 'cursor', 'listStyle', 'listStyleType', 'listStylePosition'
                            ];
                            
                            allProps.forEach(prop => {
                                try {
                                    let value = computed.getPropertyValue(prop);
                                    
                                    // Replace any oklch values with rgb equivalents
                                    if (value && value.includes('oklch')) {
                                        if (prop === 'color') {
                                            // Try to preserve color intent - use gray for text
                                            value = 'rgb(55, 65, 81)';
                                        } else if (prop === 'backgroundColor') {
                                            value = 'transparent';
                                        } else if (prop === 'borderColor') {
                                            value = 'rgb(229, 231, 235)';
                                        } else {
                                            value = '';
                                        }
                                    }
                                    
                                    // Ensure text doesn't get cut off
                                    if (prop === 'overflow' && (value === 'hidden' || value === 'clip')) {
                                        value = 'visible';
                                    }
                                    if (prop === 'overflowX' && (value === 'hidden' || value === 'clip')) {
                                        value = 'visible';
                                    }
                                    if (prop === 'overflowY' && (value === 'hidden' || value === 'clip')) {
                                        value = 'visible';
                                    }
                                    
                                    // Ensure word wrapping for text elements
                                    if (['p', 'span', 'div', 'li'].includes(htmlEl.tagName.toLowerCase()) && 
                                        !value && (prop === 'wordWrap' || prop === 'overflowWrap')) {
                                        value = 'break-word';
                                    }
                                    
                                    // Only set non-empty, non-default values
                                    if (value && value.trim() !== '' && value !== 'none' && value !== 'normal') {
                                        htmlEl.style.setProperty(prop, value);
                                    }
                                } catch (e) {
                                    // Ignore individual property errors
                                }
                            });
                            
                            // Ensure elements with text have proper width constraints
                            if (['p', 'span', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(htmlEl.tagName.toLowerCase())) {
                                const computedWidth = computed.getPropertyValue('width');
                                if (!computedWidth || computedWidth === 'auto' || computedWidth === '0px') {
                                    htmlEl.style.maxWidth = '100%';
                                }
                                htmlEl.style.wordWrap = 'break-word';
                                htmlEl.style.overflowWrap = 'break-word';
                            }
                        } catch (e) {
                            // Ignore errors for this element
                        }
                    }
                });
            }
        });
        
        // Clean up clone
        document.body.removeChild(clone);
        
        return canvas;
    };

    const handleExportPdf = async () => {
        setShowExportMenu(false);
        if (!resumePreviewRef.current) {
            alert('Resume preview not available for export');
            return;
        }

        setIsExporting(true);
        try {
            const canvas = await captureResumeAsCanvas();
            const imgData = canvas.toDataURL('image/png');
            
            // Calculate PDF dimensions (A4 size)
            const pdfWidth = 210; // A4 width in mm
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            // Create PDF
            const pdf = new jsPDF({
                orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
                unit: 'mm',
                format: [pdfWidth, pdfHeight]
            });

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            // Generate filename
            const fileName = resumeData.personalInfo.fullName 
                ? `${resumeData.personalInfo.fullName.replace(/\s+/g, '_')}_Resume.pdf`
                : 'Resume.pdf';
            
            // Save PDF
            pdf.save(fileName);
        } catch (error) {
            console.error('Error exporting PDF:', error);
            alert('Failed to export resume. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportPng = async () => {
        setShowExportMenu(false);
        if (!resumePreviewRef.current) {
            alert('Resume preview not available for export');
            return;
        }

        setIsExporting(true);
        try {
            const canvas = await captureResumeAsCanvas();
            const imgData = canvas.toDataURL('image/png');
            
            // Create download link
            const link = document.createElement('a');
            link.download = resumeData.personalInfo.fullName 
                ? `${resumeData.personalInfo.fullName.replace(/\s+/g, '_')}_Resume.png`
                : 'Resume.png';
            link.href = imgData;
            link.click();
        } catch (error) {
            console.error('Error exporting PNG:', error);
            alert('Failed to export resume. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportJpg = async () => {
        setShowExportMenu(false);
        if (!resumePreviewRef.current) {
            alert('Resume preview not available for export');
            return;
        }

        setIsExporting(true);
        try {
            const canvas = await captureResumeAsCanvas();
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            
            // Create download link
            const link = document.createElement('a');
            link.download = resumeData.personalInfo.fullName 
                ? `${resumeData.personalInfo.fullName.replace(/\s+/g, '_')}_Resume.jpg`
                : 'Resume.jpg';
            link.href = imgData;
            link.click();
        } catch (error) {
            console.error('Error exporting JPG:', error);
            alert('Failed to export resume. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportDoc = async () => {
        setShowExportMenu(false);
        if (!resumePreviewRef.current) {
            alert('Resume preview not available for export');
            return;
        }

        setIsExporting(true);
        try {
            const element = resumePreviewRef.current;
            
            // Clone the element
            const clone = element.cloneNode(true) as HTMLElement;
            
            // Remove SVG elements and replace with text
            const svgs = clone.querySelectorAll('svg');
            svgs.forEach(svg => {
                const parent = svg.parentElement;
                if (parent) {
                    const parentText = parent.textContent || '';
                    const iconText = parentText.includes('@') ? '✉' :
                                   parentText.includes('+') || parentText.match(/\d/) ? '📞' :
                                   parentText.includes('linkedin') ? 'in' :
                                   parentText.includes('github') || parentText.includes('portfolio') ? '🔗' :
                                   '📍';
                    const span = document.createElement('span');
                    span.textContent = iconText + ' ';
                    parent.replaceChild(span, svg);
                }
            });
            
            // Create HTML content
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            font-family: "Mona Sans", ui-sans-serif, system-ui, sans-serif;
                            padding: 40px;
                            max-width: 800px;
                            margin: 0 auto;
                        }
                        h1 { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
                        h2 { font-size: 12px; font-weight: bold; text-transform: uppercase; 
                             border-bottom: 1px solid #000; padding-bottom: 5px; margin-top: 20px; margin-bottom: 10px; }
                        p { margin: 5px 0; font-size: 14px; }
                        ul { margin: 5px 0; padding-left: 20px; }
                        li { margin: 3px 0; font-size: 14px; }
                    </style>
                </head>
                <body>
                    ${clone.innerHTML}
                </body>
                </html>
            `;
            
            // Create blob and download
            const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = resumeData.personalInfo.fullName 
                ? `${resumeData.personalInfo.fullName.replace(/\s+/g, '_')}_Resume.doc`
                : 'Resume.doc';
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting DOC:', error);
            alert('Failed to export resume. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };

        if (showExportMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showExportMenu]);

    return (
        <main className="!pt-0 min-h-screen bg-white">
            {/* Navigation */}
            <nav className="resume-nav !pb-2">
                <Link to="/" className="back-button">
                    <img src="/icons/back.svg" alt="back" className="w-2.5 h-2.5" />
                    <span className="text-gray-800 text-sm font-semibold">Back to Homepage</span>
                </Link>
                <div className="relative" ref={exportMenuRef}>
                    <button 
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        disabled={isExporting || !hasFormData()}
                        className="primary-button w-fit flex items-center gap-2"
                    >
                        {isExporting ? 'Exporting...' : 'Export'}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    
                    {showExportMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                            <button
                                onClick={handleExportPdf}
                                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100"
                            >
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm text-gray-700">Download as PDF</span>
                            </button>
                            <button
                                onClick={handleExportDoc}
                                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100"
                            >
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm text-gray-700">Download as DOC</span>
                            </button>
                            <button
                                onClick={handleExportPng}
                                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100"
                            >
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm text-gray-700">Download as PNG</span>
                            </button>
                            <button
                                onClick={handleExportJpg}
                                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3"
                            >
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm text-gray-700">Download as JPG</span>
                            </button>
                        </div>
                    )}
                </div>
            </nav>

            <div className="flex flex-col lg:flex-row w-full lg:h-[calc(100vh-60px)] -mt-2">
                {/* Mobile: Upload Section */}
                <section className="lg:hidden bg-white border-b border-gray-200 p-6">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Upload Resume</h2>
                        <FileUploader key={uploadedFile ? 'has-file' : 'no-file'} onFileSelect={setUploadedFile} />
                        {uploadedFile && (
                            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-sm text-green-700">
                                    Resume uploaded successfully! Your information will be auto-filled below. Please review and edit as needed.
                                </p>
                        </div>
                        )}
                    </div>
                </section>

                {/* Mobile: Template Selection */}
                <section className="lg:hidden bg-white border-b border-gray-200 p-6">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Choose Template</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {templates.map((template) => (
                                <div
                                    key={template.id}
                                    onClick={() => setSelectedTemplate(template.id)}
                                    className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                        selectedTemplate === template.id
                                            ? 'border-blue-600 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}
                                >
                                    {selectedTemplate === template.id && (
                                        <div className="absolute top-2 right-2">
                                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                                <img src="/icons/check.svg" alt="selected" className="w-4 h-4" />
                                    </div>
                                </div>
                            )}
                                    <div className={`h-32 rounded mb-3 ${template.previewBg} flex items-center justify-center overflow-hidden relative`}>
                                        <div className="text-xs text-gray-400">Preview</div>
                        </div>
                                    <p className="text-sm font-semibold text-gray-900 mb-1">{template.name}</p>
                                    <p className="text-xs text-gray-600">{template.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Left Side - Form Fields (Desktop) */}
                <section className="hidden lg:block w-full lg:w-[45%] bg-white lg:border-r border-gray-200 overflow-y-auto">
                    <div className="p-8 max-w-4xl mx-auto">
                        {/* Upload Resume Section */}
                    <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Upload Resume</h2>
                            <FileUploader key={uploadedFile ? 'has-file' : 'no-file'} onFileSelect={setUploadedFile} />
                        {uploadedFile && (
                                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-green-700">
                                        Resume uploaded successfully! Your information will be auto-filled below. Please review and edit as needed.
                                    </p>
                                </div>
                            )}
                    </div>

                    {/* Choose Template Section */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Choose Template</h2>
                            <div className="grid grid-cols-2 gap-4">
                            {templates.map((template) => (
                                <div
                                    key={template.id}
                                    onClick={() => setSelectedTemplate(template.id)}
                                    className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                            selectedTemplate === template.id
                                            ? 'border-blue-600 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}
                                >
                                        {selectedTemplate === template.id && (
                                        <div className="absolute top-2 right-2">
                                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                                <img src="/icons/check.svg" alt="selected" className="w-4 h-4" />
                                            </div>
                                        </div>
                                    )}
                                        <div className={`h-32 rounded mb-3 ${template.previewBg} flex items-center justify-center overflow-hidden relative`}>
                                            <div className="text-xs text-gray-400">Preview</div>
                                        </div>
                                        <p className="text-sm font-semibold text-gray-900 mb-1">{template.name}</p>
                                        <p className="text-xs text-gray-600">{template.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                        {/* Section Navigation */}
                        <div className="mb-8 flex gap-2 flex-wrap">
                            {sections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        activeSection === section.id
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {section.label}
                                </button>
                            ))}
                        </div>

                        {/* Personal Information Section */}
                        {activeSection === 'personal' && (
                        <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-gray-900">Personal Information</h2>
                                <div className="form-div">
                                    <label>Full Name</label>
                                    <input
                                        type="text"
                                        value={resumeData.personalInfo.fullName}
                                        onChange={(e) => updatePersonalInfo('fullName', e.target.value)}
                                        placeholder="John Smith"
                                    />
                                </div>
                                <div className="form-div">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        value={resumeData.personalInfo.email}
                                        onChange={(e) => updatePersonalInfo('email', e.target.value)}
                                        placeholder="john.smith@email.com"
                                    />
                            </div>
                                <div className="form-div">
                                    <label>Phone</label>
                                    <input
                                        type="tel"
                                        value={resumeData.personalInfo.phone}
                                        onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                                        placeholder="+1 (555) 123-4567"
                                    />
                </div>
                                <div className="form-div">
                                    <label>Location</label>
                                    <input
                                        type="text"
                                        value={resumeData.personalInfo.location}
                                        onChange={(e) => updatePersonalInfo('location', e.target.value)}
                                        placeholder="San Francisco, CA"
                                    />
                                    </div>
                                <div className="form-div">
                                    <label>LinkedIn</label>
                                    <input
                                        type="text"
                                        value={resumeData.personalInfo.linkedin}
                                        onChange={(e) => updatePersonalInfo('linkedin', e.target.value)}
                                        placeholder="linkedin.com/in/johnsmith"
                                    />
                                </div>
                                <div className="form-div">
                                    <label>Portfolio/Website</label>
                                    <input
                                        type="text"
                                        value={resumeData.personalInfo.portfolio}
                                        onChange={(e) => updatePersonalInfo('portfolio', e.target.value)}
                                        placeholder="www.yourwebsite.com"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Summary Section */}
                        {activeSection === 'summary' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-gray-900">Professional Summary</h2>
                                    <button
                                        onClick={async () => {
                                            const summary = await generateSummary(resumeData);
                                            if (summary) updateSummary(summary);
                                        }}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                    >
                                        ✨ AI Generate
                                    </button>
                                </div>
                                <div className="form-div">
                                    <label>Summary</label>
                                    <textarea
                                        value={resumeData.summary}
                                        onChange={(e) => updateSummary(e.target.value)}
                                        placeholder="Write a compelling summary of your professional experience..."
                                        rows={8}
                                    />
                        </div>
                    </div>
                        )}

                        {/* Experience Section */}
                        {activeSection === 'experience' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-bold text-gray-900">Work Experience</h2>
                                    <button
                                        onClick={addExperience}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                    >
                                        + Add Experience
                                    </button>
                                </div>
                                {resumeData.experience.map((exp, index) => (
                                    <div key={index} className="border border-gray-200 rounded-lg p-6 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="form-div">
                                                <label>Company</label>
                                                <input
                                                    type="text"
                                                    value={exp.company}
                                                    onChange={(e) => updateExperience(index, 'company', e.target.value)}
                                                    placeholder="Company Name"
                                                />
                                            </div>
                                            <div className="form-div">
                                                <label>Position</label>
                                                <input
                                                    type="text"
                                                    value={exp.position}
                                                    onChange={(e) => updateExperience(index, 'position', e.target.value)}
                                                    placeholder="Job Title"
                                                />
                                            </div>
                                            <div className="form-div">
                                                <label>Start Date</label>
                                                <input
                                                    type="text"
                                                    value={exp.startDate}
                                                    onChange={(e) => updateExperience(index, 'startDate', e.target.value)}
                                                    placeholder="Jan 2021"
                                                />
                                            </div>
                                            <div className="form-div">
                                                <label>End Date</label>
                                                <input
                                                    type="text"
                                                    value={exp.endDate}
                                                    onChange={(e) => updateExperience(index, 'endDate', e.target.value)}
                                                    placeholder="Present"
                                                />
                                            </div>
                                            <div className="form-div">
                                                <label>Location</label>
                                                <input
                                                    type="text"
                                                    value={exp.location || ''}
                                                    onChange={(e) => updateExperience(index, 'location', e.target.value)}
                                                    placeholder="City, State"
                                                />
                                            </div>
                                        </div>
                                        <div className="form-div">
                                            <div className="flex items-center justify-between mb-2">
                                                <label>Description</label>
                                                <button
                                                    onClick={async () => {
                                                        const bullets = await generateBulletPoints(
                                                            exp.position,
                                                            exp.company,
                                                            exp.description.filter(d => d.trim())
                                                        );
                                                        if (bullets.length > 0) {
                                                            setResumeData(prev => ({
                                                                ...prev,
                                                                experience: prev.experience.map((e, i) =>
                                                                    i === index ? { ...e, description: bullets } : e
                                                                )
                                                            }));
                                                        }
                                                    }}
                                                    className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                                                >
                                                    ✨ AI Generate Bullets
                                                </button>
                                            </div>
                                            {exp.description.map((desc, descIndex) => (
                                                <div key={descIndex} className="mb-2">
                                                    <textarea
                                                        value={desc}
                                                        onChange={(e) => updateExperienceDescription(index, descIndex, e.target.value)}
                                                        placeholder="Describe your responsibilities and achievements..."
                                                        rows={3}
                                                        className="mb-1"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={async () => {
                                                                const improved = await improveText(desc);
                                                                if (improved) updateExperienceDescription(index, descIndex, improved);
                                                            }}
                                                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                                                        >
                                                            ✏️ Improve
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                const quantified = await quantifyAchievement(desc);
                                                                if (quantified) updateExperienceDescription(index, descIndex, quantified);
                                                            }}
                                                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                                                        >
                                                            📊 Quantify
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <button
                                                onClick={() => addExperienceDescription(index)}
                                                className="text-sm text-blue-600 hover:text-blue-700"
                                            >
                                                + Add bullet point
                                            </button>
                                        </div>
                                </div>
                            ))}
                        </div>
                        )}

                        {/* Education Section */}
                        {activeSection === 'education' && (
                        <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-bold text-gray-900">Education</h2>
                                    <button
                                        onClick={addEducation}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                    >
                                        + Add Education
                                    </button>
                                </div>
                                {resumeData.education.map((edu, index) => (
                                    <div key={index} className="border border-gray-200 rounded-lg p-6 space-y-4">
                                        <div className="form-div">
                                            <label>Degree</label>
                                            <input
                                                type="text"
                                                value={edu.degree}
                                                onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                                                placeholder="Bachelor of Science in Computer Science"
                                            />
                                        </div>
                                        <div className="form-div">
                                            <label>School/University</label>
                                            <input
                                                type="text"
                                                value={edu.school}
                                                onChange={(e) => updateEducation(index, 'school', e.target.value)}
                                                placeholder="University Name"
                                            />
                            </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="form-div">
                                                <label>GPA</label>
                                                <input
                                                    type="text"
                                                    value={edu.gpa}
                                                    onChange={(e) => updateEducation(index, 'gpa', e.target.value)}
                                                    placeholder="3.8/4.0"
                                                />
                            </div>
                                            <div className="form-div">
                                                <label>Graduation Date</label>
                                                <input
                                                    type="text"
                                                    value={edu.graduationDate}
                                                    onChange={(e) => updateEducation(index, 'graduationDate', e.target.value)}
                                                    placeholder="May 2019"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Skills Section */}
                        {activeSection === 'skills' && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-gray-900">Skills</h2>
                                
                                {/* Technical Skills */}
                            <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-lg font-semibold text-gray-800">Technical Skills</h3>
                                        <button
                                            onClick={() => addSkill('technical')}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                        >
                                            + Add Technical Skill
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {resumeData.skills.technical.map((skill, index) => (
                                            <div key={index} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={skill}
                                                    onChange={(e) => updateSkill('technical', index, e.target.value)}
                                                    placeholder="e.g., JavaScript, React, Node.js"
                                                    className="flex-1"
                                                />
                                                {resumeData.skills.technical.length > 1 && (
                                                    <button
                                                        onClick={() => removeSkill('technical', index)}
                                                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                            </div>

                                {/* Soft Skills */}
                            <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-lg font-semibold text-gray-800">Soft Skills</h3>
                                        <button
                                            onClick={() => addSkill('soft')}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                        >
                                            + Add Soft Skill
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {resumeData.skills.soft.map((skill, index) => (
                                            <div key={index} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={skill}
                                                    onChange={(e) => updateSkill('soft', index, e.target.value)}
                                                    placeholder="e.g., Leadership, Problem-solving, Communication"
                                                    className="flex-1"
                                                />
                                                {resumeData.skills.soft.length > 1 && (
                                                    <button
                                                        onClick={() => removeSkill('soft', index)}
                                                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Projects Section */}
                        {activeSection === 'projects' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
                                    <button
                                        onClick={addProject}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                    >
                                        + Add Project
                                    </button>
                                </div>
                                {resumeData.projects.map((project, index) => (
                                    <div key={index} className="border border-gray-200 rounded-lg p-6 space-y-4">
                                        <div className="form-div">
                                            <label>Project Name</label>
                                            <input
                                                type="text"
                                                value={project.name}
                                                onChange={(e) => updateProject(index, 'name', e.target.value)}
                                                placeholder="Project Name"
                                            />
                                        </div>
                                        <div className="form-div">
                                            <label>Description</label>
                                            <textarea
                                                value={project.description}
                                                onChange={(e) => updateProject(index, 'description', e.target.value)}
                                                placeholder="Describe your project..."
                                                rows={4}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Certifications Section */}
                        {activeSection === 'certifications' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-bold text-gray-900">Certifications</h2>
                                    <button
                                        onClick={addCertification}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                    >
                                        + Add Certification
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {resumeData.certifications.map((cert, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={cert.name}
                                                onChange={(e) => updateCertification(index, e.target.value)}
                                                placeholder="e.g., AWS Certified Solutions Architect"
                                                className="flex-1"
                                            />
                                            {resumeData.certifications.length > 1 && (
                                                <button
                                                    onClick={() => removeCertification(index)}
                                                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* AI Tools Section */}
                        {activeSection === 'ai-tools' && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-gray-900">✨ AI-Powered Tools</h2>
                                <AIFeatures
                                    resumeData={resumeData}
                                    onSummaryUpdate={updateSummary}
                                    onBulletsUpdate={(expIndex, bullets) => {
                                        setResumeData(prev => ({
                                            ...prev,
                                            experience: prev.experience.map((exp, i) =>
                                                i === expIndex ? { ...exp, description: bullets } : exp
                                            )
                                        }));
                                    }}
                                    onDescriptionUpdate={updateExperienceDescription}
                                />
                            </div>
                        )}

                        {/* Achievements Section */}
                        {activeSection === 'achievements' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-bold text-gray-900">Achievements</h2>
                                    <button
                                        onClick={addAchievement}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                    >
                                        + Add Achievement
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {resumeData.achievements.map((ach, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={ach.name}
                                                onChange={(e) => updateAchievement(index, e.target.value)}
                                                placeholder="e.g., Hackathon Winner 2022"
                                                className="flex-1"
                                            />
                                            {resumeData.achievements.length > 1 && (
                                                <button
                                                    onClick={() => removeAchievement(index)}
                                                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Mobile: Form Fields Section */}
                <section className="lg:hidden bg-white border-b border-gray-200 overflow-y-auto">
                    <div className="p-6">
                        {/* Section Navigation */}
                        <div className="mb-6 flex gap-2 flex-wrap">
                            {sections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                        activeSection === section.id
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {section.label}
                                </button>
                            ))}
                        </div>

                        {/* Mobile Form Sections - Same as desktop but with mobile styling */}
                        {activeSection === 'personal' && (
                                <div className="space-y-4">
                                <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
                                <div className="form-div">
                                    <label>Full Name</label>
                                    <input
                                        type="text"
                                        value={resumeData.personalInfo.fullName}
                                        onChange={(e) => updatePersonalInfo('fullName', e.target.value)}
                                        placeholder="John Smith"
                                    />
                                </div>
                                <div className="form-div">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        value={resumeData.personalInfo.email}
                                        onChange={(e) => updatePersonalInfo('email', e.target.value)}
                                        placeholder="john.smith@email.com"
                                    />
                                </div>
                                <div className="form-div">
                                    <label>Phone</label>
                                    <input
                                        type="tel"
                                        value={resumeData.personalInfo.phone}
                                        onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                                        placeholder="+1 (555) 123-4567"
                                    />
                                </div>
                                <div className="form-div">
                                    <label>Location</label>
                                    <input
                                        type="text"
                                        value={resumeData.personalInfo.location}
                                        onChange={(e) => updatePersonalInfo('location', e.target.value)}
                                        placeholder="San Francisco, CA"
                                    />
                                </div>
                                <div className="form-div">
                                    <label>LinkedIn</label>
                                    <input
                                        type="text"
                                        value={resumeData.personalInfo.linkedin}
                                        onChange={(e) => updatePersonalInfo('linkedin', e.target.value)}
                                        placeholder="linkedin.com/in/johnsmith"
                                    />
                                </div>
                                <div className="form-div">
                                    <label>Portfolio/Website</label>
                                    <input
                                        type="text"
                                        value={resumeData.personalInfo.portfolio}
                                        onChange={(e) => updatePersonalInfo('portfolio', e.target.value)}
                                        placeholder="www.yourwebsite.com"
                                    />
                                </div>
                            </div>
                        )}

                        {activeSection === 'summary' && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-gray-900">Professional Summary</h2>
                                <div className="form-div">
                                    <label>Summary</label>
                                    <textarea
                                        value={resumeData.summary}
                                        onChange={(e) => updateSummary(e.target.value)}
                                        placeholder="Write a compelling summary of your professional experience..."
                                        rows={6}
                                    />
                                </div>
                            </div>
                        )}

                        {activeSection === 'experience' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-gray-900">Work Experience</h2>
                                    <button
                                        onClick={addExperience}
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                                    >
                                        + Add
                                    </button>
                                </div>
                                {resumeData.experience.map((exp, index) => (
                                    <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="form-div">
                                                <label>Company</label>
                                                <input
                                                    type="text"
                                                    value={exp.company}
                                                    onChange={(e) => updateExperience(index, 'company', e.target.value)}
                                                    placeholder="Company Name"
                                                />
                                            </div>
                                            <div className="form-div">
                                                <label>Position</label>
                                                <input
                                                    type="text"
                                                    value={exp.position}
                                                    onChange={(e) => updateExperience(index, 'position', e.target.value)}
                                                    placeholder="Job Title"
                                                />
                                            </div>
                                            <div className="form-div">
                                                <label>Start Date</label>
                                                <input
                                                    type="text"
                                                    value={exp.startDate}
                                                    onChange={(e) => updateExperience(index, 'startDate', e.target.value)}
                                                    placeholder="Jan 2021"
                                                />
                                            </div>
                                            <div className="form-div">
                                                <label>End Date</label>
                                                <input
                                                    type="text"
                                                    value={exp.endDate}
                                                    onChange={(e) => updateExperience(index, 'endDate', e.target.value)}
                                                    placeholder="Present"
                                                />
                                            </div>
                                            <div className="form-div">
                                                <label>Location</label>
                                                <input
                                                    type="text"
                                                    value={exp.location || ''}
                                                    onChange={(e) => updateExperience(index, 'location', e.target.value)}
                                                    placeholder="City, State"
                                                />
                                            </div>
                                        </div>
                                        <div className="form-div">
                                            <label>Description</label>
                                            {exp.description.map((desc, descIndex) => (
                                                <textarea
                                                    key={descIndex}
                                                    value={desc}
                                                    onChange={(e) => updateExperienceDescription(index, descIndex, e.target.value)}
                                                    placeholder="Describe your responsibilities..."
                                                    rows={2}
                                                    className="mb-2"
                                                />
                                            ))}
                                            <button
                                                onClick={() => addExperienceDescription(index)}
                                                className="text-xs text-blue-600 hover:text-blue-700"
                                            >
                                                + Add bullet point
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeSection === 'education' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-gray-900">Education</h2>
                                    <button
                                        onClick={addEducation}
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                                    >
                                        + Add
                                    </button>
                                </div>
                                {resumeData.education.map((edu, index) => (
                                    <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                                        <div className="form-div">
                                            <label>Degree</label>
                                            <input
                                                type="text"
                                                value={edu.degree}
                                                onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                                                placeholder="Bachelor of Science in Computer Science"
                                            />
                                        </div>
                                        <div className="form-div">
                                            <label>School/University</label>
                                            <input
                                                type="text"
                                                value={edu.school}
                                                onChange={(e) => updateEducation(index, 'school', e.target.value)}
                                                placeholder="University Name"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="form-div">
                                                <label>GPA</label>
                                                <input
                                                    type="text"
                                                    value={edu.gpa}
                                                    onChange={(e) => updateEducation(index, 'gpa', e.target.value)}
                                                    placeholder="3.8/4.0"
                                                />
                                            </div>
                                            <div className="form-div">
                                                <label>Graduation Date</label>
                                                <input
                                                    type="text"
                                                    value={edu.graduationDate}
                                                    onChange={(e) => updateEducation(index, 'graduationDate', e.target.value)}
                                                    placeholder="May 2019"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeSection === 'skills' && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-gray-900">Skills</h2>
                                    <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-base font-semibold text-gray-800">Technical Skills</h3>
                                        <button
                                            onClick={() => addSkill('technical')}
                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                                        >
                                            + Add
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {resumeData.skills.technical.map((skill, index) => (
                                            <div key={index} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={skill}
                                                    onChange={(e) => updateSkill('technical', index, e.target.value)}
                                                    placeholder="e.g., JavaScript, React"
                                                    className="flex-1"
                                                />
                                                {resumeData.skills.technical.length > 1 && (
                                                    <button
                                                        onClick={() => removeSkill('technical', index)}
                                                        className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                            <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-base font-semibold text-gray-800">Soft Skills</h3>
                                        <button
                                            onClick={() => addSkill('soft')}
                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                                        >
                                            + Add
                                        </button>
                                            </div>
                                    <div className="space-y-2">
                                        {resumeData.skills.soft.map((skill, index) => (
                                            <div key={index} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={skill}
                                                    onChange={(e) => updateSkill('soft', index, e.target.value)}
                                                    placeholder="e.g., Leadership"
                                                    className="flex-1"
                                                />
                                                {resumeData.skills.soft.length > 1 && (
                                                    <button
                                                        onClick={() => removeSkill('soft', index)}
                                                        className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                        </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'projects' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-gray-900">Projects</h2>
                                    <button
                                        onClick={addProject}
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                                    >
                                        + Add
                                    </button>
                                </div>
                                {resumeData.projects.map((project, index) => (
                                    <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                                        <div className="form-div">
                                            <label>Project Name</label>
                                            <input
                                                type="text"
                                                value={project.name}
                                                onChange={(e) => updateProject(index, 'name', e.target.value)}
                                                placeholder="Project Name"
                                            />
                                        </div>
                                        <div className="form-div">
                                            <label>Description</label>
                                            <textarea
                                                value={project.description}
                                                onChange={(e) => updateProject(index, 'description', e.target.value)}
                                                placeholder="Describe your project..."
                                                rows={4}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeSection === 'certifications' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-gray-900">Certifications</h2>
                                    <button
                                        onClick={addCertification}
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                                    >
                                        + Add
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {resumeData.certifications.map((cert, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={cert.name}
                                                onChange={(e) => updateCertification(index, e.target.value)}
                                                placeholder="e.g., AWS Certified Solutions Architect"
                                                className="flex-1"
                                            />
                                            {resumeData.certifications.length > 1 && (
                                                <button
                                                    onClick={() => removeCertification(index)}
                                                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeSection === 'achievements' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-gray-900">Achievements</h2>
                                    <button
                                        onClick={addAchievement}
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                                    >
                                        + Add
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {resumeData.achievements.map((ach, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={ach.name}
                                                onChange={(e) => updateAchievement(index, e.target.value)}
                                                placeholder="e.g., Hackathon Winner 2022"
                                                className="flex-1"
                                            />
                                            {resumeData.achievements.length > 1 && (
                                                <button
                                                    onClick={() => removeAchievement(index)}
                                                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Right Side - Resume Preview/Document Viewer */}
                <section className="w-full lg:w-[55%] bg-[url('/images/bg-small.svg')] bg-cover overflow-y-auto lg:sticky lg:top-0 lg:h-[calc(100vh-60px)] min-h-[500px] order-last">
                    <div className="flex items-start justify-center h-full py-6">
                        {isConvertingPdf || isParsing ? (
                            <div className="flex flex-col items-center justify-center">
                                <img src="/images/resume-scan-2.gif" className="w-full max-w-md" />
                                <p className="text-gray-600 mt-4">
                                    {isConvertingPdf ? 'Converting resume...' : 'Analyzing resume with AI...'}
                                </p>
                            </div>
                        ) : hasFormData() ? (
                            // Show template-based resume when form has data (from extraction or manual entry)
                            <div ref={resumePreviewRef} className="gradient-border max-w-4xl w-full bg-white rounded-2xl shadow-xl">
                                <div className="p-10 space-y-5">
                                {/* Name and Contact */}
                                <div className="pb-3">
                                    <h1 className={`text-3xl font-bold ${templateStyles.headerText} mb-3`}>
                                        {resumeData.personalInfo.fullName || 'Your Name'}
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
                                        {resumeData.personalInfo.email && (
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                                <span>{resumeData.personalInfo.email}</span>
                                            </div>
                                        )}
                                        {resumeData.personalInfo.phone && (
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                                <span>{resumeData.personalInfo.phone}</span>
                                            </div>
                                        )}
                                        {resumeData.personalInfo.location && (
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                <span>{resumeData.personalInfo.location}</span>
                                            </div>
                                        )}
                                        {resumeData.personalInfo.linkedin && (
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                                </svg>
                                                <span>{resumeData.personalInfo.linkedin}</span>
                                            </div>
                                        )}
                                        {resumeData.personalInfo.portfolio && (
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                                <span>{resumeData.personalInfo.portfolio}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Professional Summary */}
                                {resumeData.summary && (
                            <div>
                                        <h2 className={`text-xs font-bold ${templateStyles.sectionHeader} mb-2 uppercase border-b ${templateStyles.sectionBorder} pb-1`}>PROFESSIONAL SUMMARY</h2>
                                        <p className="text-sm text-gray-700 leading-relaxed mt-2">{resumeData.summary}</p>
                                    </div>
                                )}

                                {/* Experience */}
                                {resumeData.experience.length > 0 && resumeData.experience[0].company && (
                                <div>
                                        <h2 className={`text-xs font-bold ${templateStyles.sectionHeader} mb-3 uppercase border-b ${templateStyles.sectionBorder} pb-1`}>EXPERIENCE</h2>
                                        <div className="space-y-4 mt-3">
                                            {resumeData.experience.map((exp, index) => (
                                                <div key={index} className="mb-3">
                                                    <div className="flex justify-between items-start mb-1">
                            <div>
                                                            <p className="font-bold text-sm text-gray-900">
                                                                {exp.position || 'Position'}
                                                            </p>
                                                            <p className="text-sm text-gray-700 font-medium">
                                                                {exp.company}
                                    </p>
                                </div>
                                                        <div className="text-right">
                                                            {(exp.startDate || exp.endDate) && (
                                                                <p className="text-sm text-gray-600">
                                                                    {exp.startDate} - {exp.endDate}
                                                                </p>
                                                            )}
                                                            {exp.location && (
                                                                <p className="text-sm text-gray-600">{exp.location}</p>
                                                            )}
                            </div>
                                                    </div>
                                                    {exp.description.filter(d => d).length > 0 && (
                                                        <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5 mt-1.5 ml-2">
                                                            {exp.description.filter(d => d).map((desc, descIndex) => (
                                                                <li key={descIndex}>{desc}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Projects */}
                                {resumeData.projects.length > 0 && resumeData.projects[0].name && (
                                    <div>
                                        <h2 className={`text-xs font-bold ${templateStyles.sectionHeader} mb-3 uppercase border-b ${templateStyles.sectionBorder} pb-1`}>PROJECTS</h2>
                                        <div className="space-y-3 mt-3">
                                            {resumeData.projects.map((project, index) => (
                                                <div key={index}>
                                                    <h3 className="font-bold text-sm text-gray-900 mb-1">
                                                        {project.name}
                                                    </h3>
                                                    {project.description && (
                                                        <p className="text-sm text-gray-700">{project.description}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            {/* Education */}
                                {resumeData.education.length > 0 && resumeData.education[0].degree && (
                            <div>
                                        <h2 className={`text-xs font-bold ${templateStyles.sectionHeader} mb-3 uppercase border-b ${templateStyles.sectionBorder} pb-1`}>EDUCATION</h2>
                                        <div className="space-y-3 mt-3">
                                            {resumeData.education.map((edu, index) => (
                                                <div key={index} className="flex justify-between items-start">
                                    <div>
                                                        <p className="font-bold text-sm text-gray-900">
                                                            {edu.degree}
                                                        </p>
                                                        <p className="text-sm text-gray-700 font-medium">
                                                            {edu.school}
                                                        </p>
                                    </div>
                                    <div className="text-right">
                                                        {edu.graduationDate && (
                                                            <p className="text-sm text-gray-600">{edu.graduationDate}</p>
                                                        )}
                                                        {edu.gpa && (
                                                            <p className="text-sm text-gray-600">GPA: {edu.gpa}</p>
                                                        )}
                                    </div>
                                </div>
                                            ))}
                            </div>
                                    </div>
                                )}

                                {/* Skills */}
                                {(resumeData.skills.technical.length > 0 && resumeData.skills.technical[0]) || (resumeData.skills.soft.length > 0 && resumeData.skills.soft[0]) ? (
                            <div>
                                        <h2 className={`text-xs font-bold ${templateStyles.sectionHeader} mb-3 uppercase border-b ${templateStyles.sectionBorder} pb-1`}>SKILLS</h2>
                                        <div className="mt-3 space-y-3">
                                            {resumeData.skills.technical.filter(s => s).length > 0 && (
                                                <div>
                                                    <p className="font-semibold text-sm text-gray-900 mb-1">Technical</p>
                                <div className="flex flex-wrap gap-2">
                                                        {resumeData.skills.technical.filter(s => s).map((skill, index) => (
                                                            <span key={index} className="px-3 py-1 bg-gray-100 text-sm text-gray-700 rounded">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                                            )}
                                            {resumeData.skills.soft.filter(s => s).length > 0 && (
                            <div>
                                                    <p className="font-semibold text-sm text-gray-900 mb-1">Soft Skills</p>
                                <div className="flex flex-wrap gap-2">
                                                        {resumeData.skills.soft.filter(s => s).map((skill, index) => (
                                                            <span key={index} className="px-3 py-1 bg-gray-100 text-sm text-gray-700 rounded">
                                            {skill}
                                        </span>
                                    ))}
                        </div>
                    </div>
                                            )}
                                        </div>
                                    </div>
                                ) : null}

                                {/* Certifications */}
                                {resumeData.certifications.length > 0 && resumeData.certifications[0].name && (
                                    <div>
                                        <h2 className={`text-xs font-bold ${templateStyles.sectionHeader} mb-3 uppercase border-b ${templateStyles.sectionBorder} pb-1`}>CERTIFICATIONS</h2>
                                        <div className="space-y-1 mt-3">
                                            {resumeData.certifications.filter(c => c.name).map((cert, index) => (
                                                <p key={index} className="text-sm text-gray-700">{cert.name}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Achievements */}
                                {resumeData.achievements.length > 0 && resumeData.achievements[0].name && (
                                    <div>
                                        <h2 className={`text-xs font-bold ${templateStyles.sectionHeader} mb-3 uppercase border-b ${templateStyles.sectionBorder} pb-1`}>ACHIEVEMENTS</h2>
                                        <div className="space-y-1 mt-3">
                                            {resumeData.achievements.filter(a => a.name).map((ach, index) => (
                                                <p key={index} className="text-sm text-gray-700">{ach.name}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            </div>
                        ) : resumeImageUrl && resumePdfUrl && !hasFormData() ? (
                            // Show uploaded resume only if no form data exists yet
                            <div className="animate-in fade-in duration-1000 gradient-border max-sm:m-0 w-full max-w-6xl my-auto">
                                <a href={resumePdfUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
                                    <img
                                        src={resumeImageUrl}
                                        className="w-full object-contain rounded-2xl"
                                        title="resume"
                                        style={{ transform: 'scale(1.3)', transformOrigin: 'top center' }}
                                    />
                                </a>
                            </div>
                        ) : selectedTemplate === 'modern-professional' && !resumeImageUrl && !hasFormData() && professionalResumeImageUrl ? (
                            <div className="animate-in fade-in duration-1000 gradient-border max-sm:m-0 w-full max-w-6xl my-auto">
                                <a href="/images/Professional CV Resume.pdf" target="_blank" rel="noopener noreferrer" className="block w-full">
                                    <img
                                        src={professionalResumeImageUrl}
                                        className="w-full object-contain rounded-2xl"
                                        title="Professional CV Resume"
                                    />
                                </a>
                            </div>
                        ) : (
                            <div ref={resumePreviewRef} className="gradient-border max-w-4xl w-full bg-white rounded-2xl shadow-xl">
                                <div className="p-10 space-y-5">
                                {/* Name and Contact */}
                                <div className="pb-3">
                                    <h1 className={`text-3xl font-bold ${templateStyles.headerText} mb-3`}>
                                        {resumeData.personalInfo.fullName || 'Your Name'}
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
                                        {resumeData.personalInfo.email && (
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                                <span>{resumeData.personalInfo.email}</span>
                                            </div>
                                        )}
                                        {resumeData.personalInfo.phone && (
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                                <span>{resumeData.personalInfo.phone}</span>
                                            </div>
                                        )}
                                        {resumeData.personalInfo.location && (
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                <span>{resumeData.personalInfo.location}</span>
                                            </div>
                                        )}
                                        {resumeData.personalInfo.linkedin && (
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                                </svg>
                                                <span>{resumeData.personalInfo.linkedin}</span>
                                            </div>
                                        )}
                                        {resumeData.personalInfo.portfolio && (
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                                <span>{resumeData.personalInfo.portfolio}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Professional Summary */}
                                {resumeData.summary && (
                            <div>
                                        <h2 className={`text-xs font-bold ${templateStyles.sectionHeader} mb-2 uppercase border-b ${templateStyles.sectionBorder} pb-1`}>PROFESSIONAL SUMMARY</h2>
                                        <p className="text-sm text-gray-700 leading-relaxed mt-2">{resumeData.summary}</p>
                                    </div>
                                )}

                                {/* Experience */}
                                {resumeData.experience.length > 0 && resumeData.experience[0].company && (
                                <div>
                                        <h2 className={`text-xs font-bold ${templateStyles.sectionHeader} mb-3 uppercase border-b ${templateStyles.sectionBorder} pb-1`}>EXPERIENCE</h2>
                                        <div className="space-y-4 mt-3">
                                            {resumeData.experience.map((exp, index) => (
                                                <div key={index} className="mb-3">
                                                    <div className="flex justify-between items-start mb-1">
                            <div>
                                                            <p className="font-bold text-sm text-gray-900">
                                                                {exp.position || 'Position'}
                                                            </p>
                                                            <p className="text-sm text-gray-700 font-medium">
                                                                {exp.company}
                                    </p>
                                </div>
                                                        <div className="text-right">
                                                            {(exp.startDate || exp.endDate) && (
                                                                <p className="text-sm text-gray-600">
                                                                    {exp.startDate} - {exp.endDate}
                                                                </p>
                                                            )}
                                                            {exp.location && (
                                                                <p className="text-sm text-gray-600">{exp.location}</p>
                                                            )}
                            </div>
                                                    </div>
                                                    {exp.description.filter(d => d).length > 0 && (
                                                        <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5 mt-1.5 ml-2">
                                                            {exp.description.filter(d => d).map((desc, descIndex) => (
                                                                <li key={descIndex}>{desc}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Projects */}
                                {resumeData.projects.length > 0 && resumeData.projects[0].name && (
                                    <div>
                                        <h2 className={`text-xs font-bold ${templateStyles.sectionHeader} mb-3 uppercase border-b ${templateStyles.sectionBorder} pb-1`}>PROJECTS</h2>
                                        <div className="space-y-3 mt-3">
                                            {resumeData.projects.map((project, index) => (
                                                <div key={index}>
                                                    <h3 className="font-bold text-sm text-gray-900 mb-1">
                                                        {project.name}
                                                    </h3>
                                                    {project.description && (
                                                        <p className="text-sm text-gray-700">{project.description}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            {/* Education */}
                                {resumeData.education.length > 0 && resumeData.education[0].degree && (
                            <div>
                                        <h2 className={`text-xs font-bold ${templateStyles.sectionHeader} mb-3 uppercase border-b ${templateStyles.sectionBorder} pb-1`}>EDUCATION</h2>
                                        <div className="space-y-3 mt-3">
                                            {resumeData.education.map((edu, index) => (
                                                <div key={index} className="flex justify-between items-start">
                                    <div>
                                                        <p className="font-bold text-sm text-gray-900">
                                                            {edu.degree}
                                                        </p>
                                                        <p className="text-sm text-gray-700 font-medium">
                                                            {edu.school}
                                                        </p>
                                    </div>
                                    <div className="text-right">
                                                        {edu.graduationDate && (
                                                            <p className="text-sm text-gray-600">{edu.graduationDate}</p>
                                                        )}
                                                        {edu.gpa && (
                                                            <p className="text-sm text-gray-600">GPA: {edu.gpa}</p>
                                                        )}
                                    </div>
                                </div>
                                            ))}
                            </div>
                                    </div>
                                )}

                                {/* Skills */}
                                {(resumeData.skills.technical.length > 0 && resumeData.skills.technical[0]) || (resumeData.skills.soft.length > 0 && resumeData.skills.soft[0]) ? (
                            <div>
                                        <h2 className={`text-xs font-bold ${templateStyles.sectionHeader} mb-3 uppercase border-b ${templateStyles.sectionBorder} pb-1`}>SKILLS</h2>
                                        <div className="mt-3 space-y-3">
                                            {resumeData.skills.technical.filter(s => s).length > 0 && (
                                                <div>
                                                    <p className="font-semibold text-sm text-gray-900 mb-1">Technical</p>
                                <div className="flex flex-wrap gap-2">
                                                        {resumeData.skills.technical.filter(s => s).map((skill, index) => (
                                                            <span key={index} className="px-3 py-1 bg-gray-100 text-sm text-gray-700 rounded">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                                            )}
                                            {resumeData.skills.soft.filter(s => s).length > 0 && (
                            <div>
                                                    <p className="font-semibold text-sm text-gray-900 mb-1">Soft Skills</p>
                                <div className="flex flex-wrap gap-2">
                                                        {resumeData.skills.soft.filter(s => s).map((skill, index) => (
                                                            <span key={index} className="px-3 py-1 bg-gray-100 text-sm text-gray-700 rounded">
                                            {skill}
                                        </span>
                                    ))}
                        </div>
                    </div>
                                            )}
                                        </div>
                                    </div>
                                ) : null}

                                {/* Certifications */}
                                {resumeData.certifications.length > 0 && resumeData.certifications[0].name && (
                                    <div>
                                        <h2 className={`text-xs font-bold ${templateStyles.sectionHeader} mb-3 uppercase border-b ${templateStyles.sectionBorder} pb-1`}>CERTIFICATIONS</h2>
                                        <div className="space-y-1 mt-3">
                                            {resumeData.certifications.filter(c => c.name).map((cert, index) => (
                                                <p key={index} className="text-sm text-gray-700">{cert.name}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Achievements */}
                                {resumeData.achievements.length > 0 && resumeData.achievements[0].name && (
                                    <div>
                                        <h2 className={`text-xs font-bold ${templateStyles.sectionHeader} mb-3 uppercase border-b ${templateStyles.sectionBorder} pb-1`}>ACHIEVEMENTS</h2>
                                        <div className="space-y-1 mt-3">
                                            {resumeData.achievements.filter(a => a.name).map((ach, index) => (
                                                <p key={index} className="text-sm text-gray-700">{ach.name}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    )
}

export default Builder
