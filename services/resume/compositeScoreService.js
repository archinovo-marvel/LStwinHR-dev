const { FINAL_SCORE_WEIGHTS, MBTI_SCORE_MAP } = require('./analysisConfig');

class CompositeScoreService {
  getMbtiScore(mbti) {
    if (!mbti) return null;
    return MBTI_SCORE_MAP[String(mbti).toUpperCase()] || 75;
  }

  normalizeScore(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null;
  }

  calculateFinalScore(input = {}) {
    const values = {
      resumeScore: this.normalizeScore(input.resumeScore) ?? 0,
      mbtiScore: this.normalizeScore(input.mbtiScore) ?? 0,
      interviewScore: this.normalizeScore(input.interviewScore) ?? 0
    };

    if (values.resumeScore === 0 && values.mbtiScore === 0 && values.interviewScore === 0) {
      return {
        finalScore: 0,
        normalizedWeights: { ...FINAL_SCORE_WEIGHTS },
        missingFields: ['resumeScore', 'mbtiScore', 'interviewScore'],
        hasPartialData: true,
        note: ''
      };
    }

    const finalScore = Math.round(
      (values.resumeScore * FINAL_SCORE_WEIGHTS.resumeScore) +
      (values.mbtiScore * FINAL_SCORE_WEIGHTS.mbtiScore) +
      (values.interviewScore * FINAL_SCORE_WEIGHTS.interviewScore)
    );

    return {
      finalScore,
      normalizedWeights: { ...FINAL_SCORE_WEIGHTS },
      missingFields: Object.keys(input).filter(key => this.normalizeScore(input[key]) === null),
      hasPartialData: Object.keys(input).some(key => this.normalizeScore(input[key]) === null),
      note: ''
    };
  }
}

module.exports = new CompositeScoreService();
