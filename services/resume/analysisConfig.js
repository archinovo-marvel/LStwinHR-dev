const RESUME_SCORE_DIMENSIONS = {
  education: 20,
  work: 20,
  project: 30,
  skill: 25,
  expression: 5,
  riskPenalty: 0
};

const FINAL_SCORE_WEIGHTS = {
  resumeScore: 0.4,
  mbtiScore: 0.1,
  interviewScore: 0.5
};

// MBTI评分不再使用预设映射表，改为AI基于岗位匹配度打分
// 保留 MBTI_SCORE_MAP 作为导出空对象，避免其他模块引用报错
const MBTI_SCORE_MAP = {};

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
