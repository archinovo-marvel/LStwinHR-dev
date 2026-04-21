const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs').promises;
const {
  getCandidateByIdGlobal,
  updateCandidateById,
  ensureCandidateDatabase
} = require('../services/candidateStore');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_this_in_production';
const DATA_FILE = path.join(__dirname, '..', '..', 'candidate-data.json');

// NOTE: scheduleResumeAnalysis and ensureDataFile are passed as dependencies
// when calling createResumeRouter()

// Helper to resolve owner from token
function resolveOwnerFromRequest(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return { id: decoded.id, username: decoded.username, email: decoded.email };
    } catch {}
  }
  return null;
}

// Create resume router with dependencies
function createResumeRouter({ ensureDataFile, scheduleResumeAnalysis } = {}) {
  const router = express.Router();

  // GET /api/resume-preview/:id - Generate HTML preview of candidate resume
  router.get('/resume-preview/:id', async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);

      if (ensureDataFile) await ensureDataFile();

      const owner = resolveOwnerFromRequest(req);
      if (!owner) return res.status(401).json({ error: '未授权，请先登录' });

      await ensureCandidateDatabase(owner.id);

      const data = await fs.readFile(DATA_FILE, 'utf8');
      const candidates = JSON.parse(data);
      const candidate = candidates.find(c => c.id === candidateId);

      if (!candidate) {
        return res.status(404).send('候选人不存在');
      }

      // Generate PDF preview page
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${candidate.name} - 简历预览</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background: #f5f5f5;
            }
            .resume-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #1890ff;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .section {
              margin-bottom: 25px;
            }
            .section-title {
              font-size: 18px;
              font-weight: bold;
              color: #1890ff;
              margin-bottom: 15px;
              border-left: 4px solid #1890ff;
              padding-left: 10px;
            }
            .info-row {
              display: flex;
              margin-bottom: 8px;
            }
            .info-label {
              font-weight: bold;
              width: 100px;
              color: #666;
            }
            .skills {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
            }
            .skill-tag {
              background: #e6f7ff;
              color: #1890ff;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
            }
            .analysis-section {
              background: #f6ffed;
              border: 1px solid #b7eb8f;
              border-radius: 6px;
              padding: 15px;
              margin-top: 20px;
            }
            .highlight {
              color: #52c41a;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="resume-container">
            <div class="header">
              <h1>${candidate.name}</h1>
              <p style="color: #666; margin: 5px 0;">${candidate.position} | ${candidate.mbti || 'MBTI待完成'}</p>
            </div>

            <div class="section">
              <div class="section-title">基本信息</div>
              <div class="info-row">
                <span class="info-label">姓名:</span>
                <span>${candidate.name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">应聘职位:</span>
                <span>${candidate.position}</span>
              </div>
              <div class="info-row">
                <span class="info-label">联系电话:</span>
                <span>${candidate.phone}</span>
              </div>
              <div class="info-row">
                <span class="info-label">邮箱地址:</span>
                <span>${candidate.email}</span>
              </div>
              <div class="info-row">
                <span class="info-label">MBTI类型:</span>
                <span>${candidate.mbti || '未完成'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">提交时间:</span>
                <span>${candidate.submitTime}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">简历文件信息</div>
              <div class="info-row">
                <span class="info-label">文件名:</span>
                <span>${candidate.resumeFileName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">文件大小:</span>
                <span>${candidate.resumeSize ? (candidate.resumeSize / 1024).toFixed(1) + ' KB' : '未知'}</span>
              </div>
            </div>

            ${candidate.analysisDetails?.resumeAnalysis ? `
            <div class="section">
              <div class="section-title">技能匹配</div>
              <div class="skills">
                ${candidate.analysisDetails.resumeAnalysis.skillMatches.map(match =>
                  `<span class="skill-tag">${match.skill} (${match.type === 'core' ? '核心' : '商业'})</span>`
                ).join('')}
              </div>
            </div>

            <div class="analysis-section">
              <div class="section-title">简历分析亮点</div>
              <ul>
                ${candidate.analysisDetails.resumeAnalysis.highlights.map(highlight =>
                  `<li class="highlight">${highlight}</li>`
                ).join('')}
              </ul>
            </div>
            ` : ''}

            <div class="section">
              <div class="section-title">匹配度评估</div>
              <div class="info-row">
                <span class="info-label">综合匹配度:</span>
                <span style="color: #1890ff; font-weight: bold;">${candidate.matchScore}%</span>
              </div>
              <div class="info-row">
                <span class="info-label">推荐理由:</span>
                <span>${candidate.recommendation}</span>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      console.error('生成PDF预览失败:', error);
      res.status(500).send('生成预览失败');
    }
  });

  // GET /api/resume-file/:id - Get actual resume file for preview/download
  router.get('/resume-file/:id', async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);

      // Get candidate from database
      const candidate = await getCandidateByIdGlobal(candidateId, { includeBlob: true });

      if (!candidate) {
        return res.status(404).send('候选人不存在');
      }

      // Check if candidate has resume file
      if (!candidate.resumeFileBuffer && !candidate.resumeFilePath) {
        return res.status(404).send('简历文件不存在');
      }

      // Determine file extension and content type
      let ext, contentType;

      if (candidate.resumeFileBuffer && candidate.resumeFileName) {
        ext = path.extname(candidate.resumeFileName).toLowerCase();
      } else if (candidate.resumeFilePath) {
        ext = path.extname(candidate.resumeFilePath).toLowerCase();
      } else {
        return res.status(404).send('无法确定简历文件格式');
      }

      contentType = 'application/octet-stream';
      if (ext === '.pdf') {
        contentType = 'application/pdf';
      } else if (ext === '.doc') {
        contentType = 'application/msword';
      } else if (ext === '.docx') {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (ext === '.jpg' || ext === '.jpeg') {
        contentType = 'image/jpeg';
      } else if (ext === '.png') {
        contentType = 'image/png';
      }

      // Set response headers
      const previewFileName = candidate.resumeFileName || `resume_${candidate.id}${ext}`;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="resume${ext}"; filename*=UTF-8''${encodeURIComponent(previewFileName)}`);

      // Send file content
      if (candidate.resumeFileBuffer) {
        res.send(candidate.resumeFileBuffer);
      } else if (candidate.resumeFilePath) {
        const fileBuffer = await fs.readFile(candidate.resumeFilePath);
        res.send(fileBuffer);
      }
    } catch (error) {
      console.error('预览简历文件失败:', error);
      res.status(500).send('预览失败');
    }
  });

  // POST /api/analyze-resume/:id - Trigger resume analysis
  router.post('/analyze-resume/:id', async (req, res) => {
    req.setTimeout(300000);
    res.setTimeout(300000);

    try {
      const candidateId = parseInt(req.params.id);
      const forceReanalyze = true;

      if (isNaN(candidateId)) {
        return res.status(400).json({ error: '无效的候选人ID' });
      }

      console.log(`开始分析简历，候选人ID: ${candidateId}`);

      // Get candidate from database
      const candidate = await getCandidateByIdGlobal(candidateId, { includeBlob: true });

      if (!candidate) {
        return res.status(404).json({ error: '候选人不存在' });
      }

      if (!candidate.resumeFileBuffer && !candidate.resumeFilePath) {
        return res.status(404).json({ error: '简历文件不存在' });
      }

      // Check if file exists (if path is specified)
      if (candidate.resumeFilePath && !candidate.resumeFileBuffer) {
        try {
          await fs.access(candidate.resumeFilePath);
        } catch (error) {
          return res.status(404).json({ error: '简历文件已丢失' });
        }
      }

      // Determine file extension
      let fileExt;
      if (candidate.resumeFileBuffer && candidate.resumeFileName) {
        fileExt = path.extname(candidate.resumeFileName).toLowerCase();
      } else if (candidate.resumeFilePath) {
        fileExt = path.extname(candidate.resumeFilePath).toLowerCase();
      } else {
        return res.status(400).json({ error: '无法确定简历文件格式' });
      }

      if (!['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'].includes(fileExt)) {
        return res.status(400).json({ error: '不支持的文件格式' });
      }

      // Update candidate status to analyzing
      await updateCandidateById(candidateId, {
        status: '分析中',
        recommendation: '简历分析已加入后台队列，请稍候自动刷新结果'
      });

      if (scheduleResumeAnalysis) {
        scheduleResumeAnalysis(candidateId, { renameAfterAnalysis: false, forceReanalyze, trigger: 'manual' });
      }

      res.status(202).json({
        success: true,
        queued: true,
        message: '简历已加入后台分析队列',
        candidate: { ...candidate, status: '分析中' }
      });

    } catch (error) {
      console.error('简历分析失败:', error);
      console.error('错误堆栈:', error.stack);

      if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        res.status(504).json({ error: '简历分析超时，请稍后重试' });
      } else if (error.code === 'ENOENT') {
        res.status(404).json({ error: '简历文件不存在' });
      } else if (error.message.includes('memory')) {
        res.status(413).json({ error: '文件过大，请压缩后重试' });
      } else {
        res.status(500).json({ error: '简历分析失败: ' + error.message });
      }
    }
  });

  return router;
}

module.exports = { createResumeRouter };
