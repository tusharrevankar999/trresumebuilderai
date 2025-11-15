import type { Route } from "./+types/home";
import Navbar from "~/components/Navbar";
import ResumeCard from "~/components/ResumeCard";
import {usePuterStore} from "~/lib/puter";
import {Link, useNavigate} from "react-router";
import {useEffect, useState} from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Resumind" },
    { name: "description", content: "Smart feedback for your dream job!" },
  ];
}

export default function Home() {
  const { auth, kv } = usePuterStore();
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [showATSReview, setShowATSReview] = useState(false);

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
    const loadResumes = async () => {
      setLoadingResumes(true);

      const resumes = (await kv.list('resume:*', true)) as KVItem[];

      const parsedResumes = resumes?.map((resume) => (
          JSON.parse(resume.value) as Resume
      ))

      setResumes(parsedResumes || []);
      setLoadingResumes(false);
    }

    loadResumes()
  }, []);

  return <main className="bg-[url('/images/bg-main.svg')] bg-cover">
    <Navbar />

    <section className="main-section">
      {!showATSReview ? (
        <>
          <div className="page-heading py-16">
            <h1><span className="!text-black !bg-clip-border" style={{color: '#000000'}}>Build Professional Resumes with </span><span className="text-gradient">AI Assistance</span></h1>
            <h2>Create ATS-optimized resumes that get you noticed by top companies like Amazon, Google, and Microsoft. AI-powered suggestions help you craft perfect bullet points and summaries.</h2>
          </div>
          <div className="flex flex-col items-center justify-center gap-4 mt-8">
            <button
              onClick={() => navigate('/builder')}
              className="primary-button w-fit text-xl font-semibold py-4 px-8 text-center"
              type="button"
            >
              Start Building Resume
            </button>
            <button
              onClick={() => setShowATSReview(true)}
              className="primary-button w-fit text-xl font-semibold py-4 px-8 text-center"
              type="button"
            >
              Review ATS
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="page-heading py-16">
            <h1>Track Your Applications & Resume Ratings</h1>
            <h2>Review your submissions and check AI-powered feedback.</h2>
          </div>
          {loadingResumes && (
              <div className="flex flex-col items-center justify-center">
                <img src="/images/resume-scan-2.gif" className="w-[200px]" />
              </div>
          )}

          {!loadingResumes && resumes.length > 0 && (
            <div className="resumes-section">
              {resumes.map((resume) => (
                  <ResumeCard key={resume.id} resume={resume} />
              ))}
            </div>
          )}

          {!loadingResumes && resumes?.length === 0 && (
              <div className="flex flex-col items-center justify-center mt-10 gap-4">
                <Link to="/upload" className="primary-button w-fit text-xl font-semibold">
                  Upload Resume
                </Link>
              </div>
          )}
        </>
      )}
    </section>
  </main>
}
