/**
 * 岗位配置模块
 * 支持多岗位配置，便于扩展和维护
 */

// 岗位名称关键词映射表，用于正则匹配失败时的补充匹配
const POSITION_KEYWORDS_MAP = {
  // 技术开发类
  'java开发': 'Java开发工程师',
  'java': 'Java开发工程师',
  '后端开发': '后端开发工程师',
  '后端': '后端开发工程师',
  '前端开发': '前端开发工程师',
  '前端': '前端开发工程师',
  'python开发': 'Python开发工程师',
  'python': 'Python开发工程师',
  '全栈开发': '全栈开发工程师',
  '全栈': '全栈开发工程师',
  '移动开发': '移动开发工程师',
  'android': '移动开发工程师',
  'ios': '移动开发工程师',
  '软件工程师': '软件工程师',
  '软件开发': '软件工程师',
  '程序员': '软件工程师',
  '开发工程师': '软件工程师',
  '开发实习生': '软件工程师',
  '技术': '软件工程师',

  // 数据类
  '数据分析': '数据分析工程师',
  '数据分析师': '数据分析工程师',
  '数据挖掘': '数据工程师',
  '数据工程师': '数据工程师',
  '算法': '算法工程师',
  '机器学习': '算法工程师',
  'ai': '算法工程师',

  // 产品运营类
  '产品经理': '产品经理',
  '产品': '产品经理',
  '运营': '运营管培生',
  '用户运营': '运营管培生',
  '内容运营': '运营管培生',

  // 市场营销类
  '市场营销': '市场营销专员',
  '市场': '市场营销专员',
  '营销': '市场营销专员',
  '市场推广': '市场营销专员',
  '品牌': '市场营销专员',
  '新媒体': '市场营销专员',

  // 商务销售类
  '商务': '商务管培生',
  '销售': '商务管培生',
  '管培生': '商务管培生',
  '客户': '商务管培生',
  'bd': '商务管培生',

  // 设计类
  '设计': '设计类管培生',
  'ui': '设计类管培生',
  'ux': '设计类管培生',
  '视觉': '设计类管培生',

  // 人力资源类
  '人力': '人力管培生',
  'hr': '人力管培生',
  '招聘': '人力管培生',
  '人事': '人力管培生',

  // 供应链类
  '供应链': '供应链管培生',
  '物流': '供应链管培生',
  '采购': '供应链管培生'
};

/**
 * 根据岗位名称智能匹配岗位配置
 * 1. 优先精确匹配
 * 2. 正则表达式匹配（适合规范命名的岗位）
 * 3. 关键词映射表匹配（适合不规范命名的岗位）
 * 4. 默认返回软件工程师
 * @param {string} position - 岗位名称（如 "Java开发实习生"、"前端工程师"、"商务管培生"）
 * @returns {string} 匹配的配置名称
 */
function matchPositionConfig(position) {
  if (!position || typeof position !== 'string') {
    return '软件工程师';
  }

  // 1. 精确匹配
  if (positionConfig[position]) {
    return position;
  }

  // 2. 正则表达式匹配 - 适合规范命名的岗位
  const normalizedPosition = position.toLowerCase();

  // 技术开发类关键词（优先级最高）
  if (/java|后端|服务端|backend/.test(normalizedPosition)) {
    return 'Java开发工程师';
  }
  if (/前端|vue|react|javascript|frontend/.test(normalizedPosition)) {
    return '前端开发工程师';
  }
  if (/python|django|flask/.test(normalizedPosition)) {
    return 'Python开发工程师';
  }
  if (/全栈|full\s*stack/.test(normalizedPosition)) {
    return '全栈开发工程师';
  }
  if (/android|ios|移动端|app开发|mobile/.test(normalizedPosition)) {
    return '移动开发工程师';
  }
  if (/开发|工程师|程序员|软件|技术/.test(normalizedPosition)) {
    return '软件工程师';
  }

  // 数据类关键词
  if (/数据分析|data\s*analyst/.test(normalizedPosition)) {
    return '数据分析工程师';
  }
  if (/数据工程|etl|大数据|data\s*engineer/.test(normalizedPosition)) {
    return '数据工程师';
  }
  if (/算法|机器学习|深度学习|ai|ml/.test(normalizedPosition)) {
    return '算法工程师';
  }
  if (/数据|统计/.test(normalizedPosition)) {
    return '数据分析工程师';
  }

  // 产品运营类关键词
  if (/产品经理|pm|产品/.test(normalizedPosition)) {
    return '产品经理';
  }
  if (/运营/.test(normalizedPosition)) {
    return '运营管培生';
  }

  // 市场营销类关键词（在商务销售类之前，避免被"管培生"误匹配）
  if (/市场营销|市场推广|品牌推广|品牌/.test(normalizedPosition)) {
    return '市场营销专员';
  }
  // 单独的"市场"关键词（如"市场专员"、"市场助理"），但要排除"市场开拓"等商务类表述
  if (/市场/.test(normalizedPosition) && !/开拓|调研/.test(normalizedPosition)) {
    return '市场营销专员';
  }
  if (/营销|新媒体|推广/.test(normalizedPosition)) {
    return '市场营销专员';
  }

  // 商务销售类关键词
  if (/商务|销售|bd|客户/.test(normalizedPosition)) {
    return '商务管培生';
  }

  // 设计类关键词
  if (/设计|ui|ux|视觉|交互/.test(normalizedPosition)) {
    return '设计类管培生';
  }

  // 人力资源类关键词
  if (/人力|hr|招聘|人事/.test(normalizedPosition)) {
    return '人力管培生';
  }

  // 供应链类关键词
  if (/供应链|物流|采购/.test(normalizedPosition)) {
    return '供应链管培生';
  }

  // 3. 关键词映射表匹配 - 适合不规范命名的岗位
  for (const [keyword, configName] of Object.entries(POSITION_KEYWORDS_MAP)) {
    if (normalizedPosition.includes(keyword.toLowerCase())) {
      // 确保配置存在
      if (positionConfig[configName]) {
        return configName;
      }
    }
  }

  // 4. 默认返回软件工程师（更通用）
  return '软件工程师';
}

const positionConfig = {
  '商务管培生': {
    coreSkills: ['沟通', '谈判', '销售', '市场', '商务', '客户', '管理', '领导', '团队', '项目'],
    businessSkills: ['商务谈判', '客户管理', '市场开拓', '商业计划', '营销策略', '品牌推广'],
    education: ['工商管理', '市场营销', '国际贸易', '经济学', '金融', '商务'],
    experience: ['销售', '市场', '商务', '实习', '项目', '客户'],
    abilityKeywords: ['领导力', '沟通能力', '团队协作', '问题解决', '创新思维', '执行力', '学习能力', '抗压能力'],
    projectKeywords: ['项目', '实习', '实践', '案例', '竞赛', '活动', '创业', '研究', '论文', '作品'],
    skillAliases: {
      '沟通': ['交流', '表达', '协调', '对接'],
      '谈判': ['商务洽谈', '议价', '磋商'],
      '销售': ['推销', '营销', '业务拓展', 'BD'],
      '市场': ['市场营销', '市场推广', '市场分析'],
      '客户': ['客户服务', '客户关系', '客户维护', 'CRM']
    },
    conflictingMajors: [],
    weights: {
      skillMatch: 0.35,
      educationMatch: 0.20,
      experienceMatch: 0.20,
      abilityMatch: 0.15,
      projectMatch: 0.10
    }
  },
  '市场营销专员': {
    coreSkills: ['市场营销', '市场推广', '品牌', '文案', '策划', '新媒体', '活动策划', '营销策划', '社交媒体', '内容创作'],
    businessSkills: ['品牌推广', '新媒体运营', '活动策划', '市场调研', '竞品分析', '内容营销', '社群运营', '广告投放', 'SEO', 'SEM'],
    education: ['市场营销', '广告学', '新闻传播', '工商管理', '中文', '传媒', '电子商务'],
    experience: ['市场', '营销', '推广', '新媒体', '运营', '实习', '活动', '品牌'],
    abilityKeywords: ['创意能力', '沟通能力', '文案能力', '市场敏锐度', '数据分析', '执行力', '学习能力', '团队协作'],
    projectKeywords: ['项目', '实习', '活动', '推广', '营销', '品牌', '新媒体', '策划', '案例', '运营'],
    skillAliases: {
      '市场营销': ['市场推广', '营销', 'marketing'],
      '新媒体': ['新媒体运营', '微信公众号', '抖音', '小红书', '微博'],
      '文案': ['文案策划', '内容创作', '内容运营'],
      '策划': ['活动策划', '营销策划', '策划执行'],
      '品牌': ['品牌推广', '品牌运营', '品牌管理']
    },
    conflictingMajors: ['计算机', '软件工程', '数学', '物理', '化学', '生物', '机械', '土木'],
    weights: {
      skillMatch: 0.40,
      educationMatch: 0.20,
      experienceMatch: 0.20,
      abilityMatch: 0.10,
      projectMatch: 0.10
    }
  },
  '数据类管培生': {
    coreSkills: ['数据分析', 'Python', 'SQL', 'Excel', '统计', '机器学习', '算法', '编程', '数据库', '可视化'],
    businessSkills: ['商业分析', '市场分析', '用户分析', '数据挖掘', '预测模型', '数据可视化'],
    education: ['数学', '统计', '计算机', '数据科学', '信息管理', '人工智能'],
    experience: ['实习', '项目', '竞赛', '研究', '数据', '算法'],
    abilityKeywords: ['逻辑思维', '数据分析', '编程能力', '数学基础', '学习能力', '问题解决', '创新思维', '团队协作'],
    projectKeywords: ['项目', '实习', '竞赛', '研究', '论文', '作品', '算法', '模型', '系统', '应用'],
    skillAliases: {
      'Python': ['python', 'py', 'Python编程'],
      'SQL': ['sql', 'MySQL', '数据库查询', 'SQL Server'],
      '数据分析': ['数据处理', '数据统计', '数据分析能力'],
      '机器学习': ['ML', '深度学习', 'AI', '人工智能'],
      'Excel': ['excel', '电子表格', '数据透视表']
    },
    conflictingMajors: ['建筑', '土木', '机械', '化学', '生物', '医学', '艺术', '体育', '文学', '历史'],
    weights: {
      skillMatch: 0.40,
      educationMatch: 0.20,
      experienceMatch: 0.15,
      abilityMatch: 0.15,
      projectMatch: 0.10
    }
  },
  '运营管培生': {
    coreSkills: ['运营', '用户', '产品', '活动', '推广', '内容', '社群', '增长', '转化', '优化'],
    businessSkills: ['运营策略', '用户增长', '产品运营', '社群运营', '品牌运营', '内容策划'],
    education: ['市场营销', '工商管理', '新闻传播', '心理学', '社会学', '运营'],
    experience: ['运营', '实习', '项目', '社团', '活动', '用户'],
    abilityKeywords: ['创意能力', '沟通能力', '数据分析', '用户思维', '执行能力', '学习能力', '抗压能力', '团队协作'],
    projectKeywords: ['项目', '实习', '活动', '推广', '内容', '运营', '社群', '品牌', '营销', '案例'],
    skillAliases: {
      '运营': ['运营管理', '运营策划', '运营推广'],
      '用户': ['用户运营', '用户增长', '用户分析'],
      '产品': ['产品运营', '产品推广', '产品管理'],
      '活动': ['活动策划', '活动运营', '活动执行'],
      '内容': ['内容运营', '内容策划', '内容创作']
    },
    conflictingMajors: ['建筑', '土木', '机械', '化学', '生物', '医学', '体育'],
    weights: {
      skillMatch: 0.35,
      educationMatch: 0.20,
      experienceMatch: 0.20,
      abilityMatch: 0.15,
      projectMatch: 0.10
    }
  },
  '供应链管培生': {
    coreSkills: ['供应链', '物流', '采购', '库存', '计划', '生产', '质量', '成本', '优化', '管理'],
    businessSkills: ['供应链管理', '采购管理', '物流管理', '成本控制', '供应商管理', '库存优化'],
    education: ['物流管理', '供应链', '工商管理', '工业工程', '采购', '物流'],
    experience: ['物流', '采购', '供应链', '实习', '项目', '库存'],
    abilityKeywords: ['逻辑思维', '分析能力', '协调能力', '执行能力', '学习能力', '问题解决', '抗压能力', '团队协作'],
    projectKeywords: ['项目', '实习', '实践', '优化', '管理', '系统', '流程', '案例', '研究', '论文'],
    skillAliases: {
      '供应链': ['供应链管理', 'SCM', '供应链优化'],
      '物流': ['物流管理', '物流配送', '仓储物流'],
      '采购': ['采购管理', '供应商管理', '采购流程'],
      '库存': ['库存管理', '库存优化', '库存控制']
    },
    conflictingMajors: ['艺术', '文学', '历史', '哲学', '体育'],
    weights: {
      skillMatch: 0.35,
      educationMatch: 0.20,
      experienceMatch: 0.20,
      abilityMatch: 0.15,
      projectMatch: 0.10
    }
  },
  '设计类管培生': {
    coreSkills: ['PS', 'AI', 'Sketch', 'Figma', '设计', 'UI', 'UX', '平面设计', 'Adobe'],
    businessSkills: ['品牌设计', '视觉设计', '交互设计', '用户体验', '创意', '视觉传达'],
    education: ['设计', '艺术', '视觉传达', '工业设计', '数字媒体', '美术'],
    experience: ['设计', '作品集', '项目', '实习', '比赛', '创意'],
    abilityKeywords: ['创意能力', '审美能力', '设计思维', '用户思维', '沟通能力', '学习能力', '团队协作'],
    projectKeywords: ['项目', '作品', '设计', '作品集', '比赛', '创意', '案例', '品牌', '视觉'],
    skillAliases: {
      'PS': ['Photoshop', 'ps', 'PS软件'],
      'AI': ['Illustrator', 'ai', 'Adobe Illustrator'],
      'UI': ['UI设计', '用户界面', '界面设计'],
      'UX': ['UX设计', '用户体验设计', '交互设计']
    },
    conflictingMajors: ['土木', '机械', '化学', '生物', '医学', '体育', '会计', '金融'],
    weights: {
      skillMatch: 0.40,
      educationMatch: 0.20,
      experienceMatch: 0.15,
      abilityMatch: 0.15,
      projectMatch: 0.10
    }
  },
  '人力管培生': {
    coreSkills: ['Excel', 'HR', '招聘', '培训', '绩效', '薪酬', '人力资源'],
    businessSkills: ['人力资源', '人才管理', '组织发展', '员工关系', '企业文化', '招聘'],
    education: ['人力资源', '心理学', '管理学', '社会学', '工商管理', '人力'],
    experience: ['HR', '招聘', '培训', '实习', '项目', '人事'],
    abilityKeywords: ['沟通能力', '协调能力', '组织能力', '人际交往', '学习能力', '问题解决', '团队协作'],
    projectKeywords: ['项目', '实习', '招聘', '培训', '活动', '人事', '组织', '员工', '人才', '文化'],
    skillAliases: {
      'HR': ['人力资源', '人事', 'HRBP', 'HR管理'],
      '招聘': ['人才招聘', '招聘管理', '招聘流程'],
      '培训': ['员工培训', '培训管理', '人才发展'],
      '绩效': ['绩效管理', '绩效考核', 'KPI']
    },
    conflictingMajors: [],
    weights: {
      skillMatch: 0.35,
      educationMatch: 0.20,
      experienceMatch: 0.20,
      abilityMatch: 0.15,
      projectMatch: 0.10
    }
  },
  // ===== 技术开发类岗位 =====
  'Java开发工程师': {
    coreSkills: ['Java', 'Spring', 'MySQL', 'Redis', '微服务', 'MyBatis', 'Git', 'Linux', '多线程', 'JVM'],
    businessSkills: ['分布式', '消息队列', '数据库优化', '系统设计', '接口开发', '后端架构'],
    education: ['计算机', '软件工程', '信息管理', '数学', '电子信息', '通信'],
    experience: ['Java', 'Spring', '后端', '微服务', '实习', '项目'],
    abilityKeywords: ['编程能力', '逻辑思维', '问题解决', '学习能力', '团队协作', '代码规范', '系统设计'],
    projectKeywords: ['项目', '实习', '系统', '平台', '服务', '接口', '框架', '模块', '组件', '架构'],
    skillAliases: {
      'Java': ['java', 'Java开发', 'Java编程', 'JDK'],
      'Spring': ['SpringBoot', 'Spring Cloud', 'SSM', 'Spring MVC'],
      'MySQL': ['mysql', '数据库', '关系型数据库'],
      'Redis': ['redis', '缓存', '分布式缓存'],
      '微服务': ['微服务架构', '分布式服务', 'Spring Cloud']
    },
    conflictingMajors: [],
    weights: {
      skillMatch: 0.45,
      educationMatch: 0.15,
      experienceMatch: 0.20,
      abilityMatch: 0.10,
      projectMatch: 0.10
    }
  },
  '后端开发工程师': {
    coreSkills: ['后端', '数据库', 'API', '服务器', '接口', 'Git', 'Linux', '编程', '算法', '数据结构'],
    businessSkills: ['系统设计', '性能优化', '分布式', '高并发', '消息队列', '缓存'],
    education: ['计算机', '软件工程', '信息管理', '数学', '电子信息', '通信'],
    experience: ['后端', '服务端', 'API', '实习', '项目', '系统'],
    abilityKeywords: ['编程能力', '逻辑思维', '问题解决', '学习能力', '团队协作', '系统设计'],
    projectKeywords: ['项目', '实习', '系统', '平台', '服务', '接口', '后端', '服务端'],
    skillAliases: {
      '后端': ['服务端', '后台开发', '后端开发'],
      'API': ['接口', 'RESTful', 'API开发'],
      '数据库': ['MySQL', 'PostgreSQL', '数据库设计']
    },
    conflictingMajors: [],
    weights: {
      skillMatch: 0.45,
      educationMatch: 0.15,
      experienceMatch: 0.20,
      abilityMatch: 0.10,
      projectMatch: 0.10
    }
  },
  '前端开发工程师': {
    coreSkills: ['JavaScript', 'Vue', 'React', 'HTML', 'CSS', 'TypeScript', 'Webpack', 'Node.js', '前端', '小程序'],
    businessSkills: ['前端架构', '性能优化', '跨平台', '组件化', '响应式设计', '用户体验'],
    education: ['计算机', '软件工程', '数字媒体', '信息管理', '设计', '数学'],
    experience: ['前端', 'Vue', 'React', '小程序', '实习', '项目'],
    abilityKeywords: ['编程能力', '设计思维', '问题解决', '学习能力', '团队协作', '用户体验'],
    projectKeywords: ['项目', '实习', '网页', '小程序', 'H5', '组件', '页面', '应用', '前端'],
    skillAliases: {
      'JavaScript': ['JS', 'ES6', 'ES2015', 'ECMAScript'],
      'Vue': ['Vue.js', 'Vue2', 'Vue3', 'Vuex'],
      'React': ['React.js', 'React Hooks', 'Redux'],
      'TypeScript': ['TS', 'TypeScript']
    },
    conflictingMajors: [],
    weights: {
      skillMatch: 0.45,
      educationMatch: 0.15,
      experienceMatch: 0.20,
      abilityMatch: 0.10,
      projectMatch: 0.10
    }
  },
  'Python开发工程师': {
    coreSkills: ['Python', 'Django', 'Flask', 'MySQL', 'Redis', '爬虫', '数据分析', 'Git', 'Linux', 'FastAPI'],
    businessSkills: ['后端开发', '数据处理', '自动化', '机器学习', 'API开发', '脚本开发'],
    education: ['计算机', '软件工程', '数学', '统计学', '信息管理', '电子信息'],
    experience: ['Python', 'Django', 'Flask', '实习', '项目', '爬虫'],
    abilityKeywords: ['编程能力', '逻辑思维', '数据分析', '学习能力', '问题解决', '自动化思维'],
    projectKeywords: ['项目', '实习', '脚本', '爬虫', '系统', '平台', '工具', '自动化', 'API'],
    skillAliases: {
      'Python': ['python', 'Python开发', 'Py'],
      'Django': ['Django框架', 'Django REST'],
      'Flask': ['Flask框架', 'Flask开发']
    },
    conflictingMajors: [],
    weights: {
      skillMatch: 0.45,
      educationMatch: 0.15,
      experienceMatch: 0.20,
      abilityMatch: 0.10,
      projectMatch: 0.10
    }
  },
  '全栈开发工程师': {
    coreSkills: ['JavaScript', 'Java', 'Python', 'Vue', 'React', 'MySQL', 'Redis', 'Git', 'Node.js', 'Spring'],
    businessSkills: ['前后端开发', '系统设计', '数据库设计', 'API设计', '项目部署', '架构设计'],
    education: ['计算机', '软件工程', '信息管理', '数学', '电子信息'],
    experience: ['全栈', '前端', '后端', '实习', '项目', '系统'],
    abilityKeywords: ['编程能力', '系统思维', '问题解决', '学习能力', '团队协作', '架构设计'],
    projectKeywords: ['项目', '实习', '系统', '平台', '全栈', '前端', '后端', '应用', '服务'],
    skillAliases: {
      '全栈': ['Full Stack', '全栈开发', '前后端'],
      'JavaScript': ['JS', 'ES6', '前端开发']
    },
    conflictingMajors: [],
    weights: {
      skillMatch: 0.45,
      educationMatch: 0.15,
      experienceMatch: 0.20,
      abilityMatch: 0.10,
      projectMatch: 0.10
    }
  },
  '软件工程师': {
    coreSkills: ['编程', '数据结构', '算法', '数据库', 'Git', 'Linux', '设计模式', '软件工程', '测试', '调试'],
    businessSkills: ['软件开发', '系统设计', '代码优化', '问题排查', '技术文档', '代码评审'],
    education: ['计算机', '软件工程', '信息管理', '数学', '电子信息', '通信'],
    experience: ['开发', '编程', '实习', '项目', '系统', '软件'],
    abilityKeywords: ['编程能力', '逻辑思维', '问题解决', '学习能力', '团队协作', '代码规范'],
    projectKeywords: ['项目', '实习', '系统', '软件', '应用', '模块', '功能', '开发', '实现'],
    skillAliases: {
      '编程': ['程序设计', '代码编写', '开发'],
      '数据结构': ['算法与数据结构', '数据结构与算法'],
      '软件工程': ['软件开发', '软件设计']
    },
    conflictingMajors: [],
    weights: {
      skillMatch: 0.45,
      educationMatch: 0.15,
      experienceMatch: 0.20,
      abilityMatch: 0.10,
      projectMatch: 0.10
    }
  },
  '移动开发工程师': {
    coreSkills: ['Android', 'iOS', 'Kotlin', 'Swift', 'Java', 'Flutter', 'React Native', '移动端', 'App', '移动开发'],
    businessSkills: ['移动端架构', '性能优化', '跨平台开发', 'UI开发', '网络编程', '移动安全'],
    education: ['计算机', '软件工程', '电子信息', '通信', '信息管理'],
    experience: ['Android', 'iOS', 'App', '移动端', '实习', '项目'],
    abilityKeywords: ['编程能力', '移动开发', '问题解决', '学习能力', '团队协作', '用户体验'],
    projectKeywords: ['项目', '实习', 'App', '应用', '移动端', '小程序', 'SDK', '组件', '页面'],
    skillAliases: {
      'Android': ['安卓', 'Android开发', 'Android Studio'],
      'iOS': ['苹果开发', 'iOS开发', 'Xcode'],
      'Flutter': ['Flutter开发', 'Dart', '跨平台'],
      'React Native': ['RN', 'ReactNative', '跨平台开发']
    },
    conflictingMajors: [],
    weights: {
      skillMatch: 0.45,
      educationMatch: 0.15,
      experienceMatch: 0.20,
      abilityMatch: 0.10,
      projectMatch: 0.10
    }
  },
  // ===== 数据类岗位 =====
  '数据分析工程师': {
    coreSkills: ['Excel', 'SQL', 'Python', '数据分析', '可视化', '统计学', 'Tableau', 'Power BI', '数据清洗', '报表'],
    businessSkills: ['业务分析', '数据挖掘', '报表设计', '数据建模', '用户分析', '市场分析'],
    education: ['统计学', '数学', '计算机', '数据科学', '信息管理', '经济学'],
    experience: ['数据分析', '实习', '项目', '报表', 'SQL', 'Python'],
    abilityKeywords: ['数据思维', '逻辑分析', '业务理解', '学习能力', '沟通表达', '问题解决'],
    projectKeywords: ['项目', '实习', '分析', '报表', '模型', '可视化', '数据', '案例', '报告'],
    skillAliases: {
      'Excel': ['excel', '电子表格', '数据透视表'],
      'SQL': ['sql', 'MySQL', '数据库查询'],
      'Python': ['python', 'Pandas', 'NumPy'],
      '可视化': ['数据可视化', '图表', 'Dashboard']
    },
    conflictingMajors: [],
    weights: {
      skillMatch: 0.40,
      educationMatch: 0.20,
      experienceMatch: 0.20,
      abilityMatch: 0.10,
      projectMatch: 0.10
    }
  },
  '数据工程师': {
    coreSkills: ['Python', 'SQL', 'Spark', 'Hadoop', 'ETL', '数据仓库', 'Kafka', '数据管道', '大数据', 'Airflow'],
    businessSkills: ['数据架构', '数据处理', '数据治理', '数据建模', '性能优化', '数据质量'],
    education: ['计算机', '软件工程', '数学', '统计学', '数据科学', '信息管理'],
    experience: ['数据', '大数据', 'ETL', '实习', '项目', 'Spark'],
    abilityKeywords: ['编程能力', '数据思维', '系统设计', '学习能力', '问题解决', '团队协作'],
    projectKeywords: ['项目', '实习', '数据', '管道', '平台', '仓库', 'ETL', '系统', '架构'],
    skillAliases: {
      'ETL': ['数据抽取', '数据处理', '数据集成'],
      'Spark': ['Apache Spark', 'PySpark', 'Spark SQL'],
      'Hadoop': ['HDFS', 'MapReduce', 'Hadoop生态']
    },
    conflictingMajors: [],
    weights: {
      skillMatch: 0.45,
      educationMatch: 0.15,
      experienceMatch: 0.20,
      abilityMatch: 0.10,
      projectMatch: 0.10
    }
  },
  '算法工程师': {
    coreSkills: ['Python', '机器学习', '深度学习', '算法', 'TensorFlow', 'PyTorch', 'NLP', 'CV', '数学建模', '统计学'],
    businessSkills: ['模型优化', '特征工程', '模型部署', '算法设计', '数据分析', '模型评估'],
    education: ['计算机', '数学', '统计学', '人工智能', '机器学习', '电子信息'],
    experience: ['算法', '机器学习', '深度学习', '实习', '项目', '研究'],
    abilityKeywords: ['数学基础', '算法思维', '编程能力', '学习能力', '问题解决', '研究能力'],
    projectKeywords: ['项目', '实习', '模型', '算法', '系统', '研究', '论文', '竞赛', '应用'],
    skillAliases: {
      '机器学习': ['ML', 'Machine Learning', 'AI'],
      '深度学习': ['Deep Learning', '神经网络', 'DL'],
      'NLP': ['自然语言处理', '文本分析', 'NLP算法'],
      'CV': ['计算机视觉', '图像识别', 'CV算法']
    },
    conflictingMajors: [],
    weights: {
      skillMatch: 0.45,
      educationMatch: 0.20,
      experienceMatch: 0.15,
      abilityMatch: 0.10,
      projectMatch: 0.10
    }
  },
  // ===== 产品类岗位 =====
  '产品经理': {
    coreSkills: ['产品', '需求分析', '原型设计', 'Axure', '用户调研', '数据分析', '竞品分析', 'PRD', '产品规划', '项目管理'],
    businessSkills: ['产品设计', '用户体验', '商业模式', '市场分析', '迭代优化', '产品运营'],
    education: ['计算机', '信息管理', '工商管理', '心理学', '设计', '市场营销'],
    experience: ['产品', '实习', '项目', '需求', '用户', '原型'],
    abilityKeywords: ['产品思维', '逻辑思维', '沟通能力', '用户思维', '数据分析', '学习能力'],
    projectKeywords: ['项目', '实习', '产品', '功能', '需求', '原型', '迭代', '用户', '场景', '案例'],
    skillAliases: {
      '产品': ['产品设计', '产品管理', 'PM'],
      '原型设计': ['Axure', '原型', '交互设计'],
      'PRD': ['产品需求文档', '需求文档', '产品文档']
    },
    conflictingMajors: [],
    weights: {
      skillMatch: 0.35,
      educationMatch: 0.15,
      experienceMatch: 0.25,
      abilityMatch: 0.15,
      projectMatch: 0.10
    }
  }
};

function getPositionConfig(position) {
  return positionConfig[position] || positionConfig['商务管培生'];
}

function getAllPositions() {
  return Object.keys(positionConfig);
}
function addPosition(name, config) {
  if (!positionConfig[name]) {
    positionConfig[name] = {
      ...config,
      skillAliases: config.skillAliases || {},
      conflictingMajors: config.conflictingMajors || [],
      weights: config.weights || {
        skillMatch: 0.35,
        educationMatch: 0.20,
        experienceMatch: 0.20,
        abilityMatch: 0.15,
        projectMatch: 0.10
      }
    };
    return true;
  }
  return false;
}
function updatePosition(name, config) {
  if (positionConfig[name]) {
    positionConfig[name] = { ...positionConfig[name], ...config };
    return true;
  }
  return false;
}

const DEFAULT_WEIGHTS = {
  skillMatch: 0.35,
  educationMatch: 0.20,
  experienceMatch: 0.20,
  abilityMatch: 0.15,
  projectMatch: 0.10
};

const DEFAULT_POSITION_CONFIG = positionConfig;

function normalizeStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value).split(/[\n,，;；|、]+/).map(s => s.trim()).filter(Boolean);
}

function normalizeSkillAliases(source) {
  if (!source || typeof source !== 'object') return {};
  const result = {};
  for (const [key, aliases] of Object.entries(source)) {
    result[String(key).trim()] = normalizeStringArray(aliases);
  }
  return result;
}

function normalizeWeights(weights) {
  const merged = {
    ...DEFAULT_WEIGHTS,
    ...(weights && typeof weights === 'object' ? weights : {})
  };
  return Object.keys(DEFAULT_WEIGHTS).reduce((result, key) => {
    const nextValue = Number(merged[key]);
    result[key] = Number.isFinite(nextValue) && nextValue >= 0 ? nextValue : DEFAULT_WEIGHTS[key];
    return result;
  }, {});
}

function cloneValue(value) {
  if (value === null || value === undefined) return value;
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}

function normalizePositionConfig(config) {
  const source = config && typeof config === 'object' ? config : {};
  return {
    coreSkills: normalizeStringArray(source.coreSkills),
    businessSkills: normalizeStringArray(source.businessSkills),
    education: normalizeStringArray(source.education),
    experience: normalizeStringArray(source.experience),
    abilityKeywords: normalizeStringArray(source.abilityKeywords),
    projectKeywords: normalizeStringArray(source.projectKeywords),
    skillAliases: normalizeSkillAliases(source.skillAliases),
    conflictingMajors: normalizeStringArray(source.conflictingMajors),
    weights: normalizeWeights(source.weights)
  };
}

function buildPositionDescription(name, config) {
  const normalizedConfig = normalizePositionConfig(config);
  const sections = [];
  if (normalizedConfig.coreSkills.length > 0) sections.push(`核心技能：${normalizedConfig.coreSkills.slice(0, 8).join('、')}`);
  if (normalizedConfig.education.length > 0) sections.push(`对口专业：${normalizedConfig.education.slice(0, 6).join('、')}`);
  if (normalizedConfig.experience.length > 0) sections.push(`相关经历：${normalizedConfig.experience.slice(0, 6).join('、')}`);
  return sections.length > 0 ? `${name}岗位画像，${sections.join('；')}` : `${name}岗位画像`;
}

function getPositionConfig(position, overrideConfig) {
  if (overrideConfig && typeof overrideConfig === 'object') {
    return normalizePositionConfig(overrideConfig);
  }

  // 使用智能匹配获取岗位配置名称
  const matchedPosition = matchPositionConfig(position);
  const config = DEFAULT_POSITION_CONFIG[matchedPosition];

  // 如果匹配失败，使用软件工程师作为默认配置（更适合技术类岗位）
  const fallback = DEFAULT_POSITION_CONFIG['软件工程师'] || DEFAULT_POSITION_CONFIG['商务管培生'] || {};

  return normalizePositionConfig(config || fallback);
}

function getDefaultPositionProfiles() {
  return getAllPositions().map(name => ({
    name,
    description: buildPositionDescription(name, DEFAULT_POSITION_CONFIG[name]),
    config: getPositionConfig(name)
  }));
}

module.exports = {
  DEFAULT_WEIGHTS,
  DEFAULT_POSITION_CONFIG,
  positionConfig: DEFAULT_POSITION_CONFIG,
  POSITION_KEYWORDS_MAP,
  matchPositionConfig,
  getPositionConfig,
  getAllPositions,
  getDefaultPositionProfiles,
  buildPositionDescription,
  normalizePositionConfig,
  normalizeStringArray,
  addPosition,
  updatePosition,
  cloneValue
};
