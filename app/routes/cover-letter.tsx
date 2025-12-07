import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import Navbar from '~/components/Navbar';
import { generateCoverLetter, parseResumeWithGemini, type ParsedResumeData, type JobDescription } from '~/lib/ai-features';
import { extractTextFromPdf } from '~/lib/pdf2img';
import FileUploader from '~/components/FileUploader';

export const meta = () => ([
    { title: 'Resumind | Cover Letter Generator' },
    { name: 'description', content: 'Generate a professional cover letter with AI in minutes' },
]);

const CoverLetter = () => {
    const navigate = useNavigate();
    const [isGenerating, setIsGenerating] = useState(false);
    const [coverLetter, setCoverLetter] = useState<string>('');
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [resumeData, setResumeData] = useState<ParsedResumeData | null>(null);

    const handleResumeUpload = (file: File | null) => {
        setResumeFile(file);
        // Don't parse resume here - wait for generate button click
        setResumeData(null);
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);

        const companyName = formData.get('company-name') as string;
        const jobTitle = formData.get('job-title') as string;
        const jobDescription = formData.get('job-description') as string;
        const requirements = formData.get('requirements') as string;

        if (!resumeFile) {
            alert('Please upload your resume first');
            return;
        }

        if (!jobTitle || !jobDescription) {
            alert('Please fill in job title and job description');
            return;
        }

        setIsGenerating(true);

        try {
            // Step 1: Parse resume (API call)
            const resumeText = await extractTextFromPdf(resumeFile);
            const parsed = await parseResumeWithGemini(resumeText);
            
            if (!parsed) {
                alert('Error parsing resume. Please try again.');
                setIsGenerating(false);
                return;
            }

            // Step 2: Generate cover letter (API call)
            const jobDesc: JobDescription = {
                title: jobTitle,
                description: `${jobDescription}\n\nRequirements:\n${requirements || 'Not specified'}`,
                company: companyName,
            };

            const letter = await generateCoverLetter(parsed, jobDesc);
            if (letter) {
                setCoverLetter(letter);
                setResumeData(parsed); // Store parsed data for future use
            } else {
                alert('Error generating cover letter. Please check your API key and try again.');
            }
        } catch (error) {
            console.error('Error generating cover letter:', error);
            alert('Error generating cover letter. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!coverLetter) return;
        
        const blob = new Blob([coverLetter], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cover-letter.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover min-h-screen">
            <div className="sticky top-0 z-50 bg-gray-100 w-full">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <Navbar />
                </div>
            </div>
            
            <section className="main-section">
                <div className="page-heading py-8 md:py-16 px-4">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl break-words">Create a Cover Letter with AI in Minutes</h1>
                    {isGenerating ? (
                        <>
                            <h2 className="text-base sm:text-lg md:text-xl mt-4 px-2">Generating your personalized cover letter...</h2>
                            <img src="/images/resume-scan-2.gif" className="w-full max-w-md mx-auto mt-8" alt="Generating cover letter" />
                        </>
                    ) : coverLetter ? (
                        <h2 className="text-base sm:text-lg md:text-xl mt-4 px-2">Your personalized cover letter is ready</h2>
                    ) : (
                        <h2 className="text-base sm:text-lg md:text-xl mt-4 px-2 text-center">Generate a personalized cover letter tailored to your resume and job requirements</h2>
                    )}
                    
                    {!isGenerating && !coverLetter && (
                        <form id="cover-letter-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8 w-full px-4 sm:px-0">
                            {/* Company Name */}
                            <div className="form-div">
                                <label htmlFor="company-name">
                                    Company Name
                                </label>
                                <input
                                    type="text"
                                    name="company-name"
                                    id="company-name"
                                    placeholder="Company Name"
                                />
                            </div>

                            {/* Job Title */}
                            <div className="form-div">
                                <label htmlFor="job-title">
                                    Job Title *
                                </label>
                                <input
                                    type="text"
                                    name="job-title"
                                    id="job-title"
                                    placeholder="Job Title"
                                    required
                                />
                            </div>

                            {/* Job Description */}
                            <div className="form-div">
                                <label htmlFor="job-description">
                                    Job Description *
                                </label>
                                <textarea
                                    name="job-description"
                                    id="job-description"
                                    rows={5}
                                    placeholder="Paste job description here"
                                    required
                                />
                            </div>

                            {/* Requirements */}
                            <div className="form-div">
                                <label htmlFor="requirements">
                                    Key Requirements (Optional)
                                </label>
                                <textarea
                                    name="requirements"
                                    id="requirements"
                                    rows={4}
                                    placeholder="List key requirements, skills, or qualifications..."
                                />
                            </div>

                            {/* Resume Upload - Moved to end */}
                            <div className="form-div">
                                <label htmlFor="resume-upload">
                                    Upload Your Resume (PDF)
                                </label>
                                <FileUploader onFileSelect={handleResumeUpload} accept=".pdf" />
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isGenerating || !resumeFile}
                                className={`primary-button ${!resumeFile ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                Generate Cover Letter
                            </button>
                        </form>
                    )}
                    
                    {coverLetter && (
                        <div className="w-full mt-8 px-4 sm:px-0">
                            {/* Generated Cover Letter Card */}
                            <div className="bg-white rounded-2xl shadow-lg p-4 md:p-8">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">Your Cover Letter</h2>
                                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                        <button
                                            onClick={handleDownload}
                                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition-colors w-full sm:w-auto"
                                        >
                                            Download
                                        </button>
                                        <button
                                            onClick={() => setCoverLetter('')}
                                            className="primary-button w-full sm:w-auto"
                                        >
                                            Generate New
                                        </button>
                                    </div>
                                </div>
                                <div className="prose max-w-none">
                                    <div className="whitespace-pre-wrap text-gray-700 leading-relaxed p-4 md:p-6 bg-gray-50 rounded-lg border-2 border-gray-200 text-sm md:text-base">
                                        {coverLetter}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
};

export default CoverLetter;

