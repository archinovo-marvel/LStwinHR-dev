/**
 * 面试会话管理服务
 * 负责面试会话的创建、更新、查询等操作
 */
const { v4: uuidv4 } = require('uuid');
const aiInterviewService = require('./aiInterviewService');
const scoringService = require('./scoringService');

class SessionService {
  /**
   * 创建新的面试会话
   * @param {number} userId - 用户ID
   * @param {string} resumeId - 简历ID
   * @param {Object} positionInfo - 岗位信息
   * @param {Object} config - 配置 (difficulty, totalQuestions)
   * @param {Object} pool - 数据库连接池
   * @returns {Promise<Object>} - 创建的会话
   */
  async create(userId, resumeId, positionInfo, config, pool) {
    const id = uuidv4();
    const { difficulty = 'medium', totalQuestions = 10 } = config;

    // 初始化会话
    await pool.execute(
      `INSERT INTO interview_sessions
       (id, user_id, resume_id, position_id, position_info, difficulty, total_questions, current_question, status, start_time, conversation, scoring)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'in_progress', NOW(), '[]', '{}')`,
      [
        id,
        userId,
        resumeId,
        positionInfo.id || null,
        JSON.stringify(positionInfo),
        difficulty,
        totalQuestions
      ]
    );

    return this.getById(id, pool);
  }

  /**
   * 获取会话详情
   * @param {string} id - 会话ID
   * @param {Object} pool - 数据库连接池
   * @returns {Promise<Object|null>}
   */
  async getById(id, pool) {
    const [rows] = await pool.execute(
      'SELECT * FROM interview_sessions WHERE id = ?',
      [id]
    );

    if (rows.length === 0) return null;
    return this.formatSession(rows[0]);
  }

  /**
   * 获取用户的面试历史
   * @param {number} userId - 用户ID
   * @param {Object} filters - 筛选条件
   * @param {Object} pool - 数据库连接池
   * @returns {Promise<Array>}
   */
  async getByUserId(userId, filters, pool) {
    const { status, limit = 20, offset = 0 } = filters || {};

    // 确保 limit 和 offset 是数字
    const limitNum = Number(limit);
    const offsetNum = Number(offset);

    let sql = 'SELECT * FROM interview_sessions WHERE user_id = ?';
    const params = [userId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    // 直接拼接 LIMIT 和 OFFSET（已确保是数字）
    sql += ` ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

    const [rows] = await pool.execute(sql, params);
    return rows.map(row => this.formatSessionSummary(row));
  }

  /**
   * 提交回答
   * @param {string} sessionId - 会话ID
   * @param {string} questionId - 问题ID
   * @param {string} answer - 回答内容
   * @param {string} resumeText - 简历文本（用于AI评估）
   * @param {Object} pool - 数据库连接池
   * @returns {Promise<Object>} - 评估结果和下一问题
   */
  async submitAnswer(sessionId, questionId, answer, resumeText, pool) {
    const session = await this.getById(sessionId, pool);
    if (!session) {
      throw new Error('会话不存在');
    }
    if (session.status !== 'in_progress') {
      throw new Error('面试已结束');
    }

    const conversation = session.conversation || [];
    const currentQuestion = session.currentQuestion;

    // 找到当前问题
    const currentQA = conversation[currentQuestion];
    if (!currentQA) {
      throw new Error('问题不存在');
    }

    // 调用 AI 评估回答（带错误处理）
    let evaluation;
    try {
      evaluation = await aiInterviewService.evaluateAnswer(
        resumeText,
        currentQA.question,
        answer,
        session.positionInfo,
        conversation
      );
    } catch (error) {
      console.error('[提交回答] AI 评估失败，使用默认评分:', error.message);
      // 使用默认评分
      evaluation = {
        scores: {
          relevance: 7,
          clarity: 7,
          depth: 6,
          professionalism: 7,
          authenticity: 7
        },
        totalScore: 6.8,
        feedback: '回答已记录，系统暂时无法提供详细评估。',
        strengths: [],
        improvements: [],
        nextAction: 'continue',
        nextQuestion: null
      };
    }

    // 计算本题得分
    const questionScore = scoringService.calculateQuestionScore(evaluation.scores);

    // 更新对话记录
    currentQA.answer = answer;
    currentQA.scores = evaluation.scores;
    currentQA.score = questionScore;
    currentQA.feedback = evaluation.feedback;
    currentQA.strengths = evaluation.strengths || [];
    currentQA.improvements = evaluation.improvements || [];
    currentQA.answeredAt = new Date().toISOString();

    // 准备下一题
    let nextQuestion = null;
    const nextQuestionIndex = currentQuestion + 1;

    if (nextQuestionIndex < session.totalQuestions) {
      // 生成下一题（带错误处理）
      try {
        if (evaluation.nextAction === 'probe' && evaluation.nextQuestion) {
          // 追问
          nextQuestion = {
            id: uuidv4(),
            question: evaluation.nextQuestion,
            questionType: 'follow-up',
            intent: '追问细节',
            answer: null,
            scores: null,
            score: null,
            askedAt: new Date().toISOString()
          };
        } else {
          // 新问题 - 使用 generateNextQuestion 传入已问问题避免重复
          const askedQuestions = conversation
            .filter(item => item.question)
            .map(item => ({ question: item.question, questionType: item.questionType }));
          const nextQuestionData = await aiInterviewService.generateNextQuestion(
            resumeText,
            session.positionInfo,
            session.difficulty,
            askedQuestions
          );
          nextQuestion = {
            id: uuidv4(),
            question: nextQuestionData.question,
            questionType: nextQuestionData.questionType,
            intent: nextQuestionData.intent,
            answer: null,
            scores: null,
            score: null,
            askedAt: new Date().toISOString()
          };
        }
      } catch (error) {
        console.error('[提交回答] 生成下一题失败:', error.message);
        // 使用备用问题（多样化）
        const backupQuestions = [
          { question: '请描述一个您主导的技术方案选型过程，您是如何做决策的？', type: 'project' },
          { question: '当您与产品经理对需求理解不一致时，您通常如何处理？', type: 'situational' },
          { question: '请分享一次您在项目中遇到的最大技术挑战及解决思路。', type: 'experience' },
          { question: '如果让您重新设计一个您参与过的系统，您会做哪些改进？', type: 'project' },
          { question: '您如何看待这个行业未来3年的技术发展趋势？', type: 'career' },
          { question: '请举例说明您是如何在团队中推动一项技术改进的？', type: 'behavioral' },
          { question: '假设项目上线前发现严重bug，您会如何处理？', type: 'situational' },
          { question: '您在技术学习中有什么方法论？请具体说明。', type: 'technical' }
        ];
        const backupItem = backupQuestions[nextQuestionIndex % backupQuestions.length];
        nextQuestion = {
          id: uuidv4(),
          question: backupItem.question,
          questionType: backupItem.type,
          intent: '综合考察',
          answer: null,
          scores: null,
          score: null,
          askedAt: new Date().toISOString()
        };
      }

      conversation.push(nextQuestion);
    }

    // 更新会话
    const isComplete = nextQuestionIndex >= session.totalQuestions;
    let scoring = scoringService.calculateFinalScore(conversation);

    // 如果面试完成，生成详细报告
    if (isComplete) {
      try {
        const reportData = await aiInterviewService.generateReport(
          resumeText,
          conversation,
          session.positionInfo
        );
        scoring = {
          ...scoring,
          summary: reportData.summary || '',
          strengths: reportData.strengths || [],
          weaknesses: reportData.weaknesses || [],
          suggestions: reportData.suggestions || [],
          interviewTips: reportData.interviewTips || []
        };
        console.log('[提交回答] AI 报告生成成功');
      } catch (e) {
        console.error('[提交回答] AI 报告生成失败:', e.message);
        scoring.summary = '面试已完成';
        scoring.strengths = [];
        scoring.weaknesses = [];
        scoring.suggestions = [];
      }
    }

    await pool.execute(
      `UPDATE interview_sessions
       SET current_question = ?,
           conversation = ?,
           scoring = ?,
           status = ?,
           end_time = ?,
           duration = TIMESTAMPDIFF(SECOND, start_time, NOW()),
           final_score = ?,
           grade = ?
       WHERE id = ?`,
      [
        isComplete ? currentQuestion : nextQuestionIndex,
        JSON.stringify(conversation),
        JSON.stringify(scoring),
        isComplete ? 'completed' : 'in_progress',
        isComplete ? new Date() : null,
        isComplete ? scoring.totalScore : null,
        isComplete ? scoring.grade : null,
        sessionId
      ]
    );

    return {
      evaluation: {
        scores: evaluation.scores,
        totalScore: questionScore,
        feedback: evaluation.feedback,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements
      },
      nextQuestion: isComplete ? null : nextQuestion,
      isComplete,
      progress: {
        current: nextQuestionIndex,
        total: session.totalQuestions
      }
    };
  }

  /**
   * 开始面试（生成第一个问题）
   * @param {string} sessionId - 会话ID
   * @param {string} resumeText - 简历文本
   * @param {Object} pool - 数据库连接池
   * @returns {Promise<Object>} - 第一个问题
   */
  async start(sessionId, resumeText, pool) {
    const session = await this.getById(sessionId, pool);
    if (!session) {
      throw new Error('会话不存在');
    }

    // 生成第一个问题
    const firstQuestionData = await aiInterviewService.generateFirstQuestion(
      resumeText,
      session.positionInfo,
      session.difficulty
    );

    const firstQuestion = {
      id: uuidv4(),
      question: firstQuestionData.question,
      questionType: firstQuestionData.questionType,
      intent: firstQuestionData.intent,
      answer: null,
      scores: null,
      score: null,
      askedAt: new Date().toISOString()
    };

    // 更新会话
    await pool.execute(
      `UPDATE interview_sessions
       SET conversation = ?, current_question = 0
       WHERE id = ?`,
      [JSON.stringify([firstQuestion]), sessionId]
    );

    return firstQuestion;
  }

  /**
   * 完成面试
   * @param {string} sessionId - 会话ID
   * @param {Object} pool - 数据库连接池
   * @returns {Promise<Object>} - 面试报告
   */
  async complete(sessionId, pool) {
    const session = await this.getById(sessionId, pool);
    if (!session) {
      throw new Error('会话不存在');
    }

    const conversation = session.conversation || [];
    const basicScoring = scoringService.calculateFinalScore(conversation);

    // 获取简历文本用于生成报告
    let resumeText = '';
    try {
      const resumeService = require('./resumeService');
      const resume = await resumeService.getById(session.resumeId, pool);
      resumeText = resume?.parsedText || '';
    } catch (e) {
      console.log('[完成面试] 获取简历失败:', e.message);
    }

    // 调用 AI 生成详细报告（包含 strengths, weaknesses, suggestions）
    let reportData = {};
    try {
      reportData = await aiInterviewService.generateReport(
        resumeText,
        conversation,
        session.positionInfo
      );
      console.log('[完成面试] AI 报告生成成功');
    } catch (e) {
      console.error('[完成面试] AI 报告生成失败:', e.message);
      // 使用基础评分
      reportData = {
        overallScore: basicScoring.totalScore,
        grade: basicScoring.grade,
        summary: '面试已完成',
        strengths: [],
        weaknesses: [],
        suggestions: []
      };
    }

    // 合并评分数据
    const scoring = {
      ...basicScoring,
      summary: reportData.summary || '',
      strengths: reportData.strengths || [],
      weaknesses: reportData.weaknesses || [],
      suggestions: reportData.suggestions || [],
      interviewTips: reportData.interviewTips || []
    };

    await pool.execute(
      `UPDATE interview_sessions
       SET status = 'completed',
           end_time = NOW(),
           duration = TIMESTAMPDIFF(SECOND, start_time, NOW()),
           scoring = ?,
           final_score = ?,
           grade = ?
       WHERE id = ?`,
      [JSON.stringify(scoring), scoring.totalScore, scoring.grade, sessionId]
    );

    return {
      sessionId,
      scoring,
      duration: session.duration
    };
  }

  /**
   * 取消面试
   * @param {string} sessionId - 会话ID
   * @param {Object} pool - 数据库连接池
   * @returns {Promise<boolean>}
   */
  async cancel(sessionId, pool) {
    const [result] = await pool.execute(
      `UPDATE interview_sessions
       SET status = 'cancelled', end_time = NOW()
       WHERE id = ? AND status = 'in_progress'`,
      [sessionId]
    );
    return result.affectedRows > 0;
  }

  /**
   * 删除面试会话
   * @param {string} sessionId - 会话ID
   * @param {Object} pool - 数据库连接池
   * @returns {Promise<boolean>}
   */
  async delete(sessionId, pool) {
    const [result] = await pool.execute(
      'DELETE FROM interview_sessions WHERE id = ?',
      [sessionId]
    );
    return result.affectedRows > 0;
  }

  /**
   * 格式化会话详情
   */
  formatSession(row) {
    return {
      id: row.id,
      userId: row.user_id,
      resumeId: row.resume_id,
      positionId: row.position_id,
      positionInfo: this.parseJSON(row.position_info),
      difficulty: row.difficulty,
      mode: row.mode,
      totalQuestions: row.total_questions,
      currentQuestion: row.current_question,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
      conversation: this.parseJSON(row.conversation),
      scoring: this.parseJSON(row.scoring),
      finalScore: row.final_score,
      grade: row.grade,
      metadata: this.parseJSON(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 格式化会话摘要
   */
  formatSessionSummary(row) {
    return {
      id: row.id,
      positionInfo: this.parseJSON(row.position_info),
      difficulty: row.difficulty,
      totalQuestions: row.total_questions,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
      finalScore: row.final_score,
      grade: row.grade,
      createdAt: row.created_at
    };
  }

  /**
   * 安全解析 JSON
   */
  parseJSON(str) {
    if (!str) return null;
    try {
      return typeof str === 'string' ? JSON.parse(str) : str;
    } catch {
      return null;
    }
  }
}

module.exports = new SessionService();
