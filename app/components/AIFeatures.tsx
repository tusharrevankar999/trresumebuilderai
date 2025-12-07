import { useState } from 'react';
import {
    generateSummary,
    generateBulletPoints,
    calculateATSScore,
    calculateJDMatch,
    generateCoverLetter,
    improveText,
    quantifyAchievement,
    makeStronger,
    shortenText,
    humanizeText,
    detectOverusedWords,
    scanQuantifiedMetrics,
    type ResumeData,
    type JobDescription,
    type ATSScore,
    type SummaryStyle,
} from '~/lib/ai-features';

interface AIFeaturesProps {
    resumeData: ResumeData;
    onSummaryUpdate: (summary: string) => void;
    onBulletsUpdate: (expIndex: number, bullets: string[]) => void;
    onDescriptionUpdate: (expIndex: number, descIndex: number, text: string) => void;
    onSkillsUpdate?: (skills: { technical: string[]; soft: string[] }) => void;
}

export default function AIFeatures({
    resumeData,
    onSummaryUpdate,
    onBulletsUpdate,
    onDescriptionUpdate,
    onSkillsUpdate,
}: AIFeaturesProps) {
    const [isGenerating, setIsGenerating] = useState<string | null>(null);
    const [atsScore, setAtsScore] = useState<ATSScore | null>(null);
    const [jdMatch, setJdMatch] = useState<{ score: number; missing: string[] } | null>(null);
    const [jobDescription, setJobDescription] = useState('');
    const [coverLetter, setCoverLetter] = useState('');
    const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>('classic');
    const [overusedWords, setOverusedWords] = useState<Array<{ word: string; count: number; suggestions: string[] }>>([]);
    const [metricsScan, setMetricsScan] = useState<{ hasMetrics: boolean; metricCount: number; bulletsWithoutMetrics: number; suggestions: string[] } | null>(null);

    const handleGenerateSummary = async (style: SummaryStyle = summaryStyle) => {
        setIsGenerating('summary');
        try {
            const summary = await generateSummary(resumeData, style);
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
        
        // Also scan for overused words and metrics
        const resumeText = [
            resumeData.summary,
            resumeData.experience.map(e => e.description.join(' ')).join(' '),
        ].join(' ');
        const overused = detectOverusedWords(resumeText);
        setOverusedWords(overused);
        
        const metrics = scanQuantifiedMetrics(resumeData.experience);
        setMetricsScan(metrics);
    };
    
    const handleAddMissingSkill = (skill: string) => {
        if (onSkillsUpdate) {
            const currentSkills = resumeData.skills;
            // Determine if it's technical or soft skill (simple heuristic)
            const technicalKeywords = ['javascript', 'python', 'react', 'node', 'aws', 'docker', 'sql', 'api', 'git', 'linux', 'typescript', 'java', 'c++', 'mongodb', 'postgresql', 'kubernetes', 'html', 'css'];
            const isTechnical = technicalKeywords.some(kw => skill.toLowerCase().includes(kw));
            
            if (isTechnical) {
                const updated = {
                    ...currentSkills,
                    technical: [...currentSkills.technical.filter(s => s.trim()), skill].filter(s => s.trim()),
                };
                onSkillsUpdate(updated);
            } else {
                const updated = {
                    ...currentSkills,
                    soft: [...currentSkills.soft.filter(s => s.trim()), skill].filter(s => s.trim()),
                };
                onSkillsUpdate(updated);
            }
        }
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
                    <div className="mt-4 space-y-4">
                        <div className="p-3 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600 mb-2">
                                {jdMatch.score}% Match
                            </div>
                            {jdMatch.missing.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-sm font-semibold text-gray-700 mb-2">Missing Skills/Keywords:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {jdMatch.missing.slice(0, 15).map((keyword, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleAddMissingSkill(keyword)}
                                                className="px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 border border-red-300 flex items-center gap-1"
                                                title="Click to add to skills"
                                            >
                                                {keyword}
                                                <span className="text-red-600">+</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {overusedWords.length > 0 && (
                            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                <p className="text-sm font-semibold text-gray-700 mb-2">⚠️ Overused Words Detected:</p>
                                <div className="space-y-2">
                                    {overusedWords.map((item, i) => (
                                        <div key={i} className="text-xs">
                                            <span className="font-medium text-yellow-800">"{item.word}"</span>
                                            <span className="text-gray-600"> used {item.count} times. Try: </span>
                                            <span className="text-blue-600">{item.suggestions.slice(0, 2).join(', ')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {metricsScan && (
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-sm font-semibold text-gray-700 mb-2">📊 Metrics Analysis:</p>
                                <div className="text-xs text-gray-700 space-y-1">
                                    <div>
                                        <span className="font-medium">Bullets with metrics:</span> {metricsScan.metricCount}
                                    </div>
                                    <div>
                                        <span className="font-medium">Bullets without metrics:</span> {metricsScan.bulletsWithoutMetrics}
                                    </div>
                                    {metricsScan.bulletsWithoutMetrics > 0 && (
                                        <div className="mt-2">
                                            <p className="font-medium text-blue-700 mb-1">Suggestions:</p>
                                            {metricsScan.suggestions.slice(0, 3).map((s, i) => (
                                                <div key={i} className="text-blue-600">• {s}</div>
                                            ))}
                                        </div>
                                    )}
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
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Summary Style:</label>
                        <div className="flex gap-2 mb-3">
                            <button
                                onClick={() => {
                                    setSummaryStyle('classic');
                                    handleGenerateSummary('classic');
                                }}
                                className={`px-3 py-1.5 rounded text-xs font-medium ${
                                    summaryStyle === 'classic'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Classic
                            </button>
                            <button
                                onClick={() => {
                                    setSummaryStyle('bold');
                                    handleGenerateSummary('bold');
                                }}
                                className={`px-3 py-1.5 rounded text-xs font-medium ${
                                    summaryStyle === 'bold'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Bold
                            </button>
                            <button
                                onClick={() => {
                                    setSummaryStyle('storytelling');
                                    handleGenerateSummary('storytelling');
                                }}
                                className={`px-3 py-1.5 rounded text-xs font-medium ${
                                    summaryStyle === 'storytelling'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Storytelling
                            </button>
                        </div>
                        <button
                            onClick={() => handleGenerateSummary()}
                            disabled={isGenerating === 'summary'}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isGenerating === 'summary' ? 'Generating Summary...' : '✨ Generate Professional Summary'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function AIBulletButtons({
    expIndex,
    descIndex,
    text,
    onUpdate,
    isGenerating,
}: {
    expIndex: number;
    descIndex: number;
    text: string;
    onUpdate: (text: string) => void;
    isGenerating: boolean;
}) {
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAction = async (action: 'improve' | 'quantify' | 'stronger' | 'shorten' | 'humanize') => {
        if (!text || isProcessing) return;
        setIsProcessing(true);
        try {
            let result = text;
            switch (action) {
                case 'improve':
                    result = await improveText(text);
                    break;
                case 'quantify':
                    result = await quantifyAchievement(text);
                    break;
                case 'stronger':
                    result = await makeStronger(text);
                    break;
                case 'shorten':
                    result = await shortenText(text);
                    break;
                case 'humanize':
                    result = await humanizeText(text);
                    break;
            }
            if (result && result !== text) {
                onUpdate(result);
            }
        } catch (error) {
            console.error(`Error in ${action}:`, error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-wrap gap-1.5 mt-2">
            <button
                onClick={() => handleAction('stronger')}
                disabled={isProcessing}
                className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium hover:bg-blue-100 disabled:opacity-50 border border-blue-200"
                title="Make stronger with power words"
            >
                💪 Stronger
            </button>
            <button
                onClick={() => handleAction('quantify')}
                disabled={isProcessing}
                className="px-2.5 py-1 bg-green-50 text-green-700 rounded text-xs font-medium hover:bg-green-100 disabled:opacity-50 border border-green-200"
                title="Add metrics"
            >
                📊 Add Metrics
            </button>
            <button
                onClick={() => handleAction('shorten')}
                disabled={isProcessing}
                className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium hover:bg-purple-100 disabled:opacity-50 border border-purple-200"
                title="Shorten text"
            >
                ✂️ Shorten
            </button>
            <button
                onClick={() => handleAction('humanize')}
                disabled={isProcessing}
                className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded text-xs font-medium hover:bg-orange-100 disabled:opacity-50 border border-orange-200"
                title="Make more human and natural"
            >
                🤝 Humanize
            </button>
            <button
                onClick={() => handleAction('improve')}
                disabled={isProcessing}
                className="px-2.5 py-1 bg-gray-50 text-gray-700 rounded text-xs font-medium hover:bg-gray-100 disabled:opacity-50 border border-gray-200"
                title="Improve grammar and tone"
            >
                ✏️ Improve
            </button>
        </div>
    );
}


