const toFiniteNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

const calculateResumeScoreFromCandidate = (candidate) => {
  const scores = candidate?.resumeAnalysisResult?.scores;
  if (scores && typeof scores === 'object') {
    return toFiniteNumber(scores.educationScore) +
      toFiniteNumber(scores.workScore) +
      toFiniteNumber(scores.projectScore) +
      toFiniteNumber(scores.skillScore) +
      toFiniteNumber(scores.expressionScore);
  }

  return toFiniteNumber(
    candidate?.resumeScore ??
    candidate?.resumeAnalysis?.totalScore ??
    candidate?.analysisDetails?.resumeScore ??
    candidate?.analysisDetails?.resumeAnalysis?.overallScore
  );
};

const getRecommendationLabelFromCandidate = (candidate) => {
  const explicitRecommendation = String(
    candidate?.resumeAnalysisResult?.summary?.recommendation ||
    candidate?.resumeAnalysis?.recommendation?.level ||
    ''
  ).trim();

  if (explicitRecommendation) {
    return explicitRecommendation;
  }

  const resumeScore = calculateResumeScoreFromCandidate(candidate);
  if (resumeScore >= 75) return '强烈推荐';
  if (resumeScore >= 60) return '推荐';
  if (resumeScore >= 45) return '待考虑';
  return '建议淘汰';
};

const getInterviewDurationMinutes = (record) => {
  if (!record || typeof record !== 'object') {
    return 0;
  }

  const metadataDuration = toFiniteNumber(record?.metadata?.sessionDuration);
  if (metadataDuration > 0) {
    return metadataDuration;
  }

  if (record.startTime && record.endTime) {
    const start = new Date(record.startTime).getTime();
    const end = new Date(record.endTime).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return Math.max(1, Math.round((end - start) / 1000 / 60));
    }
  }

  return 0;
};

export const getCandidateStats = (candidateList = []) => {
  const candidates = Array.isArray(candidateList) ? candidateList : [];

  const totalCandidates = candidates.length;
  const analyzedCandidates = candidates.filter(
    candidate => candidate?.status === '已分析' || candidate?.status === '已分析(VL)' || candidate?.status === '已分析(local-VL)' || candidate?.status === '已分析(Qwen3.5-9B)'
  ).length;
  const recommendedCandidates = candidates.filter(
    candidate => getRecommendationLabelFromCandidate(candidate) === '强烈推荐'
  ).length;
  const passCandidates = candidates.filter(candidate => toFiniteNumber(candidate?.matchScore) >= 70).length;
  const averageResumeScore = totalCandidates > 0
    ? Math.round(
        candidates.reduce((sum, candidate) => sum + toFiniteNumber(candidate?.matchScore), 0) / totalCandidates
      )
    : 0;

  const interviewCount = candidates.reduce((sum, candidate) => {
    const interviewRecords = Array.isArray(candidate?.interviewRecords) ? candidate.interviewRecords : [];
    if (interviewRecords.length > 0) {
      return sum + interviewRecords.length;
    }

    if (candidate?.latestInterviewRecord) {
      return sum + 1;
    }

    if (candidate?.hasInterview || candidate?.interviewScore !== null && candidate?.interviewScore !== undefined) {
      return sum + 1;
    }

    return sum;
  }, 0);

  const interviewDuration = candidates.reduce((sum, candidate) => {
    const interviewRecords = Array.isArray(candidate?.interviewRecords) ? candidate.interviewRecords : [];
    if (interviewRecords.length > 0) {
      return sum + interviewRecords.reduce((recordSum, record) => recordSum + getInterviewDurationMinutes(record), 0);
    }

    if (candidate?.latestInterviewRecord) {
      return sum + getInterviewDurationMinutes(candidate.latestInterviewRecord);
    }

    return sum;
  }, 0);

  return {
    totalCandidates,
    totalResumes: totalCandidates,
    analyzedCandidates,
    recommendedCandidates,
    interviewCount,
    interviewDuration,
    averageResumeScore,
    weeklyPassRate: totalCandidates > 0 ? Math.round((passCandidates / totalCandidates) * 100) : 0
  };
};
