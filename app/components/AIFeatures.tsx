import { useState } from 'react';
import {
    generateSummary,
    generateBulletPoints,
    calculateATSScore,
    calculateJDMatch,
    generateCoverLetter,
    improveText,
    quantifyAchievement,
    type ResumeData,
    type JobDescription,
    type ATSScore,
} from '~/lib/ai-features';

interface AIFeaturesProps {
    resumeData: ResumeData;
    onSummaryUpdate: (summary: string) => void;
    onBulletsUpdate: (expIndex: number, bullets: string[]) => void;
    onDescriptionUpdate: (expIndex: number, descIndex: number, text: string) => void;
}

export default function AIFeatures({
    resumeData,
    onSummaryUpdate,
    onBulletsUpdate,
    onDescriptionUpdate,
}: AIFeaturesProps) {
    const [isGenerating, setIsGenerating] = useState<string | null>(null);
    const [atsScore, setAtsScore] = useState<ATSScore | null>(null);
    const [jdMatch, setJdMatch] = useState<{ score: number; missing: string[] } | null>(null);
    const [jobDescription, setJobDescription] = useState('');
    const [coverLetter, setCoverLetter] = useState('');

    const handleGenerateSummary = async () => {
        setIsGenerating('summary');
        try {
            const summary = await generateSummary(resumeData);
            if (summary) {
                onSummaryUpdate(summary);
            }
        } catch (error) {
            console.error('Error generating summary:', error);
        } finally {
            setIsGenerating(null);
        }
    };

    const handleGenerateBullets = async (expIndex: number) => {
        const exp = resumeData.experience[expIndex];
        if (!exp) return;

        setIsGenerating(`bullets-${expIndex}`);
        try {
            const bullets = await generateBulletPoints(
                exp.position,
                exp.company,
                exp.description.filter(d => d.trim())
            );
            if (bullets.length > 0) {
                onBulletsUpdate(expIndex, bullets);
            }
        } catch (error) {
            console.error('Error generating bullets:', error);
        } finally {
            setIsGenerating(null);
        }
    };

    const handleCalculateATS = () => {
        const score = calculateATSScore(resumeData);
        setAtsScore(score);
    };

    const handleCalculateJDMatch = () => {
        if (!jobDescription.trim()) {
            alert('Please enter a job description first');
            return;
        }

        const match = calculateJDMatch(resumeData, {
            title: '',
            description: jobDescription,
        });
        setJdMatch({ score: match.score, missing: match.missing });
    };

    const handleGenerateCoverLetter = async () => {
        if (!jobDescription.trim()) {
            alert('Please enter a job description first');
            return;
        }

        setIsGenerating('cover-letter');
        try {
            const letter = await generateCoverLetter(resumeData, {
                title: '',
                description: jobDescription,
            });
            if (letter) {
                setCoverLetter(letter);
            }
        } catch (error) {
            console.error('Error generating cover letter:', error);
        } finally {
            setIsGenerating(null);
        }
    };

    const handleImproveText = async (text: string, expIndex: number, descIndex: number) => {
        setIsGenerating(`improve-${expIndex}-${descIndex}`);
        try {
            const improved = await improveText(text);
            if (improved) {
                onDescriptionUpdate(expIndex, descIndex, improved);
            }
        } catch (error) {
            console.error('Error improving text:', error);
        } finally {
            setIsGenerating(null);
        }
    };

    const handleQuantify = async (text: string, expIndex: number, descIndex: number) => {
        setIsGenerating(`quantify-${expIndex}-${descIndex}`);
        try {
            const quantified = await quantifyAchievement(text);
            if (quantified) {
                onDescriptionUpdate(expIndex, descIndex, quantified);
            }
        } catch (error) {
            console.error('Error quantifying achievement:', error);
        } finally {
            setIsGenerating(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* ATS Score Section */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">ATS Compatibility Score</h3>
                    <button
                        onClick={handleCalculateATS}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                    >
                        Calculate Score
                    </button>
                </div>
                {atsScore && (
                    <div className="mt-4">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="text-4xl font-bold text-blue-600">{atsScore.overall}%</div>
                            <div className="flex-1">
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                    <div
                                        className="bg-blue-600 h-3 rounded-full transition-all"
                                        style={{ width: `${atsScore.overall}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {atsScore.feedback.map((fb, i) => (
                                <div key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                    <span className="text-blue-600">•</span>
                                    <span>{fb}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Job Description Matcher */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">Job Description Matcher</h3>
                <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste job description here..."
                    className="w-full p-3 border border-gray-300 rounded-lg mb-3 min-h-[120px]"
                />
                <div className="flex gap-2">
                    <button
                        onClick={handleCalculateJDMatch}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                    >
                        Calculate Match
                    </button>
                    <button
                        onClick={handleGenerateCoverLetter}
                        disabled={isGenerating === 'cover-letter'}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                    >
                        {isGenerating === 'cover-letter' ? 'Generating...' : 'Generate Cover Letter'}
                    </button>
                </div>
                {jdMatch && (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 mb-2">
                            {jdMatch.score}% Match
                        </div>
                        {jdMatch.missing.length > 0 && (
                            <div className="mt-2">
                                <p className="text-sm font-semibold text-gray-700 mb-1">Missing Keywords:</p>
                                <div className="flex flex-wrap gap-2">
                                    {jdMatch.missing.slice(0, 10).map((keyword, i) => (
                                        <span
                                            key={i}
                                            className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs"
                                        >
                                            {keyword}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {coverLetter && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-semibold mb-2">Generated Cover Letter:</h4>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap">{coverLetter}</div>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(coverLetter);
                                alert('Cover letter copied to clipboard!');
                            }}
                            className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                            Copy to Clipboard
                        </button>
                    </div>
                )}
            </div>

            {/* AI Action Buttons */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">AI Writing Assistant</h3>
                <div className="space-y-2">
                    <button
                        onClick={handleGenerateSummary}
                        disabled={isGenerating === 'summary'}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isGenerating === 'summary' ? 'Generating Summary...' : '✨ Generate Professional Summary'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function AIBulletButtons({
    expIndex,
    description,
    onUpdate,
    isGenerating,
}: {
    expIndex: number;
    description: string[];
    onUpdate: (bullets: string[]) => void;
    isGenerating: boolean;
}) {
    const handleGenerate = async () => {
        // This will be handled by parent component
    };

    const handleImprove = async (index: number) => {
        if (!description[index]) return;
        const improved = await improveText(description[index]);
        if (improved) {
            const newDesc = [...description];
            newDesc[index] = improved;
            onUpdate(newDesc);
        }
    };

    const handleQuantify = async (index: number) => {
        if (!description[index]) return;
        const quantified = await quantifyAchievement(description[index]);
        if (quantified) {
            const newDesc = [...description];
            newDesc[index] = quantified;
            onUpdate(newDesc);
        }
    };

    return (
        <div className="flex gap-2 mt-2">
            <button
                onClick={() => handleImprove(0)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                title="Improve grammar and tone"
            >
                ✏️ Improve
            </button>
            <button
                onClick={() => handleQuantify(0)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                title="Add quantifiable metrics"
            >
                📊 Quantify
            </button>
        </div>
    );
}


