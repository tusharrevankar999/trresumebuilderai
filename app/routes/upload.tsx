import {type FormEvent, useState} from 'react'
import Navbar from "~/components/Navbar";
import FileUploader from "~/components/FileUploader";
import {fileStorage, storage} from "~/lib/storage";
import {useNavigate} from "react-router";
import {convertPdfToImage, extractTextFromPdf} from "~/lib/pdf2img";
import {generateUUID} from "~/lib/utils";
import {analyzeResumeWithGemini, parseResumeWithGemini, calculateATSScore, calculateJDMatch, calculateContentStrength, calculateOverallResumeScore, detectOverusedWords, type JobDescription} from "~/lib/ai-features";
import {saveATSAnalysisRecord} from "~/lib/firebase";
import {Timestamp} from "firebase/firestore";

const Upload = () => {
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<{
        companyName?: string;
        jobTitle?: string;
        jobDescription?: string;
        file?: string;
    }>({});

    const handleFileSelect = (file: File | null) => {
        setFile(file);
        // Clear file error when file is selected
        if (file && errors.file) {
            setErrors(prev => ({ ...prev, file: undefined }));
        }
    }

    const handleAnalyze = async ({ companyName, jobTitle, jobDescription, file }: { companyName: string, jobTitle: string, jobDescription: string, file: File }) => {
        setIsProcessing(true);

        try {
            setStatusText('Uploading the file...');
            const uploadedFile = await fileStorage.upload([file]);
            if(!uploadedFile) {
                const error = new Error('Failed to upload file');
                const { saveErrorLog } = await import('~/lib/firebase');
                await saveErrorLog(error, {
                    errorType: 'FILE_UPLOAD',
                    fileName: file.name,
                    fileSize: file.size,
                    page: 'upload',
                    action: 'fileStorage.upload',
                });
                setIsProcessing(false);
                return setStatusText('Error: Failed to upload file');
            }

            setStatusText('Converting to image...');
            const imageFile = await convertPdfToImage(file);
            if(!imageFile.file) {
                const error = new Error('Failed to convert PDF to image');
                const { saveErrorLog } = await import('~/lib/firebase');
                await saveErrorLog(error, {
                    errorType: 'PDF_TO_IMAGE_CONVERSION',
                    fileName: file.name,
                    fileSize: file.size,
                    page: 'upload',
                    action: 'convertPdfToImage',
                });
                setIsProcessing(false);
                return setStatusText('Error: Failed to convert PDF to image');
            }

            setStatusText('Uploading the image...');
            const uploadedImage = await fileStorage.upload([imageFile.file]);
            if(!uploadedImage) {
                const error = new Error('Failed to upload image');
                const { saveErrorLog } = await import('~/lib/firebase');
                await saveErrorLog(error, {
                    errorType: 'IMAGE_UPLOAD',
                    fileName: file.name,
                    page: 'upload',
                    action: 'fileStorage.upload',
                });
                setIsProcessing(false);
                return setStatusText('Error: Failed to upload image');
            }

            setStatusText('Extracting resume text...');
            const resumeText = await extractTextFromPdf(file);
            if (!resumeText || resumeText.trim().length < 10) {
                const error = new Error('Failed to extract text from resume or text too short');
                const { saveErrorLog } = await import('~/lib/firebase');
                await saveErrorLog(error, {
                    errorType: 'PDF_TEXT_EXTRACTION',
                    fileName: file.name,
                    fileSize: file.size,
                    textLength: resumeText?.length || 0,
                    page: 'upload',
                    action: 'extractTextFromPdf',
                });
                setIsProcessing(false);
                return setStatusText('Error: Failed to extract text from resume');
            }

            setStatusText('Parsing resume data...');
            const parsedResumeData = await parseResumeWithGemini(resumeText);
            if (!parsedResumeData) {
                const error = new Error('Failed to parse resume with AI');
                const { saveErrorLog } = await import('~/lib/firebase');
                await saveErrorLog(error, {
                    errorType: 'AI_RESUME_PARSING',
                    fileName: file.name,
                    textLength: resumeText.length,
                    page: 'upload',
                    action: 'parseResumeWithGemini',
                });
                setIsProcessing(false);
                return setStatusText('Error: Failed to parse resume. Please check your API key.');
            }

        setStatusText('Processing job description...');
        const jdText = jobDescription;
        
        const jobDesc: JobDescription = {
            title: jobTitle,
            description: jdText,
            company: companyName,
        };

        setStatusText('Preparing data...');
        const uuid = generateUUID();
        const data = {
            id: uuid,
            resumePath: uploadedFile.path,
            imagePath: uploadedImage.path,
            companyName, 
            jobTitle, 
            jobDescriptionText: jdText,
            feedback: null as Feedback | null,
            parsedResumeData: parsedResumeData,
            jobDescription: jobDesc,
        }
        await storage.set(`resume:${uuid}`, JSON.stringify(data));

        setStatusText('Analyzing with AI...');
        console.log('🔍 Starting ATS analysis - Using Hugging Face API (NOT puter.com)');

        const feedback = await analyzeResumeWithGemini(resumeText, jobDesc);
        if (!feedback) {
            setIsProcessing(false);
            return setStatusText('Error: Failed to analyze resume. Please check your Gemini API key.');
        }

        data.feedback = feedback;
        await storage.set(`resume:${uuid}`, JSON.stringify(data));

        // Calculate ATS scores and save to Firebase
        if (parsedResumeData) {
            const atsScore = calculateATSScore(parsedResumeData);
            const keywordMatch = calculateJDMatch(parsedResumeData, jobDesc);
            const contentStrength = calculateContentStrength(parsedResumeData);
            const overallScore = calculateOverallResumeScore(atsScore, keywordMatch.score, contentStrength, 85);
            const overusedWords = detectOverusedWords(resumeText);
            const missingSkills = keywordMatch.missing || [];

            // Save ATS analysis record to Firebase
            await saveATSAnalysisRecord({
                fullName: parsedResumeData.personalInfo.fullName,
                email: parsedResumeData.personalInfo.email,
                jobTitle: jobTitle,
                companyName: companyName,
                jobDescription: jdText,
                overallScore: overallScore,
                keywordMatch: keywordMatch.score,
                atsCompatibility: atsScore.overall,
                contentStrength: contentStrength,
                lengthScore: 85,
                missingSkills: missingSkills,
                overusedWords: overusedWords.map(w => w.word),
                analyzedAt: Timestamp.now()
            });
        }

            setStatusText('Analysis complete, redirecting...');
            console.log(data);
            navigate(`/resume/${uuid}`);
        } catch (error) {
            console.error('❌ Error in handleAnalyze:', error);
            const { saveErrorLog } = await import('~/lib/firebase');
            await saveErrorLog(error instanceof Error ? error : new Error(String(error)), {
                errorType: 'RESUME_ANALYSIS',
                fileName: file.name,
                fileSize: file.size,
                page: 'upload',
                action: 'handleAnalyze',
            });
            setIsProcessing(false);
            setStatusText('Error: An unexpected error occurred. Please try again.');
        }
    }

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget.closest('form');
        if(!form) return;
        const formData = new FormData(form);

        const companyName = (formData.get('company-name') as string)?.trim() || '';
        const jobTitle = (formData.get('job-title') as string)?.trim() || '';
        const jobDescription = (formData.get('job-description') as string)?.trim() || '';

        // Validate form fields
        const newErrors: typeof errors = {};
        
        if (!companyName) {
            newErrors.companyName = 'Company name is required';
        }
        
        if (!jobTitle) {
            newErrors.jobTitle = 'Job title is required';
        }
        
        if (!jobDescription) {
            newErrors.jobDescription = 'Job description is required';
        }
        
        if (!file) {
            newErrors.file = 'Please upload a resume file';
        }

        // If there are errors, set them and return
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        // Clear errors if validation passes
        setErrors({});

        // TypeScript: file is guaranteed to be non-null here due to validation above
        if (!file) return;
        
        handleAnalyze({ companyName, jobTitle, jobDescription, file });
    }

    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover">
            <div className="sticky top-0 z-50 bg-gray-100 w-full">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <Navbar />
                </div>
            </div>

            <section className="main-section">
                <div className="page-heading py-16">
                    <h1>Smart feedback for your dream job</h1>
                    {isProcessing ? (
                        <>
                            <h2>{statusText}</h2>
                            <img src="/images/resume-scan.gif" className="w-full" />
                        </>
                    ) : (
                        <h2>Drop your resume for an ATS score and improvement tips</h2>
                    )}
                    {!isProcessing && (
                        <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
                            <div className="form-div">
                                <label htmlFor="company-name" className={errors.companyName ? 'text-red-500' : ''}>
                                    Company Name {errors.companyName && <span className="text-red-400 text-sm">*</span>}
                                </label>
                                <input 
                                    type="text" 
                                    name="company-name" 
                                    placeholder="Company Name" 
                                    id="company-name"
                                    className={errors.companyName ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500' : ''}
                                    onChange={(e) => {
                                        if (e.target.value.trim() && errors.companyName) {
                                            setErrors(prev => ({ ...prev, companyName: undefined }));
                                        }
                                    }}
                                />
                                {errors.companyName && (
                                    <p className="text-red-400 text-sm mt-1">{errors.companyName}</p>
                                )}
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-title" className={errors.jobTitle ? 'text-red-500' : ''}>
                                    Job Title {errors.jobTitle && <span className="text-red-400 text-sm">*</span>}
                                </label>
                                <input 
                                    type="text" 
                                    name="job-title" 
                                    placeholder="Job Title" 
                                    id="job-title"
                                    className={errors.jobTitle ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500' : ''}
                                    onChange={(e) => {
                                        if (e.target.value.trim() && errors.jobTitle) {
                                            setErrors(prev => ({ ...prev, jobTitle: undefined }));
                                        }
                                    }}
                                />
                                {errors.jobTitle && (
                                    <p className="text-red-400 text-sm mt-1">{errors.jobTitle}</p>
                                )}
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-description" className={errors.jobDescription ? 'text-red-500' : ''}>
                                    Job Description {errors.jobDescription && <span className="text-red-400 text-sm">*</span>}
                                </label>
                                <textarea 
                                    rows={5} 
                                    name="job-description" 
                                    placeholder="Paste job description here" 
                                    id="job-description"
                                    className={errors.jobDescription ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500' : ''}
                                    onChange={(e) => {
                                        if (e.target.value.trim() && errors.jobDescription) {
                                            setErrors(prev => ({ ...prev, jobDescription: undefined }));
                                        }
                                    }}
                                />
                                {errors.jobDescription && (
                                    <p className="text-red-400 text-sm mt-1">{errors.jobDescription}</p>
                                )}
                            </div>

                            <div className="form-div">
                                <label htmlFor="uploader" className={errors.file ? 'text-red-500' : ''}>
                                    Upload Resume (PDF) {errors.file && <span className="text-red-400 text-sm">*</span>}
                                </label>
                                <FileUploader onFileSelect={handleFileSelect} accept=".pdf" hasError={!!errors.file} />
                                {errors.file && (
                                    <p className="text-red-400 text-sm mt-1">{errors.file}</p>
                                )}
                            </div>

                            <button 
                                className={`primary-button ${!file ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                type="submit"
                                disabled={!file}
                            >
                                Analyze Resume
                            </button>
                        </form>
                    )}
                </div>
            </section>
        </main>
    )
}
export default Upload
