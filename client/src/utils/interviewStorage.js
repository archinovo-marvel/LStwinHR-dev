// 面试对话记录存储系统
class InterviewStorage {
  constructor() {
    this.storageKey = 'interview_conversations';
    this.currentSessionKey = 'current_interview_session';
  }

  // 清理“临时候选人”等异常/临时会话，避免残留的临时面试结果影响体验
  purgeTemporarySessions() {
    try {
      const history = this.getInterviewHistory();
      const filteredHistory = history.filter(session => {
        if (!session) return false;
        if (session.candidateName === '临时候选人') return false;
        if (session.candidateId == null) return false;
        return true;
      });

      if (filteredHistory.length !== history.length) {
        localStorage.setItem(this.storageKey, JSON.stringify(filteredHistory));
      }

      const current = this.getCurrentSession();
      if (current?.candidateName === '临时候选人' || current?.candidateId == null) {
        localStorage.removeItem(this.currentSessionKey);
      }

      return { removedHistory: history.length - filteredHistory.length };
    } catch (e) {
      console.warn('purgeTemporarySessions failed:', e);
      return { removedHistory: 0, error: String(e?.message || e) };
    }
  }

  // 开始新的面试会话（对象形式）
  startSession({ id, candidateId, candidateName, position }) {
    return this.startInterviewSession(candidateId, candidateName, position);
  }

  // 将一个会话归档到历史（不清除currentSession，保留status）
  archiveSession(session) {
    if (!session) return;
    session.endTime = new Date().toISOString();
    session.status = 'completed';
    this.saveToHistory(session);
  }

  // 开始新的面试会话
  startInterviewSession(candidateId, candidateName, position) {
    // Archive any in-progress session first so no data is lost
    const existing = this.getCurrentSession();
    if (existing && existing.status === 'in_progress') {
      this.archiveSession(existing);
    }

    const session = {
      id: Date.now(),
      candidateId: candidateId,
      candidateName: candidateName,
      position: position,
      startTime: new Date().toISOString(),
      endTime: null,
      status: 'in_progress', // in_progress, completed, cancelled
      conversation: {
        questions: [],
        candidateAnswers: [],
        aiReplies: [],
        timestamps: []
      },
      scoring: null,
      metadata: {
        totalQuestions: 0,
        totalAnswers: 0,
        averageAnswerLength: 0,
        sessionDuration: 0
      }
    };

    localStorage.setItem(this.currentSessionKey, JSON.stringify(session));
    return session;
  }

  // 添加面试问题
  addQuestion(question, questionType = 'standard') {
    const session = this.getCurrentSession();
    if (!session) return false;

    const questionData = {
      id: Date.now(),
      question: question,
      type: questionType,
      timestamp: new Date().toISOString(),
      order: session.conversation.questions.length + 1
    };

    session.conversation.questions.push(questionData);
    session.conversation.timestamps.push({
      type: 'question',
      timestamp: new Date().toISOString(),
      content: question
    });

    this.updateCurrentSession(session);
    return true;
  }

  // 添加候选人回答
  addCandidateAnswer(answer, questionId = null) {
    const session = this.getCurrentSession();
    if (!session) return false;

    const answerData = {
      id: Date.now(),
      answer: answer,
      questionId: questionId,
      timestamp: new Date().toISOString(),
      order: session.conversation.candidateAnswers.length + 1,
      length: answer.length,
      wordCount: this.countWords(answer),
      // 实时评分（AI打分后填充）
      realTimeScore: null,   // { relevance, depth, clarity, professionalism }
      realTimeComment: null // string
    };

    session.conversation.candidateAnswers.push(answerData);
    session.conversation.timestamps.push({
      type: 'answer',
      timestamp: new Date().toISOString(),
      content: answer
    });

    // 更新元数据
    session.metadata.totalAnswers = session.conversation.candidateAnswers.length;
    session.metadata.averageAnswerLength = this.calculateAverageAnswerLength(session.conversation.candidateAnswers);

    this.updateCurrentSession(session);
    return true;
  }

  // 根据 answerId 更新回答的实时评分（由 AI 评分后调用）
  updateAnswerRealTimeScore(answerId, realTimeScore, realTimeComment) {
    const session = this.getCurrentSession();
    if (!session) return false;
    const answer = session.conversation.candidateAnswers.find(a => a.id === answerId);
    if (!answer) return false;
    answer.realTimeScore = realTimeScore;
    answer.realTimeComment = realTimeComment;
    this.updateCurrentSession(session);
    return true;
  }

  // 添加AI回复
  addAIReply(reply, replyType = 'evaluation') {
    const session = this.getCurrentSession();
    if (!session) return false;

    const replyData = {
      id: Date.now(),
      reply: reply,
      type: replyType,
      timestamp: new Date().toISOString(),
      order: session.conversation.aiReplies.length + 1
    };

    session.conversation.aiReplies.push(replyData);
    session.conversation.timestamps.push({
      type: 'ai_reply',
      timestamp: new Date().toISOString(),
      content: reply
    });

    this.updateCurrentSession(session);
    return true;
  }

  // 完成面试会话
  completeInterviewSession(scoring = null) {
    const session = this.getCurrentSession();
    if (!session) return false;

    session.endTime = new Date().toISOString();
    session.status = 'completed';
    session.scoring = scoring;
    
    // 计算会话持续时间
    const startTime = new Date(session.startTime);
    const endTime = new Date(session.endTime);
    session.metadata.sessionDuration = Math.round((endTime - startTime) / 1000 / 60); // 分钟

    // 保存到历史记录
    this.saveToHistory(session);

    // 清除当前会话
    localStorage.removeItem(this.currentSessionKey);

    return session;
  }

  // 取消面试会话
  cancelInterviewSession() {
    const session = this.getCurrentSession();
    if (!session) return false;

    session.endTime = new Date().toISOString();
    session.status = 'cancelled';

    // 保存到历史记录
    this.saveToHistory(session);

    // 清除当前会话
    localStorage.removeItem(this.currentSessionKey);

    return session;
  }

  // P3: 安全清除当前会话（替代直接操作 localStorage）
  clearCurrentSession() {
    localStorage.removeItem(this.currentSessionKey);
  }

  // 获取当前面试会话
  getCurrentSession() {
    const sessionData = localStorage.getItem(this.currentSessionKey);
    return sessionData ? JSON.parse(sessionData) : null;
  }

  // 更新当前面试会话
  updateCurrentSession(session) {
    localStorage.setItem(this.currentSessionKey, JSON.stringify(session));
  }

  // 保存到历史记录
  saveToHistory(session) {
    const history = this.getInterviewHistory();
    history.push(session);
    
    // 只保留最近100个面试记录
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    localStorage.setItem(this.storageKey, JSON.stringify(history));
  }

  // 获取面试历史记录
  getInterviewHistory() {
    const historyData = localStorage.getItem(this.storageKey);
    return historyData ? JSON.parse(historyData) : [];
  }

  // 根据候选人ID获取面试记录
  getInterviewByCandidateId(candidateId) {
    const history = this.getInterviewHistory();
    return history.filter(session => session.candidateId === candidateId);
  }

  // 获取最近的面试记录
  getRecentInterviews(limit = 10) {
    const history = this.getInterviewHistory();
    return history
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      .slice(0, limit);
  }

  // 删除面试记录
  deleteInterview(sessionId) {
    const history = this.getInterviewHistory();
    const filteredHistory = history.filter(session => session.id !== sessionId);
    localStorage.setItem(this.storageKey, JSON.stringify(filteredHistory));
    return true;
  }

  // 导出面试记录
  exportInterview(sessionId) {
    const history = this.getInterviewHistory();
    const session = history.find(s => s.id === sessionId);
    
    if (!session) return null;

    return {
      session: session,
      exportTime: new Date().toISOString(),
      format: 'json'
    };
  }

  // 导出所有面试记录
  exportAllInterviews() {
    const history = this.getInterviewHistory();
    return {
      interviews: history,
      exportTime: new Date().toISOString(),
      totalCount: history.length,
      format: 'json'
    };
  }

  // 获取面试统计信息
  getInterviewStatistics() {
    const history = this.getInterviewHistory();
    const completedInterviews = history.filter(s => s.status === 'completed');
    
    const stats = {
      totalInterviews: history.length,
      completedInterviews: completedInterviews.length,
      cancelledInterviews: history.filter(s => s.status === 'cancelled').length,
      averageSessionDuration: 0,
      averageScore: 0,
      scoreDistribution: {
        excellent: 0, // 90-100
        good: 0,      // 80-89
        average: 0,   // 70-79
        below: 0      // <70
      },
      topPositions: {},
      recentActivity: []
    };

    if (completedInterviews.length > 0) {
      // 计算平均会话时长
      const totalDuration = completedInterviews.reduce((sum, session) => 
        sum + (session.metadata.sessionDuration || 0), 0);
      stats.averageSessionDuration = Math.round(totalDuration / completedInterviews.length);

      // 计算平均分数
      const scoredInterviews = completedInterviews.filter(s => s.scoring && s.scoring.totalScore);
      if (scoredInterviews.length > 0) {
        const totalScore = scoredInterviews.reduce((sum, session) => 
          sum + session.scoring.totalScore, 0);
        stats.averageScore = Math.round(totalScore / scoredInterviews.length);

        // 分数分布
        scoredInterviews.forEach(session => {
          const score = session.scoring.totalScore;
          if (score >= 90) stats.scoreDistribution.excellent++;
          else if (score >= 80) stats.scoreDistribution.good++;
          else if (score >= 70) stats.scoreDistribution.average++;
          else stats.scoreDistribution.below++;
        });
      }

      // 热门岗位
      completedInterviews.forEach(session => {
        const position = session.position;
        stats.topPositions[position] = (stats.topPositions[position] || 0) + 1;
      });

      // 最近活动
      stats.recentActivity = history
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
        .slice(0, 5)
        .map(session => ({
          id: session.id,
          candidateName: session.candidateName,
          position: session.position,
          startTime: session.startTime,
          status: session.status,
          score: session.scoring ? session.scoring.totalScore : null
        }));
    }

    return stats;
  }

  // 搜索面试记录
  searchInterviews(query) {
    const history = this.getInterviewHistory();
    const lowerQuery = query.toLowerCase();
    
    return history.filter(session => 
      session.candidateName.toLowerCase().includes(lowerQuery) ||
      session.position.toLowerCase().includes(lowerQuery) ||
      (session.scoring && session.scoring.conversationSummary && 
       session.scoring.conversationSummary.toLowerCase().includes(lowerQuery))
    );
  }

  // 工具方法：计算单词数
  countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  }

  // 工具方法：计算平均回答长度
  calculateAverageAnswerLength(answers) {
    if (!answers || answers.length === 0) return 0;
    const totalLength = answers.reduce((sum, answer) => sum + (answer.length || 0), 0);
    return Math.round(totalLength / answers.length);
  }

  // 清理过期数据
  cleanupOldData(daysToKeep = 30) {
    const history = this.getInterviewHistory();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const filteredHistory = history.filter(session => 
      new Date(session.startTime) > cutoffDate
    );
    
    localStorage.setItem(this.storageKey, JSON.stringify(filteredHistory));
    return history.length - filteredHistory.length; // 返回删除的记录数
  }

  // 获取存储使用情况
  getStorageInfo() {
    const history = this.getInterviewHistory();
    const currentSession = this.getCurrentSession();
    
    const historySize = JSON.stringify(history).length;
    const currentSize = currentSession ? JSON.stringify(currentSession).length : 0;
    const totalSize = historySize + currentSize;
    
    return {
      totalRecords: history.length,
      currentSession: currentSession ? 1 : 0,
      totalSizeKB: Math.round(totalSize / 1024),
      historySizeKB: Math.round(historySize / 1024),
      currentSizeKB: Math.round(currentSize / 1024),
      estimatedMaxRecords: Math.floor(5 * 1024 * 1024 / totalSize) // 假设5MB限制
    };
  }
}

export default InterviewStorage;



