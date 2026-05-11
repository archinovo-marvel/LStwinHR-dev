/**
 * 个人面试服务模块入口
 * 导出所有面试相关服务
 */
const positionService = require('./positionService');
const resumeService = require('./resumeService');
const sessionService = require('./sessionService');
const aiInterviewService = require('./aiInterviewService');
const scoringService = require('./scoringService');
const statsService = require('./statsService');

module.exports = {
  positionService,
  resumeService,
  sessionService,
  aiInterviewService,
  scoringService,
  statsService
};
