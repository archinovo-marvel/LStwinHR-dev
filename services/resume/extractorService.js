/**
 * 信息提取服务（重构版）
 * 从预处理后的简历文本中提取结构化信息
 * 解决：姓名识别、工作/项目混淆、模块污染、空数据问题
 */
class ExtractorService {
  constructor() {
    this.excludeNameKeywords = [
      '电话', '手机', '邮箱', 'email', 'tel', '地址', '求职', '意向', '应聘',
      '学校', '大学', '学院', '公司', '企业', '有限', '股份', '集团',
      '项目', '开发', '设计', '实现', '负责', '参与', '工作', '实习',
      '教育', '背景', '技能', '自我', '评价', '个人', '简介', '信息',
      '男', '女', '性别', '年龄', '岁', '出生', '籍贯', '民族'
    ];
    this.workKeywords = ['公司', '有限公司', '股份公司', '集团', '企业', '实习', '任职', '就职', '工作单位'];
    this.projectKeywords = ['项目名称', '项目经历', '项目经验', '项目描述', '毕业设计', '课程设计', '个人项目'];
    this.skillExcludeKeywords = ['姓名', '电话', '手机', '邮箱', '教育', '背景', '工作', '经历', '项目', '自我', '评价'];
  }
  extractAll(text, preprocessedData) {
    const sections = preprocessedData.sections || {};
    const basicInfo = this.extractPersonalInfo(text);
    const education = this.extractEducation(sections.education || text);
    const workExperience = this.extractWorkExperience(sections.workExperience || text, text);
    const projectExperience = this.extractProjects(sections.project || sections.projectExperience || text, text);
    const skills = this.extractSkills(sections.skills || text);
    const evaluation = this.extractSelfEvaluation(sections.selfEvaluation || sections.evaluation || text);
    return {
      basicInfo,
      education,
      workExperience,
      projectExperience,
      skills,
      evaluation
    };
  }
  extractPersonalInfo(text) {
    const info = { name: '', phone: '', email: '' };
    if (!text) return info;
    info.name = this.extractName(text);
    info.phone = this.extractPhone(text);
    info.email = this.extractEmail(text);
    const ageMatch = text.match(/(?:年龄|age)[：:]?\s*(\d{1,2})/i);
    if (ageMatch) info.age = parseInt(ageMatch[1]);
    const genderMatch = text.match(/性别[：:]?\s*(男|女)/i);
    if (genderMatch) info.gender = genderMatch[1];
    const locationMatch = text.match(/(?:所在地|居住地|地址|location)[：:]?\s*([^\n\r]{2,20})/i);
    if (locationMatch) info.location = locationMatch[1].trim();
    return info;
  }
  extractName(text) {
    if (!text) return '';
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      const nameFromFirstLine = this.tryExtractName(firstLine);
      if (nameFromFirstLine) return nameFromFirstLine;
    }
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      const nameFromLine = this.tryExtractName(line);
      if (nameFromLine) return nameFromLine;
    }
    const explicitPatterns = [
      /姓名[：:]\s*([^\n\r]{2,8})/i,
      /name[：:]\s*([^\n\r]{2,8})/i,
      /申请人[：:]\s*([^\n\r]{2,8})/i,
      /候选人[：:]\s*([^\n\r]{2,8})/i
    ];
    for (const pattern of explicitPatterns) {
      const match = text.match(pattern);
      if (match) {
        const name = match[1].trim();
        if (this.isValidChineseName(name)) return name;
      }
    }
    return '';
  }
  tryExtractName(text) {
    const cleaned = text.trim();
    if (cleaned.length < 2 || cleaned.length > 20) return '';
    if (this.excludeNameKeywords.some(kw => cleaned.toLowerCase().includes(kw.toLowerCase()))) {
      return '';
    }
    if (cleaned.includes('：') || cleaned.includes(':')) {
      return '';
    }
    const chineseOnly = cleaned.replace(/[^\u4e00-\u9fa5]/g, '');
    if (this.isValidChineseName(chineseOnly)) {
      return chineseOnly;
    }
    const nameMatch = cleaned.match(/^([^\s,，、|/\\]{2,4})/);
    if (nameMatch) {
      const potential = nameMatch[1];
      if (this.isValidChineseName(potential)) {
        return potential;
      }
    }
    return '';
  }
  isValidChineseName(name) {
    if (!name || name.length < 2 || name.length > 4) return false;
    const chineseRegex = /^[\u4e00-\u9fa5]{2,4}$/;
    if (!chineseRegex.test(name)) return false;
    if (this.excludeNameKeywords.some(kw => name.includes(kw))) return false;
    const commonSurnames = [
      '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴',
      '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
      '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧',
      '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕',
      '苏', '卢', '蒋', '蔡', '贾', '丁', '魏', '薛', '叶', '阎',
      '余', '潘', '杜', '戴', '夏', '钟', '汪', '田', '任', '姜',
      '范', '方', '石', '姚', '谭', '廖', '邹', '熊', '金', '陆',
      '郝', '孔', '白', '崔', '康', '毛', '邱', '秦', '江', '史',
      '顾', '侯', '邵', '孟', '龙', '万', '段', '雷', '钱', '汤',
      '尹', '黎', '易', '常', '武', '乔', '贺', '赖', '龚', '文'
    ];
    const firstChar = name.charAt(0);
    return commonSurnames.includes(firstChar);
  }
  extractPhone(text) {
    if (!text) return '';
    const patterns = [
      /电话[：:]\s*([^\n\r]{5,20})/i,
      /手机[：:]\s*([^\n\r]{5,20})/i,
      /tel[：:]\s*([^\n\r]{5,20})/i,
      /(1[3-9]\d{9})/,
      /(\+86\s*1[3-9]\d{9})/,
      /(\d{3,4}[-\s]?\d{7,8})/
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return this.normalizePhoneCandidate(match[1]);
      }
    }
    return '';
  }

  /**
   * 规范化手机号格式
   * - 移除所有空格、横线、括号等分隔符
   * - 移除 +86 国际区号前缀
   * - 确保输出为纯数字11位手机号
   * - 对于非手机号的座机号码，保持原格式但不做强制处理
   */
  normalizePhoneCandidate(value) {
    if (!value) return '';
    let candidate = String(value).trim();

    // 移除所有空格、横线、括号、点号等分隔符
    candidate = candidate.replace(/[\s\-\—\–\_\.\/\\\(\)\[\]\{\}]/g, '');

    // 移除常见的国际区号前缀
    candidate = candidate.replace(/^(\+86|86|0086)/, '');

    // 提取数字部分
    const digits = candidate.replace(/[^\d]/g, '');

    // 验证是否为有效手机号（11位，以1开头，第二位3-9）
    if (/^1[3-9]\d{9}$/.test(digits)) {
      return digits;
    }

    // 如果是座机号码（区号+号码，如010-12345678）
    if (/^\d{3,4}\d{7,8}$/.test(digits) && digits.length >= 10 && digits.length <= 12) {
      // 对于座机号，可以保持原格式或加上区号分隔
      // 这里返回纯数字格式
      return digits;
    }

    // 如果数字长度在10-11之间，可能是手机号但有前缀问题
    if (digits.length === 11 && digits.startsWith('1')) {
      return digits;
    }

    // 无法识别为有效电话号码，返回空
    return '';
  }
  extractEmail(text) {
    if (!text) return '';
    const patterns = [
      /邮箱[：:]\s*([^\n\r]{5,50})/i,
      /email[：:]\s*([^\n\r]{5,50})/i,
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const normalized = this.normalizeEmailCandidate(match[1]);
        if (normalized) return normalized;
      }
    }

    const compactText = text
      .replace(/\s+/g, '')
      .replace(/[\u2000-\u206F\u2E00-\u2E7F\\|]/g, '');
    const fuzzyPatterns = [
      /([a-zA-Z0-9._%+-]{5,32})(?:@|at)?(qq|163|126|gmail|outlook|hotmail)(?:\.|dot)?(com|cn|net)/i,
      /([a-zA-Z0-9._%+-]{5,32})(qq|163|126|gmail|outlook|hotmail)(com|cn|net)/i
    ];

    for (const pattern of fuzzyPatterns) {
      const match = compactText.match(pattern);
      if (match) {
        const normalized = this.normalizeEmailCandidate(`${match[1]}@${match[2]}.${match[3]}`);
        if (normalized) return normalized;
      }
    }
    return '';
  }
  normalizeEmailCandidate(value) {
    if (!value) return '';
    let candidate = String(value).toLowerCase().trim();

    // 移除所有空格和常见分隔符
    candidate = candidate
      .replace(/\s+/g, '')           // 移除所有空格
      .replace(/[：:;,，；]/g, '')   // 移除中英文标点
      .replace(/[\[\]\{\}\(\)]/g, '') // 移除括号
      .replace(/\\|\/|\'|\"/g, '');   // 移除斜杠和引号

    // 处理常见的 (at) (dot) 替代写法
    candidate = candidate
      .replace(/\(at\)|\[at\]|\{at\}|at/gi, '@')
      .replace(/\(dot\)|\[dot\]|\{dot\}|dot/gi, '.');

    // 处理缺少 @ 符号的情况（如qqcom -> @qq.com）
    const emailProviders = ['qq', '163', '126', 'gmail', 'outlook', 'hotmail', 'yahoo', 'sina', 'foxmail'];
    for (const provider of emailProviders) {
      const pattern = new RegExp(`([^@])(${provider})com`, 'gi');
      candidate = candidate.replace(pattern, `$1@${provider}.com`);
      // 也处理 .cn 结尾
      const patternCn = new RegExp(`([^@])(${provider})cn`, 'gi');
      candidate = candidate.replace(patternCn, `$1@${provider}.cn`);
    }

    // 清理多余的 @ 符号（只保留第一个）
    const atIndex = candidate.indexOf('@');
    if (atIndex !== -1) {
      candidate = candidate.substring(0, atIndex + 1) + candidate.substring(atIndex + 1).replace(/@/g, '');
    }

    // 清理多余的 . 符号（在域名部分）
    const lastDotIndex = candidate.lastIndexOf('.');
    if (lastDotIndex !== -1 && lastDotIndex > atIndex) {
      const domainPart = candidate.substring(atIndex + 1, lastDotIndex);
      const tldPart = candidate.substring(lastDotIndex);
      candidate = candidate.substring(0, atIndex + 1) + domainPart.replace(/\./g, '') + tldPart;
    }

    // 最终验证：提取标准格式的邮箱
    const standardMatch = candidate.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (standardMatch) {
      let email = standardMatch[0];
      // 确保邮箱格式正确（清理多余的点和下划线）
      const parts = email.split('@');
      if (parts.length === 2) {
        const local = parts[0].replace(/[._]{2,}/g, '.').replace(/^\.|\.$/g, '');
        const domain = parts[1].replace(/\.{2,}/g, '.').replace(/^\.|\.$/g, '');
        return `${local}@${domain}`;
      }
      return email;
    }
    return '';
  }
  extractEducation(text) {
    const education = [];
    if (!text) return education;
    const eduKeywords = ['大学', '学院', '学校', '研究生', '硕士', '博士', '本科', '大专', '高中', '中专'];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    let currentEdu = null;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length < 3) continue;
      const hasEduKeyword = eduKeywords.some(kw => trimmed.includes(kw));
      const hasTime = /\d{4}/.test(trimmed);
      if (hasEduKeyword || hasTime) {
        if (currentEdu && (currentEdu.school || currentEdu.degree || currentEdu.major)) {
          education.push(currentEdu);
        }
        currentEdu = {
          raw: trimmed,
          school: '',
          degree: '',
          major: '',
          duration: ''
        };
        const schoolMatch = trimmed.match(/([^\s,，]{2,20}(?:大学|学院|学校|研究生院))/);
        if (schoolMatch) currentEdu.school = schoolMatch[1];
        const degreeKeywords = ['博士', '硕士', '本科', '大专', '高中', '中专'];
        for (const degree of degreeKeywords) {
          if (trimmed.includes(degree)) {
            currentEdu.degree = degree;
            break;
          }
        }
        const majorMatch = trimmed.match(/专业[：:]?\s*([^\s,，;；]{2,20})/);
        if (majorMatch) currentEdu.major = majorMatch[1];
        const durationMatch = trimmed.match(/(20\d{2}\s*[-~—至]\s*(?:20\d{2}|今|现在|至今))/);
        if (durationMatch) currentEdu.duration = durationMatch[1];
      } else if (currentEdu) {
        if (!currentEdu.major) {
          const majorMatch = trimmed.match(/专业[：:]?\s*([^\s,，;；]{2,20})/);
          if (majorMatch) currentEdu.major = majorMatch[1];
        }
      }
    }
    if (currentEdu && (currentEdu.school || currentEdu.degree || currentEdu.major)) {
      education.push(currentEdu);
    }
    return education;
  }
  extractWorkExperience(sectionText, fullText) {
    const experience = [];
    if (!sectionText || sectionText.trim().length === 0) {
      return experience;
    }
    const workIndicators = [
      '公司', '有限公司', '股份公司', '集团', '企业', '实习', '任职', '就职',
      '工作单位', '雇主', '职位', '岗位', '部门'
    ];
    const projectIndicators = [
      '项目名称', '项目经历', '项目经验', '项目描述', '毕业设计', '课程设计',
      '个人项目', '团队项目', '项目角色', '项目职责'
    ];
    const blocks = this.splitByTimeRange(sectionText);
    for (const block of blocks) {
      if (block.trim().length < 10) continue;
      const hasWorkIndicator = workIndicators.some(kw => block.includes(kw));
      const hasProjectIndicator = projectIndicators.some(kw => block.includes(kw));
      if (hasProjectIndicator && !hasWorkIndicator) continue;
      const hasCompany = /(?:有限公司|股份|集团|公司|企业|事务所)/.test(block);
      const hasTimeRange = /20\d{2}\s*[-~—至]/.test(block);
      if (!hasCompany && !hasTimeRange) continue;
      const expItem = {
        company: '',
        position: '',
        duration: '',
        description: ''
      };
      const companyMatch = block.match(/([^\n,，]{2,30}(?:有限公司|股份|集团|公司|企业|事务所))/);
      if (companyMatch) expItem.company = companyMatch[1].trim();
      const positionPatterns = [
        /(?:职位|岗位)[：:]\s*([^\n,，]{2,20})/,
        /(?:任职|担任)[：:]\s*([^\n,，]{2,20})/,
        /(?:实习生|工程师|经理|主管|专员|助理|总监|顾问|分析师|设计师)/
      ];
      for (const pattern of positionPatterns) {
        const match = block.match(pattern);
        if (match) {
          expItem.position = typeof match === 'string' ? match : match[1];
          break;
        }
      }
      const durationMatch = block.match(/(20\d{2}[年\/.]?\d{0,2}[月]?\s*[-~—至]\s*(?:20\d{2}[年\/.]?\d{0,2}[月]?|今|现在|至今))/);
      if (durationMatch) expItem.duration = durationMatch[1];
      const descLines = block.split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 5 &&
            !trimmed.includes('有限公司') &&
            !trimmed.includes('项目名称') &&
            !trimmed.includes('项目经历') &&
            (trimmed.includes('负责') || trimmed.includes('参与') || trimmed.includes('完成') ||
             trimmed.includes('开发') || trimmed.includes('实现') || trimmed.includes('管理') ||
             trimmed.includes('组织') || trimmed.includes('协调') || trimmed.includes('推进'));
        })
        .map(l => l.trim())
        .slice(0, 3);
      expItem.description = descLines.join('；');
      if (expItem.company || expItem.position) {
        experience.push(expItem);
      }
    }
    return experience;
  }
  extractProjects(sectionText, fullText) {
    const projects = [];
    if (!sectionText || sectionText.trim().length === 0) {
      return projects;
    }
    const projectIndicators = [
      '项目名称', '项目经历', '项目经验', '项目描述', '毕业设计', '课程设计',
      '个人项目', '团队项目'
    ];
    const workIndicators = [
      '有限公司', '股份公司', '集团', '企业', '任职', '就职', '工作单位'
    ];
    const blocks = this.splitByProject(sectionText);
    for (const block of blocks) {
      if (block.trim().length < 10) continue;
      const hasProjectIndicator = projectIndicators.some(kw => block.includes(kw));
      const hasWorkIndicator = workIndicators.some(kw => block.includes(kw));
      if (hasWorkIndicator && !hasProjectIndicator) continue;
      const projItem = {
        name: '',
        role: '',
        description: '',
        technologies: ''
      };
      const namePatterns = [
        /项目名称[：:]\s*([^\n]{2,30})/,
        /项目[：:]\s*([^\n]{2,30})/,
        /^([^\n,，]{2,30}(?:系统|平台|网站|应用|小程序|APP|项目))/
      ];
      for (const pattern of namePatterns) {
        const match = block.match(pattern);
        if (match) {
          projItem.name = match[1].trim();
          break;
        }
      }
      const roleMatch = block.match(/(?:职责|角色|负责)[：:]\s*([^\n]{2,30})/);
      if (roleMatch) projItem.role = roleMatch[1].trim();
      const techMatch = block.match(/(?:技术|技术栈|使用技术)[：:]\s*([^\n]{2,50})/);
      if (techMatch) projItem.technologies = techMatch[1].trim();
      const descLines = block.split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 5 &&
            !this.skillExcludeKeywords.some(kw => trimmed.includes(kw)) &&
            !trimmed.includes('项目名称') &&
            (trimmed.includes('开发') || trimmed.includes('实现') || trimmed.includes('完成') ||
             trimmed.includes('负责') || trimmed.includes('参与') || trimmed.includes('使用') ||
             trimmed.includes('设计') || trimmed.includes('构建') || trimmed.includes('优化'));
        })
        .map(l => l.trim())
        .slice(0, 3);
      projItem.description = descLines.join('；');
      if (projItem.name || projItem.description) {
        projects.push(projItem);
      }
    }
    return projects;
  }
  splitByTimeRange(text) {
    const timePattern = /(?=20\d{2}\s*[-~—至])/;
    return text.split(timePattern).filter(block => block.trim().length > 0);
  }
  splitByProject(text) {
    const projectPattern = /(?=(?:项目名称|项目经历|项目经验|毕业设计|课程设计)[：:]?\s*[^\n])/;
    return text.split(projectPattern).filter(block => block.trim().length > 0);
  }
  extractSkills(text) {
    const skills = [];
    if (!text) return skills;
    const cleanText = this.cleanSkillSection(text);
    const excludeSkillPatterns = [
      /实习生|管培生|工程师|经理|主管|专员|助理|总监|顾问|分析师|设计师/,
      /求职|应聘|意向|期望|目标/,
      /^沟通$|^演讲$|^领导力$|^团队协作$|^责任心$|^执行力$|^学习能力$|^适应能力$/,
      /^熟悉$|^熟练$|^精通$|^了解$|^掌握$/
    ];
    const shouldExclude = (skillName) => {
      const lowerName = skillName.toLowerCase();
      for (const pattern of excludeSkillPatterns) {
        if (pattern.test(skillName)) return true;
      }
      if (skillName.length < 2 || skillName.length > 20) return true;
      if (/^\d+$/.test(skillName)) return true;
      return false;
    };
    const skillPatterns = [
      /(?:编程语言|开发语言|语言)[：:]\s*([^\n]{2,80})/i,
      /(?:框架|技术框架|开发框架)[：:]\s*([^\n]{2,80})/i,
      /(?:工具|开发工具|软件)[：:]\s*([^\n]{2,80})/i,
      /(?:数据库)[：:]\s*([^\n]{2,80})/i,
      /(?:技能|专业技能|技术技能)[：:]\s*([^\n]{2,100})/i
    ];
    for (const pattern of skillPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const items = match[1].split(/[,，;；|、\/]/)
          .map(s => s.trim())
          .filter(s => s.length > 0 && s.length < 30)
          .filter(s => !this.skillExcludeKeywords.some(kw => s.includes(kw)))
          .filter(s => !shouldExclude(s));
        for (const item of items) {
          if (!skills.find(s => s.name.toLowerCase() === item.toLowerCase())) {
            skills.push({ name: item, category: this.categorizeSkill(item) });
          }
        }
      }
    }
    const knownSkills = [
      'Python', 'Java', 'C++', 'C#', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin',
      'SQL', 'MySQL', 'MongoDB', 'Redis', 'PostgreSQL', 'Oracle', 'SQLite',
      'React', 'Vue', 'Angular', 'Node.js', 'Spring', 'Django', 'Flask', 'Express', 'jQuery',
      'TensorFlow', 'PyTorch', 'Keras', 'Scikit-learn', 'Pandas', 'NumPy',
      'Excel', 'PowerPoint', 'Word', 'PPT', 'Photoshop', 'Figma', 'Sketch', 'XD',
      'Linux', 'Git', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Jenkins',
      'HTML', 'CSS', 'Sass', 'Less', 'Bootstrap', 'Tailwind',
      '数据分析', '机器学习', '深度学习', '人工智能', 'NLP', 'CV', '大数据',
      '项目管理', '产品设计', 'UI设计'
    ];
    for (const skill of knownSkills) {
      if (cleanText.toLowerCase().includes(skill.toLowerCase())) {
        if (!skills.find(s => s.name.toLowerCase() === skill.toLowerCase())) {
          if (!shouldExclude(skill)) {
            skills.push({ name: skill, category: this.categorizeSkill(skill) });
          }
        }
      }
    }
    return skills.slice(0, 15);
  }
  cleanSkillSection(text) {
    const excludePatterns = [
      /姓名[：:][^\n]*/gi,
      /电话[：:][^\n]*/gi,
      /手机[：:][^\n]*/gi,
      /邮箱[：:][^\n]*/gi,
      /教育背景[^\n]*/gi,
      /工作经历[^\n]*/gi,
      /项目经历[^\n]*/gi,
      /自我评价[^\n]*/gi
    ];
    let cleaned = text;
    for (const pattern of excludePatterns) {
      cleaned = cleaned.replace(pattern, '');
    }
    return cleaned;
  }
  categorizeSkill(skill) {
    const languages = ['Python', 'Java', 'C++', 'C#', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'HTML', 'CSS'];
    const databases = ['SQL', 'MySQL', 'MongoDB', 'Redis', 'PostgreSQL', 'Oracle', 'SQLite'];
    const frameworks = ['React', 'Vue', 'Angular', 'Node.js', 'Spring', 'Django', 'Flask', 'Express', 'jQuery', 'Bootstrap', 'Tailwind', 'TensorFlow', 'PyTorch'];
    const tools = ['Excel', 'PowerPoint', 'Word', 'PPT', 'Photoshop', 'Figma', 'Sketch', 'Linux', 'Git', 'Docker', 'Kubernetes'];
    const lowerSkill = skill.toLowerCase();
    if (languages.some(l => lowerSkill.includes(l.toLowerCase()))) return '编程语言';
    if (databases.some(d => lowerSkill.includes(d.toLowerCase()))) return '数据库';
    if (frameworks.some(f => lowerSkill.includes(f.toLowerCase()))) return '框架/库';
    if (tools.some(t => lowerSkill.includes(t.toLowerCase()))) return '工具';
    return '其他';
  }
  extractSelfEvaluation(text) {
    if (!text) return '';
    const excludeKeywords = ['姓名', '电话', '手机', '邮箱', '教育', '工作', '项目'];
    const lines = text.split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 10 &&
          !excludeKeywords.some(kw => trimmed.includes(kw));
      })
      .map(l => l.trim())
      .slice(0, 5);
    return lines.join('；');
  }
  extractAchievements(text) {
    const achievements = [];
    if (!text) return achievements;
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('奖') || trimmed.includes('冠军') || trimmed.includes('一等奖') ||
        trimmed.includes('二等奖') || trimmed.includes('三等奖') || trimmed.includes('优秀') ||
        trimmed.includes('证书') || trimmed.includes('认证') || trimmed.includes('资格')) {
        achievements.push(trimmed);
      }
    }
    return achievements;
  }
}
module.exports = new ExtractorService();
