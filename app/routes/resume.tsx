import {Link, useNavigate, useParams} from "react-router";
import {useEffect, useState, type FormEvent} from "react";
import {fileStorage, storage, auth} from "~/lib/storage";
import Summary from "~/components/Summary";
import ATS from "~/components/ATS";
import Details from "~/components/Details";
import EnhancedATS from "~/components/EnhancedATS";
import FileUploader from "~/components/FileUploader";
import {extractTextFromPdf} from "~/lib/pdf2img";
import {analyzeResumeWithGemini, calculateATSScore, calculateJDMatch, calculateContentStrength, calculateOverallResumeScore, detectOverusedWords, scanQuantifiedMetrics, type ParsedResumeData, type JobDescription} from "~/lib/ai-features";
import {saveATSAnalysisRecord} from "~/lib/firebase";
import {Timestamp} from "firebase/firestore";

export const meta = () => ([
    { title: 'ResumeAI | Review ' },
    { name: 'description', content: 'Detailed overview of your resume' },
])

const Resume = () => {
    const { id } = useParams();
    const [imageUrl, setImageUrl] = useState('');
    const [resumeUrl, setResumeUrl] = useState('');
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [parsedResumeData, setParsedResumeData] = useState<ParsedResumeData | null>(null);
    const [jobDescription, setJobDescription] = useState<JobDescription | null>(null);
    const [showJDForm, setShowJDForm] = useState(false);
    const [isLoadingResume, setIsLoadingResume] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [jdFile, setJdFile] = useState<File | null>(null);
    const [resumeText, setResumeText] = useState<string>('');
    const navigate = useNavigate();

    // Auth is already set in storage.ts

    useEffect(() => {
        const loadResume = async () => {
            setIsLoadingResume(true);
            const resume = await storage.get(`resume:${id}`);

            if(!resume) {
                setIsLoadingResume(false);
                return;
            }

            const data = JSON.parse(resume);

            const resumeBlob = await fileStorage.read(data.resumePath);
            if(!resumeBlob) {
                setIsLoadingResume(false);
                return;
            }

            const pdfBlob = new Blob([resumeBlob], { type: 'application/pdf' });
            const resumeUrl = URL.createObjectURL(pdfBlob);
            setResumeUrl(resumeUrl);

            const imageBlob = await fileStorage.read(data.imagePath);
            if(!imageBlob) {
                setIsLoadingResume(false);
                return;
            }
            const imageUrl = URL.createObjectURL(imageBlob);
            setImageUrl(imageUrl);

            setFeedback(data.feedback);
            setParsedResumeData(data.parsedResumeData || null);
            const jobDesc = data.jobDescription || {
                title: data.jobTitle || '',
                description: data.jobDescriptionText || data.jobDescription || '',
                company: data.companyName || '',
            };
            setJobDescription(jobDesc);
            
            // Extract resume text for re-analysis if needed
            if (data.resumePath) {
                try {
                    const resumeBlob = await fileStorage.read(data.resumePath);
                    if (resumeBlob) {
                        const pdfFile = new File([resumeBlob], 'resume.pdf', { type: 'application/pdf' });
                        const text = await extractTextFromPdf(pdfFile);
                        setResumeText(text);
                        
                        // If we have resume text, parsed data, and job description but no feedback, run analysis
                        if (text && data.parsedResumeData && jobDesc.description && jobDesc.description.trim() !== '' && !data.feedback) {
                            console.log('🔄 Running analysis automatically...');
                            try {
                                const newFeedback = await analyzeResumeWithGemini(text, jobDesc);
                                if (newFeedback) {
                                    setFeedback(newFeedback);
                                    // Save updated feedback
                                    const updatedData = { ...data, feedback: newFeedback };
                                    await storage.set(`resume:${id}`, JSON.stringify(updatedData));
                                }
                            } catch (err) {
                                console.error('Error running automatic analysis:', err);
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error extracting resume text:', err);
                }
            }
            
            setIsLoadingResume(false);
            console.log({resumeUrl, imageUrl, feedback: data.feedback });
        }

        loadResume();
    }, [id]);

    const extractJobDescriptionText = async (jdFile: File | null, jdText: string): Promise<string> => {
        if (jdFile) {
            const fileName = jdFile.name.toLowerCase();
            if (fileName.endsWith('.pdf')) {
                return await extractTextFromPdf(jdFile);
            } else {
                try {
                    return await jdFile.text();
                } catch (err) {
                    console.error('Error reading JD file:', err);
                    return jdText;
                }
            }
        }
        return jdText;
    };

    const handleJDSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        
        const companyName = formData.get('company-name') as string;
        const jobTitle = formData.get('job-title') as string;
        const jobDescriptionText = formData.get('job-description') as string;

        setIsAnalyzing(true);

        try {
            const jdText = await extractJobDescriptionText(jdFile, jobDescriptionText);
            
            const jobDesc: JobDescription = {
                title: jobTitle,
                description: jdText,
                company: companyName,
            };

            setJobDescription(jobDesc);

            // Re-analyze with new job description if we have resume text
            if (resumeText && parsedResumeData) {
                console.log('🔍 Re-analyzing resume - Using Hugging Face API (NOT puter.com)');
                const newFeedback = await analyzeResumeWithGemini(resumeText, jobDesc);
                if (newFeedback) {
                    setFeedback(newFeedback);
                    
                    // Calculate ATS scores
                    const atsScore = calculateATSScore(parsedResumeData);
                    const keywordMatch = calculateJDMatch(parsedResumeData, jobDesc);
                    const contentStrength = calculateContentStrength(parsedResumeData);
                    const overallScore = calculateOverallResumeScore(atsScore, keywordMatch.score, contentStrength, 85); // Assuming 85% length score
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
                        lengthScore: 85, // You can calculate this if needed
                        missingSkills: missingSkills,
                        overusedWords: overusedWords.map(w => w.word),
                        analyzedAt: Timestamp.now()
                    });
                    
                    // Save updated data
                    const resume = await storage.get(`resume:${id}`);
                    if (resume) {
                        const data = JSON.parse(resume);
                        data.feedback = newFeedback;
                        data.jobDescription = jobDesc;
                        data.companyName = companyName;
                        data.jobTitle = jobTitle;
                        data.jobDescriptionText = jdText;
                        await storage.set(`resume:${id}`, JSON.stringify(data));
                    }
                }
            }

            setShowJDForm(false);
        } catch (error) {
            console.error('Error analyzing with job description:', error);
            alert('Error analyzing resume. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <main className="!pt-0">
            <nav className="resume-nav">
                <Link to="/" className="back-button">
                    <img src="/icons/back.svg" alt="logo" className="w-2.5 h-2.5" />
                    <span className="text-gray-800 text-sm font-semibold">Back to Homepage</span>
                </Link>
            </nav>
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h2 className="text-4xl !text-black font-bold mb-8">Resume Review</h2>
                {showJDForm ? (
                        <div className="flex flex-col gap-6 w-full max-w-2xl">
                            <div className="bg-white rounded-2xl shadow-md p-6">
                                <h3 className="text-2xl font-bold mb-4">Add Job Description for ATS Match</h3>
                                <p className="text-gray-600 mb-6">
                                    Provide the job description to get a detailed ATS match analysis and keyword recommendations.
                                </p>
                                {isAnalyzing ? (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <img src="/images/resume-scan-2.gif" className="w-full max-w-md" />
                                        <p className="text-gray-600 mt-4">Analyzing resume with job description...</p>
                                    </div>
                                ) : (
                                    <form onSubmit={handleJDSubmit} className="flex flex-col gap-4">
                                        <div className="form-div">
                                            <label htmlFor="jd-company-name">Company Name</label>
                                            <input 
                                                type="text" 
                                                name="company-name" 
                                                placeholder="Company Name" 
                                                id="jd-company-name"
                                                defaultValue={jobDescription?.company || ''}
                                            />
                                        </div>
                                        <div className="form-div">
                                            <label htmlFor="jd-job-title">Job Title</label>
                                            <input 
                                                type="text" 
                                                name="job-title" 
                                                placeholder="Job Title" 
                                                id="jd-job-title"
                                                defaultValue={jobDescription?.title || ''}
                                            />
                                        </div>
                                        <div className="form-div">
                                            <label htmlFor="jd-job-description">Job Description</label>
                                            <textarea 
                                                rows={8} 
                                                name="job-description" 
                                                placeholder="Paste job description here, or upload a file below" 
                                                id="jd-job-description"
                                                defaultValue={jobDescription?.description || ''}
                                            />
                                        </div>
                                        <div className="form-div">
                                            <label htmlFor="jd-uploader">Upload Job Description (PDF, DOCX, or TXT) - Optional</label>
                                            <FileUploader 
                                                onFileSelect={(file) => setJdFile(file)} 
                                                accept=".pdf,.docx,.doc,.txt" 
                                            />
                                            {jdFile && (
                                                <p className="text-sm text-gray-600 mt-2">Selected: {jdFile.name}</p>
                                            )}
                                        </div>
                                        <div className="flex gap-3">
                                            <button 
                                                type="submit" 
                                                className="primary-button flex-1 py-3 px-6"
                                                disabled={isAnalyzing}
                                            >
                                                {isAnalyzing ? 'Analyzing...' : 'Analyze with Job Description'}
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    setShowJDForm(false);
                                                }}
                                                className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg px-6 py-3 font-semibold"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>
                ) : isLoadingResume ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <img src="/images/resume-scan-2.gif" className="w-full max-w-md" />
                        <p className="text-gray-600 mt-4">Loading resume analysis...</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-8 animate-in fade-in duration-1000">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-bold">ATS Analysis</h3>
                            {(!jobDescription || !jobDescription.description || jobDescription.description.trim() === '') && (
                                <button
                                    onClick={() => setShowJDForm(true)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-semibold"
                                >
                                    + Add Job Description
                                </button>
                            )}
                            {jobDescription && jobDescription.description && jobDescription.description.trim() !== '' && (
                                <button
                                    onClick={() => setShowJDForm(true)}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg px-4 py-2 text-sm font-semibold"
                                >
                                    Update Job Description
                                </button>
                            )}
                        </div>
                        {feedback && <Summary feedback={feedback} />}
                        {parsedResumeData ? (
                            <>
                                {jobDescription && jobDescription.description && jobDescription.description.trim() !== '' ? (
                                    <EnhancedATS 
                                        resumeData={parsedResumeData} 
                                        jobDescription={jobDescription}
                                        onResumeUpdate={(updated) => {
                                            setParsedResumeData(updated);
                                            // Optionally save updated resume data
                                        }}
                                    />
                                ) : (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
                                        <h3 className="text-xl font-bold mb-2 text-yellow-800">⚠️ Job Description Required</h3>
                                        <p className="text-gray-700 mb-4">
                                            Add a job description to get detailed ATS match analysis, keyword recommendations, and missing skills alerts.
                                        </p>
                                        <button
                                            onClick={() => setShowJDForm(true)}
                                            className="primary-button"
                                        >
                                            Add Job Description
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-2 text-red-800">⚠️ Resume Data Not Available</h3>
                                <p className="text-gray-700 mb-4">
                                    Unable to load resume data. Please try uploading the resume again.
                                </p>
                                <button
                                    onClick={() => navigate('/upload')}
                                    className="primary-button"
                                >
                                    Upload Resume
                                </button>
                            </div>
                        )}
                        {feedback && <Details feedback={feedback} />}
                    </div>
                )}
            </div>
        </main>
    )
}
export default Resume
