import React, { useState } from 'react';
import {
    calculateATSScore,
    calculateJDMatch,
    calculateContentStrength,
    calculateOverallResumeScore,
    detectOverusedWords,
    scanQuantifiedMetrics,
    fixMyResume,
    type ParsedResumeData,
    type JobDescription,
    type ATSScore,
    type OverusedWord,
    type QuantifiedMetrics,
} from '~/lib/ai-features';
import jsPDF from 'jspdf';

interface EnhancedATSProps {
    resumeData: ParsedResumeData;
    jobDescription: JobDescription;
    onResumeUpdate?: (updatedResume: ParsedResumeData) => void;
}

const EnhancedATS: React.FC<EnhancedATSProps> = ({ resumeData, jobDescription, onResumeUpdate }) => {
    const [isFixing, setIsFixing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Calculate all scores
    const atsScore = calculateATSScore(resumeData);
    const keywordMatch = calculateJDMatch(resumeData, jobDescription);
    const contentStrength = calculateContentStrength(resumeData);
    const lengthScore = atsScore.sections.length;
    const overallScore = calculateOverallResumeScore(atsScore, keywordMatch.score, contentStrength, lengthScore);

    // Detect issues
    const resumeText = [
        resumeData.summary,
        resumeData.experience.map(e => e.description.join(' ')).join(' '),
        resumeData.skills.technical.join(' '),
        resumeData.skills.soft.join(' '),
    ].join(' ');
    
    const overusedWords = detectOverusedWords(resumeText);
    const quantifiedMetrics = scanQuantifiedMetrics(resumeData.experience);

    // Missing skills alert
    const missingSkills = keywordMatch.missing.slice(0, 10);

    const handleAddMissingSkill = (skill: string) => {
        const technicalKeywords = ['javascript', 'python', 'react', 'node', 'aws', 'docker', 'sql', 'api', 'git', 'linux', 'typescript', 'java', 'c++', 'vue', 'angular', 'mongodb', 'postgresql', 'kubernetes', 'graphql'];
        const isTechnical = technicalKeywords.some(kw => skill.toLowerCase().includes(kw));
        
        if (isTechnical && !resumeData.skills.technical.includes(skill)) {
            const updatedResume = {
                ...resumeData,
                skills: {
                    ...resumeData.skills,
                    technical: [...resumeData.skills.technical, skill],
                },
            };
            onResumeUpdate?.(updatedResume);
        } else if (!isTechnical && !resumeData.skills.soft.includes(skill)) {
            const updatedResume = {
                ...resumeData,
                skills: {
                    ...resumeData.skills,
                    soft: [...resumeData.skills.soft, skill],
                },
            };
            onResumeUpdate?.(updatedResume);
        }
    };

    const handleFixMyResume = async () => {
        setIsFixing(true);
        try {
            const fixedResume = await fixMyResume(resumeData, jobDescription, atsScore, keywordMatch);
            onResumeUpdate?.(fixedResume);
            alert('Resume optimized! Missing keywords added and weak bullets improved.');
        } catch (error) {
            console.error('Error fixing resume:', error);
            alert('Error optimizing resume. Please try again.');
        } finally {
            setIsFixing(false);
        }
    };

    const handleExportMatchReport = async () => {
        setIsExporting(true);
        try {
            const doc = new jsPDF();
            let yPos = 20;

            // Title
            doc.setFontSize(20);
            doc.text('Resume Match Report', 105, yPos, { align: 'center' });
            yPos += 15;

            // Overall Score
            doc.setFontSize(16);
            doc.text(`Overall Resume Score: ${overallScore}/100`, 20, yPos);
            yPos += 10;

            // Score Breakdown
            doc.setFontSize(12);
            doc.text(`Keyword Match: ${keywordMatch.score}%`, 20, yPos);
            yPos += 7;
            doc.text(`ATS Compatibility: ${atsScore.overall}%`, 20, yPos);
            yPos += 7;
            doc.text(`Content Strength: ${contentStrength}%`, 20, yPos);
            yPos += 7;
            doc.text(`Length Score: ${lengthScore}%`, 20, yPos);
            yPos += 15;

            // Missing Skills
            if (missingSkills.length > 0) {
                doc.setFontSize(14);
                doc.text('Missing Skills:', 20, yPos);
                yPos += 8;
                doc.setFontSize(10);
                missingSkills.forEach((skill, idx) => {
                    if (yPos > 270) {
                        doc.addPage();
                        yPos = 20;
                    }
                    doc.text(`• ${skill}`, 25, yPos);
                    yPos += 6;
                });
                yPos += 5;
            }

            // Overused Words
            if (overusedWords.length > 0) {
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.setFontSize(14);
                doc.text('Overused Words:', 20, yPos);
                yPos += 8;
                doc.setFontSize(10);
                overusedWords.forEach((item) => {
                    if (yPos > 270) {
                        doc.addPage();
                        yPos = 20;
                    }
                    doc.text(`"${item.word}" (${item.count}x) - Try: ${item.suggestions.slice(0, 2).join(', ')}`, 25, yPos);
                    yPos += 6;
                });
                yPos += 5;
            }

            // Quantified Metrics
            if (quantifiedMetrics.bulletsWithoutMetrics > 0) {
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.setFontSize(14);
                doc.text('Quantified Metrics:', 20, yPos);
                yPos += 8;
                doc.setFontSize(10);
                doc.text(`${quantifiedMetrics.bulletsWithoutMetrics} bullet points lack metrics. Add numbers to show impact.`, 25, yPos);
                yPos += 10;
            }

            // ATS Feedback
            if (atsScore.feedback.length > 0) {
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.setFontSize(14);
                doc.text('ATS Compatibility Tips:', 20, yPos);
                yPos += 8;
                doc.setFontSize(10);
                atsScore.feedback.slice(0, 10).forEach((tip) => {
                    if (yPos > 270) {
                        doc.addPage();
                        yPos = 20;
                    }
                    doc.text(`• ${tip}`, 25, yPos, { maxWidth: 170 });
                    yPos += 6;
                });
            }

            // Save PDF
            const fileName = `Resume_Match_Report_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
        } catch (error) {
            console.error('Error exporting report:', error);
            alert('Error exporting report. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    // Determine ATS score styling
    const gradientClass = atsScore.overall > 69
        ? 'from-green-100'
        : atsScore.overall > 49
            ? 'from-yellow-100'
            : 'from-red-100';

    const iconSrc = atsScore.overall > 69
        ? '/icons/ats-good.svg'
        : atsScore.overall > 49
            ? '/icons/ats-warning.svg'
            : '/icons/ats-bad.svg';

    const subtitle = atsScore.overall > 69
        ? 'Great Job!'
        : atsScore.overall > 49
            ? 'Good Start'
            : 'Needs Improvement';

    return (
        <div className="flex flex-col gap-6">
            {/* Main ATS Score Card */}
            <div className={`bg-gradient-to-b ${gradientClass} to-white rounded-2xl shadow-md w-full p-6`}>
                <div className="flex items-center gap-4 mb-6">
                    <img src={iconSrc} alt="ATS Score Icon" className="w-12 h-12" />
                    <div>
                        <h2 className="text-2xl font-bold">ATS Score - {atsScore.overall}/100</h2>
                        <p className="text-gray-600">{subtitle}</p>
                    </div>
                </div>

                {/* Score Breakdown */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-lg p-3">
                        <p className="text-sm text-gray-600">Keyword Match</p>
                        <p className="text-2xl font-bold">{keywordMatch.score}%</p>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                        <p className="text-sm text-gray-600">Content Strength</p>
                        <p className="text-2xl font-bold">{contentStrength}%</p>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                        <p className="text-sm text-gray-600">Formatting</p>
                        <p className="text-2xl font-bold">{atsScore.sections.formatting}%</p>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                        <p className="text-sm text-gray-600">Length</p>
                        <p className="text-2xl font-bold">{lengthScore}%</p>
                    </div>
                </div>

                {/* ATS Tips */}
                <div className="space-y-3 mb-4">
                    {atsScore.feedback.slice(0, 4).map((tip, index) => (
                        <div key={index} className="flex items-start gap-3">
                            <img src="/icons/warning.svg" alt="Warning" className="w-5 h-5 mt-1" />
                            <p className="text-amber-700">{tip}</p>
                        </div>
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={handleFixMyResume}
                        disabled={isFixing}
                        className="primary-button flex-1 py-2 px-4 text-sm"
                    >
                        {isFixing ? 'Optimizing...' : 'Fix My Resume'}
                    </button>
                    <button
                        onClick={handleExportMatchReport}
                        disabled={isExporting}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                        {isExporting ? 'Exporting...' : 'Export Report'}
                    </button>
                </div>
            </div>

            {/* Missing Skills Alert */}
            {missingSkills.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
                    <h3 className="text-xl font-bold mb-3 text-yellow-800">⚠️ Missing Skills</h3>
                    <p className="text-gray-700 mb-4">
                        You're missing: <strong>{missingSkills.slice(0, 5).join(', ')}</strong>
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {missingSkills.slice(0, 5).map((skill, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleAddMissingSkill(skill)}
                                className="bg-yellow-200 hover:bg-yellow-300 text-yellow-900 rounded-lg px-3 py-1 text-sm font-medium flex items-center gap-2"
                            >
                                + Add {skill}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Overused Words Detector */}
            {overusedWords.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
                    <h3 className="text-xl font-bold mb-3 text-orange-800">📝 Overused Words</h3>
                    <div className="space-y-3">
                        {overusedWords.map((item, idx) => (
                            <div key={idx} className="bg-white rounded-lg p-3">
                                <p className="font-semibold text-gray-800">
                                    "{item.word}" used {item.count} times
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                    Try: <span className="text-blue-600">{item.suggestions.slice(0, 3).join(', ')}</span>
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Quantified Metrics Scanner */}
            {quantifiedMetrics.bulletsWithoutMetrics > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                    <h3 className="text-xl font-bold mb-3 text-blue-800">📊 Quantified Metrics</h3>
                    <p className="text-gray-700 mb-2">
                        {quantifiedMetrics.bulletsWithoutMetrics} bullet points lack metrics.
                    </p>
                    <p className="text-sm text-gray-600">
                        Add numbers, percentages, or dollar amounts to show impact. Example: "Increased sales by 25%" instead of "Increased sales".
                    </p>
                </div>
            )}
        </div>
    );
};

export default EnhancedATS;


