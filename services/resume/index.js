/**
 * 简历分析服务模块入口
 * 统一导出所有服务
 */
const resumeAnalysisService = require('./resumeAnalysisService');
const { parserService, ParseStatus } = require('./parserService');
const preprocessService = require('./preprocessService');
const extractorService = require('./extractorService');
const matcherService = require('./matcherService');
const scoringService = require('./scoringService');
const riskService = require('./riskService');
const reportService = require('./reportService');
const compositeScoreService = require('./compositeScoreService');
const {
  RESUME_SCORE_DIMENSIONS,
  FINAL_SCORE_WEIGHTS,
  MBTI_SCORE_MAP,
  ANALYSIS_FALLBACKS
} = require('./analysisConfig');
const { 
  positionConfig, 
  getPositionConfig, 
  getAllPositions,
  getDefaultPositionProfiles,
  buildPositionDescription,
  normalizePositionConfig,
  addPosition, 
  updatePosition 
} = require('./positionConfig');
module.exports = {
  resumeAnalysisService,
  parserService,
  ParseStatus,
  preprocessService,
  extractorService,
  matcherService,
  scoringService,
  riskService,
  reportService,
  compositeScoreService,
  RESUME_SCORE_DIMENSIONS,
  FINAL_SCORE_WEIGHTS,
  MBTI_SCORE_MAP,
  ANALYSIS_FALLBACKS,
  positionConfig,
  getPositionConfig,
  getAllPositions,
  getDefaultPositionProfiles,
  buildPositionDescription,
  normalizePositionConfig,
  addPosition,
  updatePosition
};
