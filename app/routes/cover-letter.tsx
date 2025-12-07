import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import Navbar from '~/components/Navbar';
import { generateCoverLetter, parseResumeWithGemini, type ParsedResumeData, type JobDescription } from '~/lib/ai-features';
import { extractTextFromPdf } from '~/lib/pdf2img';
import { usePuterStore } from '~/lib/puter';
import FileUploader from '~/components/FileUploader';

export const meta = () => ([
    { title: 'Resumind | Cover Letter Generator' },
    { name: 'description', content: 'Generate a professional cover letter with AI in minutes' },
]);

const CoverLetter = () => {
    const navigate = useNavigate();
    const { kv } = usePuterStore();
    const [isGenerating, setIsGenerating] = useState(false);
    const [coverLetter, setCoverLetter] = useState<string>('');
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [resumeData, setResumeData] = useState<ParsedResumeData | null>(null);

    const handleResumeUpload = async (file: File | null) => {
        setResumeFile(file);
        if (file) {
            try {
                const resumeText = await extractTextFromPdf(file);
                const parsed = await parseResumeWithGemini(resumeText);
                if (parsed) {
                    setResumeData(parsed);
                }
            } catch (error) {
                console.error('Error parsing resume:', error);
                alert('Error parsing resume. Please try again.');
            }
        }
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);

        const companyName = formData.get('company-name') as string;
        const jobTitle = formData.get('job-title') as string;
        const jobDescription = formData.get('job-description') as string;
        const requirements = formData.get('requirements') as string;

        if (!resumeData) {
            alert('Please upload your resume first');
            return;
        }

        if (!jobTitle || !jobDescription) {
            alert('Please fill in job title and job description');
            return;
        }

        setIsGenerating(true);

        try {
            const jobDesc: JobDescription = {
                title: jobTitle,
                description: `${jobDescription}\n\nRequirements:\n${requirements || 'Not specified'}`,
                company: companyName,
            };

            const letter = await generateCoverLetter(resumeData, jobDesc);
            if (letter) {
                setCoverLetter(letter);
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
        <main className="bg-white min-h-screen">
            <div className="sticky top-0 z-50 bg-gray-100 w-full">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <Navbar />
                </div>
            </div>
            
            <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                        Create a Cover Letter with AI in Minutes
                    </h1>
                    <p className="text-xl text-gray-600">
                        Generate a personalized cover letter tailored to your resume and job requirements
                    </p>
                </div>

                {!coverLetter ? (
                    <div className="bg-white rounded-2xl shadow-lg p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Resume Upload */}
                            <div>
                                <label htmlFor="resume-upload" className="block text-lg font-semibold text-gray-900 mb-3">
                                    Upload Your Resume (PDF)
                                </label>
                                <FileUploader onFileSelect={handleResumeUpload} accept=".pdf" />
                                {resumeData && (
                                    <p className="text-sm text-green-600 mt-2">✓ Resume parsed successfully</p>
                                )}
                            </div>

                            {/* Company Name */}
                            <div>
                                <label htmlFor="company-name" className="block text-lg font-semibold text-gray-900 mb-2">
                                    Company Name
                                </label>
                                <input
                                    type="text"
                                    name="company-name"
                                    id="company-name"
                                    placeholder="e.g., Google, Amazon, Microsoft"
                                    className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* Job Title */}
                            <div>
                                <label htmlFor="job-title" className="block text-lg font-semibold text-gray-900 mb-2">
                                    Job Title *
                                </label>
                                <input
                                    type="text"
                                    name="job-title"
                                    id="job-title"
                                    placeholder="e.g., Software Engineer, Product Manager"
                                    required
                                    className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* Job Description */}
                            <div>
                                <label htmlFor="job-description" className="block text-lg font-semibold text-gray-900 mb-2">
                                    Job Description *
                                </label>
                                <textarea
                                    name="job-description"
                                    id="job-description"
                                    rows={6}
                                    placeholder="Paste the job description here..."
                                    required
                                    className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* Requirements */}
                            <div>
                                <label htmlFor="requirements" className="block text-lg font-semibold text-gray-900 mb-2">
                                    Key Requirements (Optional)
                                </label>
                                <textarea
                                    name="requirements"
                                    id="requirements"
                                    rows={4}
                                    placeholder="List key requirements, skills, or qualifications..."
                                    className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isGenerating || !resumeData}
                                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-lg px-6 py-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                            >
                                {isGenerating ? 'Generating Cover Letter...' : 'Generate Cover Letter'}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Generated Cover Letter */}
                        <div className="bg-white rounded-2xl shadow-lg p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">Your Cover Letter</h2>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleDownload}
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition-colors"
                                    >
                                        Download
                                    </button>
                                    <button
                                        onClick={() => setCoverLetter('')}
                                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                                    >
                                        Generate New
                                    </button>
                                </div>
                            </div>
                            <div className="prose max-w-none">
                                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed p-6 bg-gray-50 rounded-lg border-2 border-gray-200">
                                    {coverLetter}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
};

export default CoverLetter;

