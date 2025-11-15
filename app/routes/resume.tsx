import {Link, useNavigate, useParams} from "react-router";
import {useEffect, useState} from "react";
import {usePuterStore} from "~/lib/puter";
import Summary from "~/components/Summary";
import ATS from "~/components/ATS";
import Details from "~/components/Details";

export const meta = () => ([
    { title: 'Resumind | Review ' },
    { name: 'description', content: 'Detailed overview of your resume' },
])

const Resume = () => {
    const { auth, isLoading, fs, kv } = usePuterStore();
    const { id } = useParams();
    const [imageUrl, setImageUrl] = useState('');
    const [resumeUrl, setResumeUrl] = useState('');
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [showATSReview, setShowATSReview] = useState(false);
    const [isLoadingResume, setIsLoadingResume] = useState(true);
    const navigate = useNavigate();

    // Hardcode authentication on initial load to prevent login page
    useEffect(() => {
        if(!auth.isAuthenticated) {
            auth.setHardcodedAuth({
                uuid: 'hardcoded-user-uuid-12345',
                username: 'demo-user'
            });
        }
    }, [])

    useEffect(() => {
        const loadResume = async () => {
            setIsLoadingResume(true);
            const resume = await kv.get(`resume:${id}`);

            if(!resume) {
                setIsLoadingResume(false);
                return;
            }

            const data = JSON.parse(resume);

            const resumeBlob = await fs.read(data.resumePath);
            if(!resumeBlob) {
                setIsLoadingResume(false);
                return;
            }

            const pdfBlob = new Blob([resumeBlob], { type: 'application/pdf' });
            const resumeUrl = URL.createObjectURL(pdfBlob);
            setResumeUrl(resumeUrl);

            const imageBlob = await fs.read(data.imagePath);
            if(!imageBlob) {
                setIsLoadingResume(false);
                return;
            }
            const imageUrl = URL.createObjectURL(imageBlob);
            setImageUrl(imageUrl);

            setFeedback(data.feedback);
            setIsLoadingResume(false);
            console.log({resumeUrl, imageUrl, feedback: data.feedback });
        }

        loadResume();
    }, [id]);

    return (
        <main className="!pt-0">
            <nav className="resume-nav">
                <Link to="/" className="back-button">
                    <img src="/icons/back.svg" alt="logo" className="w-2.5 h-2.5" />
                    <span className="text-gray-800 text-sm font-semibold">Back to Homepage</span>
                </Link>
            </nav>
            <div className="flex flex-row w-full max-lg:flex-col-reverse">
                <section className="feedback-section bg-[url('/images/bg-small.svg') bg-cover h-[100vh] sticky top-0 items-center justify-center">
                    {imageUrl && resumeUrl && (
                        <div className="animate-in fade-in duration-1000 gradient-border max-sm:m-0 h-[90%] max-wxl:h-fit w-fit">
                            <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
                                <img
                                    src={imageUrl}
                                    className="w-full h-full object-contain rounded-2xl"
                                    title="resume"
                                />
                            </a>
                        </div>
                    )}
                </section>
                <section className="feedback-section">
                    <h2 className="text-4xl !text-black font-bold mb-8">Resume Review</h2>
                    {!showATSReview ? (
                        <div className="flex flex-col gap-6 items-center justify-center py-12 min-h-[400px] w-full">
                            <div className="flex flex-col gap-4 w-full max-w-md">
                                <button
                                    onClick={() => navigate('/upload')}
                                    className="primary-button text-xl font-semibold py-4 px-8 text-center flex items-center justify-center"
                                    type="button"
                                >
                                    Create Resume
                                </button>
                                <button
                                    onClick={() => setShowATSReview(true)}
                                    className="primary-button text-xl font-semibold py-4 px-8 text-center flex items-center justify-center"
                                    type="button"
                                >
                                    Review ATS
                                </button>
                            </div>
                        </div>
                    ) : isLoadingResume || !feedback ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <img src="/images/resume-scan-2.gif" className="w-full max-w-md" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8 animate-in fade-in duration-1000">
                            <Summary feedback={feedback} />
                            <ATS score={feedback.ATS.score || 0} suggestions={feedback.ATS.tips || []} />
                            <Details feedback={feedback} />
                        </div>
                    )}
                </section>
            </div>
        </main>
    )
}
export default Resume
