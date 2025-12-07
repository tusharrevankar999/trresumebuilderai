import { useState } from 'react';
import Navbar from '~/components/Navbar';
import { getResumeRecords, getATSAnalysisRecords, getCoverLetterRecords, getErrorLogs, type ResumeRecord, type ATSAnalysisRecord, type CoverLetterRecord, type ErrorLogRecord } from '~/lib/firebase';

export const meta = () => ([
    { title: 'ResumeAI | Admin Dashboard' },
    { name: 'description', content: 'Admin dashboard for viewing all records' },
]);

type ViewType = 'home' | 'resumes' | 'ats' | 'cover-letters' | 'error-logs';

const Tradmin = () => {
    const [currentView, setCurrentView] = useState<ViewType>('home');
    const [resumeRecords, setResumeRecords] = useState<(ResumeRecord & { id: string })[]>([]);
    const [atsRecords, setAtsRecords] = useState<(ATSAnalysisRecord & { id: string })[]>([]);
    const [coverLetterRecords, setCoverLetterRecords] = useState<(CoverLetterRecord & { id: string })[]>([]);
    const [errorLogs, setErrorLogs] = useState<(ErrorLogRecord & { id: string })[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 10;

    const handleViewResumes = async () => {
        setCurrentView('resumes');
        setCurrentPage(1);
        if (resumeRecords.length === 0) {
            setLoading(true);
            const records = await getResumeRecords();
            setResumeRecords(records);
            setLoading(false);
        }
    };

    const handleViewATS = async () => {
        setCurrentView('ats');
        setCurrentPage(1);
        if (atsRecords.length === 0) {
            setLoading(true);
            const records = await getATSAnalysisRecords();
            setAtsRecords(records as (ATSAnalysisRecord & { id: string })[]);
            setLoading(false);
        }
    };

    const handleViewCoverLetters = async () => {
        setCurrentView('cover-letters');
        setCurrentPage(1);
        if (coverLetterRecords.length === 0) {
            setLoading(true);
            const records = await getCoverLetterRecords();
            setCoverLetterRecords(records as (CoverLetterRecord & { id: string })[]);
            setLoading(false);
        }
    };

    const handleViewErrorLogs = async () => {
        setCurrentView('error-logs');
        setCurrentPage(1);
        if (errorLogs.length === 0) {
            setLoading(true);
            const records = await getErrorLogs();
            setErrorLogs(records as (ErrorLogRecord & { id: string })[]);
            setLoading(false);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        if (timestamp.toDate) {
            return timestamp.toDate().toLocaleString();
        }
        if (timestamp.seconds) {
            return new Date(timestamp.seconds * 1000).toLocaleString();
        }
        return new Date(timestamp).toLocaleString();
    };

    // Pagination helpers
    const getCurrentResumeRecords = () => {
        const startIndex = (currentPage - 1) * recordsPerPage;
        const endIndex = startIndex + recordsPerPage;
        return resumeRecords.slice(startIndex, endIndex);
    };

    const getCurrentATSRecords = () => {
        const startIndex = (currentPage - 1) * recordsPerPage;
        const endIndex = startIndex + recordsPerPage;
        return atsRecords.slice(startIndex, endIndex);
    };

    const getCurrentCoverLetterRecords = () => {
        const startIndex = (currentPage - 1) * recordsPerPage;
        const endIndex = startIndex + recordsPerPage;
        return coverLetterRecords.slice(startIndex, endIndex);
    };

    const getCurrentErrorLogs = () => {
        const startIndex = (currentPage - 1) * recordsPerPage;
        const endIndex = startIndex + recordsPerPage;
        return errorLogs.slice(startIndex, endIndex);
    };

    const getTotalPages = () => {
        const totalRecords = 
            currentView === 'resumes' ? resumeRecords.length :
            currentView === 'ats' ? atsRecords.length :
            currentView === 'cover-letters' ? coverLetterRecords.length :
            errorLogs.length;
        return Math.ceil(totalRecords / recordsPerPage);
    };

    const totalPages = getTotalPages();

    if (currentView === 'home') {
        return (
            <main className="bg-[url('/images/bg-main.svg')] bg-cover min-h-screen pt-0">
                <div className="sticky top-0 z-50 bg-gray-100 w-full">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                        <Navbar />
                    </div>
                </div>
                
                {/* Hero Section */}
                <section className="relative overflow-hidden pt-20 pb-32">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center">
                            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
                                <span className="text-black">Admin Dashboard</span>
                            </h1>
                            <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
                                View and manage all resume, ATS analysis, and cover letter records
                            </p>
                        </div>
                    </div>
                </section>

                {/* Feature Cards */}
                <section className="py-20 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Check AI Resume Records Card */}
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
                                <div className="flex items-center justify-center w-16 h-16 bg-blue-500 rounded-full mb-6">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-4">Check AI Resume Records</h3>
                                <p className="text-gray-600 mb-6">
                                    View all resume records created by users through the AI resume builder.
                                </p>
                                <button
                                    onClick={handleViewResumes}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                                >
                                    View Records
                                </button>
                            </div>

                            {/* Check ATS Records Card */}
                            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
                                <div className="flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-6">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-4">Check ATS Records</h3>
                                <p className="text-gray-600 mb-6">
                                    View all ATS analysis records with scores, keyword matches, and improvement suggestions.
                                </p>
                                <button
                                    onClick={handleViewATS}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                                >
                                    View Records
                                </button>
                            </div>

                            {/* Check Cover Letter Records Card */}
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
                                <div className="flex items-center justify-center w-16 h-16 bg-purple-500 rounded-full mb-6">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-4">Check Cover Letter Records</h3>
                                <p className="text-gray-600 mb-6">
                                    View all cover letters generated by users with AI assistance.
                                </p>
                                <button
                                    onClick={handleViewCoverLetters}
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                                >
                                    View Records
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover min-h-screen">
            <div className="sticky top-0 z-50 bg-gray-100 w-full">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <Navbar />
                </div>
            </div>
            
            <section className="main-section">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setCurrentView('home')}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition-colors"
                            >
                                ← Back to Dashboard
                            </button>
                            {currentView !== 'error-logs' && (
                                <button
                                    onClick={handleViewErrorLogs}
                                    className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                                >
                                    Error Log
                                </button>
                            )}
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900">
                            {currentView === 'resumes' && 'Resume Records'}
                            {currentView === 'ats' && 'ATS Analysis Records'}
                            {currentView === 'cover-letters' && 'Cover Letter Records'}
                            {currentView === 'error-logs' && 'Error Logs'}
                        </h2>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <img src="/images/resume-scan-2.gif" className="w-full max-w-md" />
                            <p className="text-gray-600 mt-4">Loading records...</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-white rounded-2xl shadow-lg p-6 overflow-x-auto">
                                {currentView === 'resumes' && (
                                    <>
                                        <div className="mb-4 text-sm text-gray-600">
                                            Showing {((currentPage - 1) * recordsPerPage) + 1} to {Math.min(currentPage * recordsPerPage, resumeRecords.length)} of {resumeRecords.length} records
                                        </div>
                                        <table className="w-full text-left">
                                            <thead>
                                        <tr className="border-b-2 border-gray-200">
                                            <th className="p-3 font-semibold">Name</th>
                                            <th className="p-3 font-semibold">Email</th>
                                            <th className="p-3 font-semibold">Template</th>
                                            <th className="p-3 font-semibold">Format</th>
                                            <th className="p-3 font-semibold">Downloaded</th>
                                            <th className="p-3 font-semibold">Created At</th>
                                            <th className="p-3 font-semibold">Downloaded At</th>
                                        </tr>
                                            </thead>
                                            <tbody>
                                        {resumeRecords.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-6 text-center text-gray-500">No records found</td>
                                            </tr>
                                                ) : (
                                                    getCurrentResumeRecords().map((record) => (
                                                        <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                            <td className="p-3">{record.fullName || 'N/A'}</td>
                                                            <td className="p-3">{record.email || 'N/A'}</td>
                                                            <td className="p-3">{record.template || 'N/A'}</td>
                                                            <td className="p-3">{record.exportFormat || 'N/A'}</td>
                                                            <td className="p-3">
                                                                {record.downloaded ? (
                                                                    <span className="text-green-600 font-semibold">Yes</span>
                                                                ) : (
                                                                    <span className="text-gray-500">No</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3">{formatDate(record.createdAt)}</td>
                                                            <td className="p-3">{formatDate(record.downloadedAt)}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </>
                                )}

                                {currentView === 'ats' && (
                                    <>
                                        <div className="mb-4 text-sm text-gray-600">
                                            Showing {((currentPage - 1) * recordsPerPage) + 1} to {Math.min(currentPage * recordsPerPage, atsRecords.length)} of {atsRecords.length} records
                                        </div>
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b-2 border-gray-200">
                                                    <th className="p-3 font-semibold">Name</th>
                                                    <th className="p-3 font-semibold">Email</th>
                                                    <th className="p-3 font-semibold">Job Title</th>
                                                    <th className="p-3 font-semibold">Company</th>
                                                    <th className="p-3 font-semibold">Overall Score</th>
                                                    <th className="p-3 font-semibold">ATS Score</th>
                                                    <th className="p-3 font-semibold">Keyword Match</th>
                                                    <th className="p-3 font-semibold">Analyzed At</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {atsRecords.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={8} className="p-6 text-center text-gray-500">No records found</td>
                                                    </tr>
                                                ) : (
                                                    getCurrentATSRecords().map((record) => (
                                                        <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                            <td className="p-3">{record.fullName || 'N/A'}</td>
                                                            <td className="p-3">{record.email || 'N/A'}</td>
                                                            <td className="p-3">{record.jobTitle || 'N/A'}</td>
                                                            <td className="p-3">{record.companyName || 'N/A'}</td>
                                                            <td className="p-3 font-semibold">{record.overallScore?.toFixed(1) || 'N/A'}%</td>
                                                            <td className="p-3">{record.atsCompatibility?.toFixed(1) || 'N/A'}%</td>
                                                            <td className="p-3">{record.keywordMatch?.toFixed(1) || 'N/A'}%</td>
                                                            <td className="p-3">{formatDate(record.analyzedAt)}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </>
                                )}

                                {currentView === 'cover-letters' && (
                                    <>
                                        <div className="mb-4 text-sm text-gray-600">
                                            Showing {((currentPage - 1) * recordsPerPage) + 1} to {Math.min(currentPage * recordsPerPage, coverLetterRecords.length)} of {coverLetterRecords.length} records
                                        </div>
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b-2 border-gray-200">
                                                    <th className="p-3 font-semibold">Name</th>
                                                    <th className="p-3 font-semibold">Email</th>
                                                    <th className="p-3 font-semibold">Job Title</th>
                                                    <th className="p-3 font-semibold">Company</th>
                                                    <th className="p-3 font-semibold">Cover Letter Preview</th>
                                                    <th className="p-3 font-semibold">Generated At</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {coverLetterRecords.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="p-6 text-center text-gray-500">No records found</td>
                                                    </tr>
                                                ) : (
                                                    getCurrentCoverLetterRecords().map((record) => (
                                                        <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                            <td className="p-3">{record.fullName || 'N/A'}</td>
                                                            <td className="p-3">{record.email || 'N/A'}</td>
                                                            <td className="p-3">{record.jobTitle || 'N/A'}</td>
                                                            <td className="p-3">{record.companyName || 'N/A'}</td>
                                                            <td className="p-3 max-w-md">
                                                                <div className="truncate text-sm text-gray-600">
                                                                    {record.coverLetter ? record.coverLetter.substring(0, 100) + '...' : 'N/A'}
                                                                </div>
                                                            </td>
                                                            <td className="p-3">{formatDate(record.generatedAt)}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </>
                                )}

                                {currentView === 'error-logs' && (
                                    <>
                                        <div className="mb-4 text-sm text-gray-600">
                                            Showing {((currentPage - 1) * recordsPerPage) + 1} to {Math.min(currentPage * recordsPerPage, errorLogs.length)} of {errorLogs.length} records
                                        </div>
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b-2 border-gray-200">
                                                    <th className="p-3 font-semibold">Error Type</th>
                                                    <th className="p-3 font-semibold">Error Message</th>
                                                    <th className="p-3 font-semibold">Page</th>
                                                    <th className="p-3 font-semibold">Action</th>
                                                    <th className="p-3 font-semibold">Context</th>
                                                    <th className="p-3 font-semibold">Timestamp</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {errorLogs.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="p-6 text-center text-gray-500">No error logs found</td>
                                                    </tr>
                                                ) : (
                                                    getCurrentErrorLogs().map((record) => (
                                                        <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                            <td className="p-3">
                                                                <span className="text-red-600 font-semibold">{record.errorType || 'N/A'}</span>
                                                            </td>
                                                            <td className="p-3 max-w-md">
                                                                <div className="truncate text-sm text-gray-700" title={record.errorMessage}>
                                                                    {record.errorMessage ? (record.errorMessage.length > 100 ? record.errorMessage.substring(0, 100) + '...' : record.errorMessage) : 'N/A'}
                                                                </div>
                                                            </td>
                                                            <td className="p-3 text-sm">{record.context?.page || 'N/A'}</td>
                                                            <td className="p-3 text-sm">{record.context?.action || 'N/A'}</td>
                                                            <td className="p-3 max-w-xs">
                                                                <div className="truncate text-xs text-gray-600" title={JSON.stringify(record.context || {})}>
                                                                    {record.context ? JSON.stringify(record.context).substring(0, 80) + '...' : 'N/A'}
                                                                </div>
                                                            </td>
                                                            <td className="p-3 text-sm">{formatDate(record.timestamp)}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </>
                                )}
                            </div>
                            
                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-2 mt-6">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-4 py-2 text-gray-700">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>
        </main>
    );
};

export default Tradmin;

