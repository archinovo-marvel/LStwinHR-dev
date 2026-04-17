/**
 * 风险识别服务
 * 识别简历中的潜在风险和问题
 * 风险评估基于岗位核心技能要求，避免无关领域的风险误判
 */
const { getPositionConfig } = require('./positionConfig');

class RiskService {
  /**
   * 识别简历风险，基于岗位配置进行个性化评估
   * @param {string} text - 简历文本
   * @param {object} extractedContent - 提取的内容
   * @param {object} matchResult - 匹配结果
   * @param {string} position - 目标岗位
   * @returns {array} 风险列表
   */
  identifyRisks(text, extractedContent, matchResult, position) {
    const risks = [];
    const positionConfig = getPositionConfig(position);
    const coreSkills = positionConfig?.coreSkills || [];
    const businessSkills = positionConfig?.businessSkills || [];
    const targetSkills = [...coreSkills, ...businessSkills];

    // 只检查与岗位相关的风险项
    risks.push(...this.checkContactInfo(extractedContent));
    risks.push(...this.checkTextLength(text));
    risks.push(...this.checkPositionRelatedSkills(matchResult, targetSkills, position));
    risks.push(...this.checkPositionRelatedExperience(extractedContent, position, positionConfig));
    risks.push(...this.checkProjectDescription(extractedContent, position));
    risks.push(...this.checkResumeQuality(text, extractedContent));

    // 按严重程度排序，但限制高风险项数量，避免过度严格
    const sortedRisks = risks.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // 如果高风险项超过2个，将部分降级为中等风险
    const highRiskCount = sortedRisks.filter(r => r.severity === 'high').length;
    if (highRiskCount > 2) {
      return sortedRisks.map((risk, index) => {
        if (risk.severity === 'high' && index >= 2) {
          return { ...risk, severity: 'medium' };
        }
        return risk;
      });
    }

    return sortedRisks;
  }

  /**
   * 检查岗位核心技能匹配情况
   * 只检查与目标岗位相关的技能，避免无关技能的风险误判
   */
  checkPositionRelatedSkills(matchResult, targetSkills, position) {
    const risks = [];

    if (!matchResult || targetSkills.length === 0) {
      return risks;
    }

    const matchedSkillNames = (matchResult.matchedSkills || []).map(s => s.skill);
    const missingCoreSkills = targetSkills.filter(skill =>
      !matchedSkillNames.some(matched =>
        matched.toLowerCase().includes(skill.toLowerCase()) ||
        skill.toLowerCase().includes(matched.toLowerCase())
      )
    );

    // 只有当核心技能缺失超过3项时才标记为中等风险（降低严格度）
    if (missingCoreSkills.length > 3) {
      risks.push({
        type: 'SKILL_GAP',
        category: '技能匹配',
        title: `${position}岗位部分核心技能未体现`,
        message: `简历中未明确体现${missingCoreSkills.slice(0, 3).join('、')}等技能`,
        description: `建议在面试中重点考察候选人对${position}核心技能的实际掌握情况`,
        severity: 'medium',
        suggestion: `面试时请验证候选人对${missingCoreSkills[0]}等关键技能的掌握程度`
      });
    } else if (missingCoreSkills.length > 0 && missingCoreSkills.length <= 3) {
      // 缺失少量核心技能时标记为低风险
      risks.push({
        type: 'SKILL_GAP_MINOR',
        category: '技能匹配',
        title: `${missingCoreSkills.slice(0, 2).join('、')}技能待验证`,
        message: `简历中对${missingCoreSkills.slice(0, 2).join('、')}的描述不明显`,
        description: `可在面试中进一步确认`,
        severity: 'low',
        suggestion: `建议面试时询问相关技能的实际应用经验`
      });
    }

    return risks;
  }

  /**
   * 检查岗位相关的工作/项目经历
   * 只关注与目标岗位相关的经历缺失，不检查无关领域
   */
  checkPositionRelatedExperience(extractedContent, position, positionConfig) {
    const risks = [];
    const workExperience = extractedContent.workExperience || [];
    const projectExperience = extractedContent.projects || extractedContent.projectExperience || [];
    const experienceKeywords = positionConfig?.experience || [];

    // 只有完全没有工作经历时才标记为中等风险（降低严格度）
    if (workExperience.length === 0 && projectExperience.length === 0) {
      risks.push({
        type: 'NO_EXPERIENCE',
        category: '经历匹配',
        title: '缺乏工作/项目经历',
        message: '简历中未检测到相关工作或项目经历',
        description: '可能是应届生或简历格式问题，建议进一步了解候选人的实践经历',
        severity: 'medium',
        suggestion: '建议在面试中了解候选人的实习、课程项目或其他实践经历'
      });
      return risks;
    }

    // 检查经历是否与岗位关键词相关
    const allExperienceText = [
      ...workExperience.map(w => (w.description || '') + (w.role || '') + (w.companyOrOrg || '')),
      ...projectExperience.map(p => (p.description || '') + (p.name || '') + (p.role || ''))
    ].join(' ').toLowerCase();

    const relevantKeywords = experienceKeywords.filter(keyword =>
      allExperienceText.includes(keyword.toLowerCase())
    );

    // 只有当完全没有相关经历关键词时才标记低风险
    if (relevantKeywords.length === 0 && experienceKeywords.length > 0) {
      risks.push({
        type: 'EXPERIENCE_RELEVANCE',
        category: '经历匹配',
        title: `经历与${position}相关性待确认`,
        message: `现有经历描述中未明显体现${position}相关内容`,
        description: `建议在面试中了解候选人的实际工作内容是否与目标岗位匹配`,
        severity: 'low',
        suggestion: `面试时可询问过往经历中与${position}相关的工作内容`
      });
    }

    return risks;
  }
  checkContactInfo(extractedContent) {
    const risks = [];
    const personalInfo = extractedContent.basicInfo || extractedContent.personalInfo || {};

    // 只在完全缺少联系方式时标记中等风险（降低严格度）
    if (!personalInfo.phone && !personalInfo.email) {
      risks.push({
        type: 'CONTACT_MISSING',
        category: '联系方式',
        title: '缺少联系方式',
        message: '简历中未检测到电话或邮箱',
        description: '建议联系候选人补充联系方式',
        severity: 'medium',
        suggestion: '建议联系候选人补充联系电话或邮箱地址'
      });
    } else if (!personalInfo.phone) {
      risks.push({
        type: 'PHONE_MISSING',
        category: '联系方式',
        title: '缺少联系电话',
        message: '简历中未检测到电话号码',
        description: '有邮箱但缺少电话',
        severity: 'low',
        suggestion: '建议联系候选人补充联系电话'
      });
    }

    return risks;
  }

  checkTextLength(text) {
    const risks = [];
    if (!text) {
      risks.push({
        type: 'TEXT_TOO_SHORT',
        category: '简历质量',
        title: '简历内容为空',
        message: '简历解析未提取到有效内容',
        description: '可能存在解析问题，建议检查原始文件',
        severity: 'high',
        suggestion: '简历解析失败，请检查文件格式'
      });
      return risks;
    }

    // 降低严格度：文本少于100字符才标记高风险
    if (text.length < 100) {
      risks.push({
        type: 'TEXT_TOO_SHORT',
        category: '简历质量',
        title: '简历信息过少',
        message: `简历文本仅${text.length}字符`,
        description: '可能存在解析问题或简历本身信息不完整',
        severity: 'high',
        suggestion: '建议检查原始简历文件或联系候选人重新提交'
      });
    } else if (text.length < 300) {
      risks.push({
        type: 'TEXT_SHORT',
        category: '简历质量',
        title: '简历内容较少',
        message: `简历文本${text.length}字符`,
        description: '内容相对简略',
        severity: 'low',
        suggestion: '建议候选人补充更多详细信息'
      });
    }

    return risks;
  }

  /**
   * 检查项目描述质量
   * 降低严格度，项目描述短不一定是问题
   */
  checkProjectDescription(extractedContent, position) {
    const risks = [];
    const projects = extractedContent.projects || extractedContent.projectExperience || [];

    // 如果完全没有项目经历，但可能是应届生或实习生，不一定标记为风险
    // 只有当完全没有工作经历和项目经历时才提示
    const workExperience = extractedContent.workExperience || [];
    if (projects.length === 0 && workExperience.length === 0) {
      // 已在 checkPositionRelatedExperience 中处理，这里不重复标记
      return risks;
    }

    // 只对有项目但描述过于简单的情况提示（降低严格度：描述少于15字符）
    projects.forEach((project, index) => {
      const descText = Array.isArray(project.description)
        ? project.description.join('')
        : (project.description || '');
      const descLength = descText.length;

      if (descLength < 15 && projects.length <= 2) {
        risks.push({
          type: 'VAGUE_PROJECT',
          category: '项目经历',
          title: `项目"${project.name || '未命名'}"描述简略`,
          message: `项目描述较短，建议了解详情`,
          description: `可在面试中详细了解项目细节`,
          severity: 'low',
          suggestion: '建议在面试中详细了解候选人在项目中的具体职责和贡献'
        });
      }
    });

    return risks;
  }
  checkActionWords(descriptions) {
    const actionWords = ['负责', '开发', '设计', '实现', '完成', '参与', '主导', '组织', '编写', '优化'];
    const text = Array.isArray(descriptions) ? descriptions.join('') : String(descriptions || '');
    return actionWords.some(word => text.includes(word));
  }

  /**
   * 检查简历整体质量
   * 降低严格度，避免过度标记低风险项
   */
  checkResumeQuality(text, extractedContent) {
    const risks = [];

    // 检查中文内容占比（仅对明显问题的简历标记）
    if (text && text.length > 200) {
      const chineseRatio = (text.match(/[\u4e00-\u9fa5]/g) || []).length / text.length;
      // 只有当中文占比极低时才提示（降低严格度：0.2 -> 0.15）
      if (chineseRatio < 0.15) {
        risks.push({
          type: 'LANGUAGE_ISSUE',
          category: '简历质量',
          title: '简历可能是英文',
          message: '中文内容占比很低',
          description: '简历可能是英文版本或存在解析问题',
          severity: 'low',
          suggestion: '如需要中文简历，建议联系候选人提供'
        });
      }
    }

    // 检查技能列表 - 只在完全没有技能时标记低风险
    const skills = extractedContent.skills || [];
    if (skills.length === 0) {
      risks.push({
        type: 'NO_SKILLS',
        category: '技能信息',
        title: '技能描述不明显',
        message: '简历中未检测到明确的技能列表',
        description: '简历可能缺少技能专长部分',
        severity: 'low',
        suggestion: '建议在面试中了解候选人的技术能力'
      });
    }

    return risks;
  }

  generateRiskSummary(risks) {
    const summary = {
      total: risks.length,
      high: risks.filter(r => r.severity === 'high').length,
      medium: risks.filter(r => r.severity === 'medium').length,
      low: risks.filter(r => r.severity === 'low').length,
      categories: [...new Set(risks.map(r => r.category))],
      topRisks: risks.filter(r => r.severity === 'high').slice(0, 3)
    };
    return summary;
  }
}

module.exports = new RiskService();
