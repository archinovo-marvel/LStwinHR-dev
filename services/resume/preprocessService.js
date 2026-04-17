/**
 * 文本预处理服务（重构版）
 * 负责简历文本的清洗、标准化和分段处理
 * 增强对工作经历和项目经历的分割能力
 */
class PreprocessService {
  constructor() {
    this.sectionPatterns = {
      personalInfo: /(个人信息|基本资料|个人简介|联系方式|basic\s*info|personal\s*info)/i,
      education: /(教育背景|教育经历|学历|学习经历|education|academic)/i,
      workExperience: /(工作经历|工作经验|工作背景|职业经历|实习经历|work\s*experience|employment)/i,
      project: /(项目经历|项目经验|项目背景|project\s*experience|projects)/i,
      projectExperience: /(项目经历|项目经验|项目背景|project\s*experience|projects)/i,
      skills: /(专业技能|技能专长|技术能力|技能|skills|technical\s*skills)/i,
      selfEvaluation: /(自我评价|个人总结|个人优势|self\s*evaluation|summary)/i,
      evaluation: /(自我评价|个人总结|个人优势|self\s*evaluation|summary)/i,
      achievements: /(获奖情况|荣誉证书|成就|achievements|honors|awards)/i
    };
    this.workKeywords = ['公司', '有限公司', '股份公司', '集团', '企业', '实习', '任职', '就职', '工作单位', '雇主'];
    this.projectKeywords = ['项目名称', '项目经历', '项目经验', '项目描述', '毕业设计', '课程设计', '个人项目', '团队项目'];
  }
  preprocess(text) {
    if (!text || typeof text !== 'string') {
      return {
        original: '',
        cleaned: '',
        normalized: '',
        sections: {},
        stats: {
          originalLength: 0,
          cleanedLength: 0,
          sectionCount: 0
        }
      };
    }
    const original = text;
    const cleaned = this.cleanText(text);
    const normalized = this.normalizeText(cleaned);
    const sections = this.segmentSections(normalized);
    return {
      original,
      cleaned,
      normalized,
      sections,
      stats: {
        originalLength: original.length,
        cleanedLength: cleaned.length,
        sectionCount: Object.keys(sections).filter(key => sections[key].length > 0).length
      }
    };
  }
  cleanText(text) {
    let cleaned = text;
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
    cleaned = cleaned.replace(/\r\n/g, '\n');
    cleaned = cleaned.replace(/\r/g, '\n');
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    cleaned = cleaned.replace(/\n[ \t]+/g, '\n');
    cleaned = cleaned.replace(/[ \t]+\n/g, '\n');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.trim();
    return cleaned;
  }
  normalizeText(text) {
    let normalized = text;
    const punctuationMap = {
      '，': ',',
      '。': '.',
      '！': '!',
      '？': '?',
      '；': ';',
      '：': ':',
      '"': '"',
      '"': '"',
      '“': '"',
      '”': '"',
      '‘': "'",
      '’': "'",
      '）': ')',
      '【': '[',
      '】': ']',
      '《': '<',
      '》': '>',
      '—': '-',
      '～': '~'
    };
    Object.entries(punctuationMap).forEach(([cn, en]) => {
      const regex = new RegExp(cn, 'g');
      normalized = normalized.replace(regex, en);
    });
    // OCR 常会把中文逐字打散，这里尽量恢复常见的中文连续词
    normalized = normalized.replace(/([\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, '$1');
    normalized = normalized
      .split('\n')
      .map(line => line.replace(/[ \t]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return normalized;
  }
  segmentSections(text) {
    const sections = {
      personalInfo: '',
      education: '',
      workExperience: '',
      project: '',
      projectExperience: '',
      skills: '',
      selfEvaluation: '',
      evaluation: '',
      achievements: '',
      other: ''
    };
    const lines = text.split('\n');
    let currentSection = 'other';
    let sectionContent = [];
    lines.forEach(line => {
      const trimmedLine = line.trim();
      let foundSection = null;
      for (const [sectionName, pattern] of Object.entries(this.sectionPatterns)) {
        if (pattern.test(trimmedLine)) {
          foundSection = sectionName;
          break;
        }
      }
      if (foundSection) {
        if (sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join('\n').trim();
        }
        currentSection = foundSection;
        sectionContent = [];
      } else {
        sectionContent.push(line);
      }
    });
    if (sectionContent.length > 0) {
      sections[currentSection] = sectionContent.join('\n').trim();
    }
    if (!sections.workExperience && sections.project) {
      const { workExp, projectExp } = this.separateWorkAndProject(sections.project);
      if (workExp) sections.workExperience = workExp;
      if (projectExp) sections.projectExperience = projectExp;
    }
    if (!sections.projectExperience && sections.project) {
      sections.projectExperience = sections.project;
    }
    return sections;
  }
  separateWorkAndProject(text) {
    if (!text) return { workExp: '', projectExp: '' };
    const lines = text.split('\n');
    const workLines = [];
    const projectLines = [];
    let currentMode = 'unknown';
    let currentBlock = [];
    const flushBlock = () => {
      if (currentBlock.length === 0) return;
      const blockText = currentBlock.join('\n');
      if (currentMode === 'work') {
        workLines.push(blockText);
      } else if (currentMode === 'project') {
        projectLines.push(blockText);
      }
      currentBlock = [];
    };
    for (const line of lines) {
      const trimmed = line.trim();
      const hasWorkKeyword = this.workKeywords.some(kw => trimmed.includes(kw));
      const hasProjectKeyword = this.projectKeywords.some(kw => trimmed.includes(kw));
      const hasCompany = /(?:有限公司|股份|集团|公司|企业|事务所)/.test(trimmed);
      const hasTimeRange = /20\d{2}\s*[-~—至]/.test(trimmed);
      if (hasProjectKeyword && !hasWorkKeyword) {
        flushBlock();
        currentMode = 'project';
        currentBlock.push(line);
      } else if (hasCompany || (hasWorkKeyword && !hasProjectKeyword)) {
        flushBlock();
        currentMode = 'work';
        currentBlock.push(line);
      } else if (hasTimeRange && currentMode !== 'unknown') {
        currentBlock.push(line);
      } else if (currentMode !== 'unknown') {
        currentBlock.push(line);
      } else {
        currentBlock.push(line);
      }
    }
    flushBlock();
    return {
      workExp: workLines.join('\n'),
      projectExp: projectLines.join('\n')
    };
  }
  extractSentences(text) {
    if (!text) return [];
    const sentences = text
      .split(/[。！？.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 5);
    return sentences;
  }
  extractKeywords(text, minWordLength = 2) {
    if (!text) return [];
    const words = text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= minWordLength);
    return [...new Set(words)];
  }
  calculateTextQuality(text) {
    if (!text) {
      return {
        score: 0,
        issues: ['文本为空']
      };
    }
    const issues = [];
    let score = 100;
    if (text.length < 200) {
      issues.push('简历文本过短，可能信息不完整');
      score -= 30;
    } else if (text.length < 500) {
      issues.push('简历内容较少，建议补充更多信息');
      score -= 15;
    }
    const chineseRatio = (text.match(/[\u4e00-\u9fa5]/g) || []).length / text.length;
    if (chineseRatio < 0.3 && text.length > 100) {
      issues.push('中文内容占比过低，可能存在解析问题');
      score -= 10;
    }
    const numberCount = (text.match(/\d+/g) || []).length;
    if (numberCount < 3) {
      issues.push('缺少具体数据支撑');
      score -= 10;
    }
    const hasPhone = /1[3-9]\d{9}/.test(text);
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text);
    if (!hasPhone) {
      issues.push('缺少联系电话');
      score -= 15;
    }
    if (!hasEmail) {
      issues.push('缺少邮箱地址');
      score -= 10;
    }
    return {
      score: Math.max(0, score),
      issues
    };
  }
}
module.exports = new PreprocessService();
