import {type FormEvent, useState} from 'react'
import Navbar from "~/components/Navbar";
import FileUploader from "~/components/FileUploader";
import {usePuterStore} from "~/lib/puter";
import {useNavigate} from "react-router";
import {convertPdfToImage, extractTextFromPdf} from "~/lib/pdf2img";
import {generateUUID} from "~/lib/utils";
import {analyzeResumeWithGemini, parseResumeWithGemini, type JobDescription} from "~/lib/ai-features";

const Upload = () => {
    const { auth, isLoading, fs, kv } = usePuterStore();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const handleFileSelect = (file: File | null) => {
        setFile(file)
    }

    const handleAnalyze = async ({ companyName, jobTitle, jobDescription, file }: { companyName: string, jobTitle: string, jobDescription: string, file: File }) => {
        setIsProcessing(true);

        setStatusText('Uploading the file...');
        const uploadedFile = await fs.upload([file]);
        if(!uploadedFile) {
            setIsProcessing(false);
            return setStatusText('Error: Failed to upload file');
        }

        setStatusText('Converting to image...');
        const imageFile = await convertPdfToImage(file);
        if(!imageFile.file) {
            setIsProcessing(false);
            return setStatusText('Error: Failed to convert PDF to image');
        }

        setStatusText('Uploading the image...');
        const uploadedImage = await fs.upload([imageFile.file]);
        if(!uploadedImage) {
            setIsProcessing(false);
            return setStatusText('Error: Failed to upload image');
        }

        setStatusText('Extracting resume text...');
        const resumeText = await extractTextFromPdf(file);
        if (!resumeText) {
            setIsProcessing(false);
            return setStatusText('Error: Failed to extract text from resume');
        }

        setStatusText('Parsing resume data...');
        const parsedResumeData = await parseResumeWithGemini(resumeText);
        if (!parsedResumeData) {
            setIsProcessing(false);
            return setStatusText('Error: Failed to parse resume. Please check your Gemini API key.');
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
        await kv.set(`resume:${uuid}`, JSON.stringify(data));

        setStatusText('Analyzing with AI...');

        const feedback = await analyzeResumeWithGemini(resumeText, jobDesc);
        if (!feedback) {
            setIsProcessing(false);
            return setStatusText('Error: Failed to analyze resume. Please check your Gemini API key.');
        }

        data.feedback = feedback;
        await kv.set(`resume:${uuid}`, JSON.stringify(data));

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
    }

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget.closest('form');
        if(!form) return;
        const formData = new FormData(form);

        const companyName = formData.get('company-name') as string;
        const jobTitle = formData.get('job-title') as string;
        const jobDescription = formData.get('job-description') as string;

        if(!file) return;

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
                                <label htmlFor="company-name">Company Name</label>
                                <input type="text" name="company-name" placeholder="Company Name" id="company-name" />
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-title">Job Title</label>
                                <input type="text" name="job-title" placeholder="Job Title" id="job-title" />
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-description">Job Description</label>
                                <textarea rows={5} name="job-description" placeholder="Paste job description here" id="job-description" />
                            </div>

                            <div className="form-div">
                                <label htmlFor="uploader">Upload Resume (PDF)</label>
                                <FileUploader onFileSelect={handleFileSelect} accept=".pdf" />
                            </div>

                            <button className="primary-button" type="submit">
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
