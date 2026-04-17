const RESUME_SCORE_DIMENSIONS = {
  education: 20,
  work: 20,
  project: 30,
  skill: 25,
  expression: 5,
  riskPenalty: 0
};

const FINAL_SCORE_WEIGHTS = {
  resumeScore: 0.35,
  mbtiScore: 0.15,
  interviewScore: 0.5
};

const MBTI_SCORE_MAP = {
  ENTJ: 90,
  INTJ: 88,
  ENTP: 85,
  INTP: 82,
  ENFJ: 85,
  INFJ: 88,
  ENFP: 80,
  INFP: 78,
  ESTJ: 88,
  ISTJ: 85,
  ESTP: 82,
  ISTP: 80,
  ESFJ: 85,
  ISFJ: 82,
  ESFP: 78,
  ISFP: 75
};

const ANALYSIS_FALLBACKS = {
  emptyResume: '暂未识别到有效简历内容',
  noWorkExperience: '无工作经历',
  notMentioned: '未提及',
  notSpecified: '未注明',
  partialScoreHint: '部分评分项缺失，综合分已按现有数据折算'
};

module.exports = {
  RESUME_SCORE_DIMENSIONS,
  FINAL_SCORE_WEIGHTS,
  MBTI_SCORE_MAP,
  ANALYSIS_FALLBACKS
};
