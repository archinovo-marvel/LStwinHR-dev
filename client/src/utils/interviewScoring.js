/* eslint-disable no-console */
// 面试对话评分系统 - IQ/EQ/AQ/MQ四维度结构化评估

// 从候选人对象中提取简历源文本，供AI生成面试问题时参考
export function extractResumeSummary(candidate) {
  if (!candidate) return '';

  // 优先使用简历源文本
  const analysis = candidate.resumeAnalysisResult || candidate.analysisDetails?.resumeAnalysis || candidate.resumeAnalysis;
  if (analysis?.sourceText) {
    return analysis.sourceText;
  }

  // 降级：返回基本信息
  const parts = [];
  if (candidate.name) parts.push(`姓名：${candidate.name}`);
  if (candidate.position) parts.push(`应聘岗位：${candidate.position}`);
  return parts.join('\n') || '暂无简历信息';
}

// 从候选人对象中提取岗位信息
export function extractPositionInfo(candidate) {
  if (!candidate) return { positionName: '未知', description: '', skills: [] };
  const profile = candidate.positionProfile;
  const skills = profile?.config?.skills || profile?.skills || [];
  return {
    positionName: candidate.position || '未知',
    description: candidate.positionDescription || profile?.description || '',
    skills: Array.isArray(skills) ? skills : []
  };
}

const INTERVIEW_SCORING_DEBUG = {
  enabled: false,
  flat: true
};

class InterviewScoring {
  constructor() {
    // 面试评分标准 - IQ/EQ/AQ/MQ四维度，满分100分（IQ 50分，EQ 20分，AQ 15分，MQ 15分）
    // 所有维度题目均由AI根据维度描述和评分标准动态生成
    this.scoringCriteria = {
      iq: {
        weight: 50,
        label: '智商IQ',
        dynamic: true,
        coreFocus: '专业知识深度、经验真实度、岗位胜任力',
        criteria: {
          iq1: { weight: 10, description: '专业知识深度考察', question: '' },
          iq2: { weight: 10, description: '经验真实度验证', question: '' },
          iq3: { weight: 10, description: '岗位胜任力评估', question: '' }
        }
      },
      eq: {
        weight: 20,
        label: '情商EQ',
        dynamic: true,
        coreFocus: '情绪管理、同理心、人际沟通',
        criteria: {
          eq1: { weight: 10, description: '冲突处理与情绪认知', question: '' },
          eq2: { weight: 10, description: '艰难沟通与同理心', question: '' },
          eq3: { weight: 10, description: '自我情绪觉察与调节', question: '' }
        }
      },
      aq: {
        weight: 15,
        label: '逆商AQ',
        dynamic: true,
        coreFocus: '抗压性、复原力、从失败中学习',
        criteria: {
          aq1: { weight: 10, description: '面对失败与反思', question: '' },
          aq2: { weight: 10, description: '逆境中的应变与决策', question: '' },
          aq3: { weight: 10, description: '持续高压下的动力维持', question: '' }
        }
      },
      mq: {
        weight: 15,
        label: '德商MQ',
        dynamic: true,
        coreFocus: '职业操守、原则性、诚信与社会责任感',
        criteria: {
          mq1: { weight: 10, description: '原则性与合规意识', question: '' },
          mq2: { weight: 10, description: '诚信与责任担当', question: '' },
          mq3: { weight: 10, description: '社会责任与伦理决策', question: '' }
        }
      }
    };

    // ========================================
    // P0改进：8维度评分体系定义
    // 新增4个维度：evidence、actionability、selfAwareness、growthMindset
    // ========================================
    this.evaluationDimensions = {
      // ===== 原有维度 =====
      relevance: {
        label: '相关性',
        description: '回答是否切题',
        weight: 1.0,
        rubric: [
          { range: [8, 10], desc: '紧扣问题核心，全面回应问题要点' },
          { range: [4, 7], desc: '基本回应问题，但部分偏题或遗漏' },
          { range: [0, 3], desc: '答非所问或严重偏题' }
        ]
      },
      depth: {
        label: '深度',
        description: '内容深度和细节程度',
        weight: 1.2,
        rubric: [
          { range: [8, 10], desc: '有具体行为细节、深刻反思、数据支撑' },
          { range: [4, 7], desc: '有基本描述，但细节或反思不够深入' },
          { range: [0, 3], desc: '笼统空泛，缺乏实质内容' }
        ]
      },
      clarity: {
        label: '清晰度',
        description: '表达是否清晰流畅',
        weight: 0.8,
        rubric: [
          { range: [8, 10], desc: '逻辑清晰，表达流畅，结构完整' },
          { range: [4, 7], desc: '表达基本清晰，偶有逻辑跳跃' },
          { range: [0, 3], desc: '逻辑混乱，表达不清' }
        ]
      },
      professionalism: {
        label: '专业性',
        description: '职业素养和成熟度',
        weight: 1.0,
        rubric: [
          { range: [8, 10], desc: '展现成熟心态、专业价值观和职业操守' },
          { range: [4, 7], desc: '基本职业素养，但不够成熟' },
          { range: [0, 3], desc: '缺乏职业素养或表现不成熟' }
        ]
      },
      // ===== 新增维度 =====
      evidence: {
        label: '证据性',
        description: '是否有具体数据、案例、成果支撑',
        weight: 1.1,
        rubric: [
          { range: [8, 10], desc: '提供具体数据（提升30%）、可验证案例、第三方认可' },
          { range: [4, 7], desc: '有案例描述但缺乏数据支撑，或数据模糊' },
          { range: [0, 3], desc: '纯理论描述，无具体案例或数据' }
        ],
        keywords: {
          positive: ['提升了', '降低了', '节省了', '完成了', '实现了', '数据', '指标', '成果', '效果', '量化'],
          negative: ['大概', '可能', '好像', '很多', '一些', '比较大的']
        }
      },
      actionability: {
        label: '可执行性',
        description: '方案是否具体可落地',
        weight: 0.9,
        rubric: [
          { range: [8, 10], desc: '有具体步骤、时间节点、资源需求、风险预案' },
          { range: [4, 7], desc: '有基本思路但缺乏细节，或过于理想化' },
          { range: [0, 3], desc: '空泛理论，无法落地' }
        ],
        keywords: {
          positive: ['第一步', '第二步', '时间节点', '资源分配', '具体步骤', '实施计划', '执行方案'],
          negative: ['看情况', '再说', '到时候', '尽量', '争取']
        }
      },
      selfAwareness: {
        label: '自我认知',
        description: '对自身能力和局限的认知深度',
        weight: 1.0,
        rubric: [
          { range: [8, 10], desc: '坦诚承认不足，有具体改进计划，客观评价优劣势' },
          { range: [4, 7], desc: '能说出部分优缺点，但分析不够深入' },
          { range: [0, 3], desc: '回避缺点、过度自信或缺乏反思' }
        ],
        keywords: {
          positive: ['我的不足是', '我需要改进', '我意识到', '我正在学习', '我需要加强', '反思', '总结'],
          negative: ['我没什么缺点', '我都很擅长', '这个问题不存在', '我什么都行']
        }
      },
      growthMindset: {
        label: '成长思维',
        description: '从失败中学习、持续改进的心态',
        weight: 1.1,
        rubric: [
          { range: [8, 10], desc: '主动分享失败教训，展现持续学习行动' },
          { range: [4, 7], desc: '能接受失败，学习转化不明显' },
          { range: [0, 3], desc: '回避失败、归咎外因、固定型思维' }
        ],
        keywords: {
          positive: ['我学到了', '下次我会', '这让我意识到', '我后来改进了', '复盘', '持续学习', '成长'],
          negative: ['这不是我的问题', '运气不好', '环境不允许', '无法改变', '天生就这样']
        }
      }
    };

    // 维度显示顺序（用于前端展示）
    this.dimensionOrder = [
      'relevance', 'depth', 'clarity', 'professionalism',
      'evidence', 'actionability', 'selfAwareness', 'growthMindset'
    ];

    // IQ/EQ/AQ/MQ 各题评分标准（0-10分等级描述）
    // IQ维度评分侧重专业知识深度和经验真实性
    this.dimensionRubrics = {
      iq1: [
        { range: [8, 10], desc: '专业知识扎实，能深入阐述技术细节，回答与简历经历高度吻合' },
        { range: [4, 7], desc: '有基本专业知识，能说明大概，但细节不够深入或与简历有出入' },
        { range: [0, 3], desc: '专业知识薄弱，回答含糊，与简历描述明显不符' }
      ],
      iq2: [
        { range: [8, 10], desc: '能提供具体项目细节、数据和成果，经验真实可信，逻辑自洽' },
        { range: [4, 7], desc: '能描述基本经历，但细节不够具体，部分内容缺乏佐证' },
        { range: [0, 3], desc: '描述笼统空泛，无法提供具体细节，经验真实性存疑' }
      ],
      iq3: [
        { range: [8, 10], desc: '展现岗位所需核心能力，有清晰职业规划，与岗位高度匹配' },
        { range: [4, 7], desc: '具备部分岗位能力，匹配度一般，需要进一步培养' },
        { range: [0, 3], desc: '核心能力不足，与岗位要求差距较大' }
      ],
      eq1: [
        { range: [8, 10], desc: '清晰剖析情绪变化，主动管理情绪、换位思考并达成双赢，有深刻反思' },
        { range: [4, 7], desc: '能识别双方情绪，描述了通过沟通寻求解决的具体步骤，结果尚可' },
        { range: [0, 3], desc: '只描述事件，未提及自身或他人情绪，解决方案简单或回避' }
      ],
      eq2: [
        { range: [8, 10], desc: '有完整策略：预判情绪、选择场合、阐述背景、开放沟通、提供支持' },
        { range: [4, 7], desc: '会考虑时机、方式，计划解释原因并愿意倾听反馈' },
        { range: [0, 3], desc: '仅考虑传递信息本身，未顾及团队接收感受' }
      ],
      eq3: [
        { range: [8, 10], desc: '有清晰自我预警指标，并有系统、主动的调整方案（如正念、任务重构、求助）' },
        { range: [4, 7], desc: '能列举具体身心信号，有常规放松方式（如运动、倾诉）' },
        { range: [0, 3], desc: '难以识别或描述模糊，调整措施单一无效' }
      ],
      aq1: [
        { range: [8, 10], desc: '坦诚剖析，重点阐述从中学到的具体东西及如何应用后续改进，展现成长型思维' },
        { range: [4, 7], desc: '客观描述，承担自身责任，能总结出基本经验教训' },
        { range: [0, 3], desc: '回避或淡化失败，归咎外因，未体现个人反思与学习' }
      ],
      aq2: [
        { range: [8, 10], desc: '立即评估现状，主动制定多套备选方案并推动共识，聚焦解决问题' },
        { range: [4, 7], desc: '会尝试分析问题、寻求帮助或调整部分计划' },
        { range: [0, 3], desc: '表现出放弃、抱怨或完全等待上级指令' }
      ],
      aq3: [
        { range: [8, 10], desc: '展示成熟心态管理（如重定意义、建立支持系统）与灵活的资源策略，保持核心产出' },
        { range: [4, 7], desc: '能通过分解任务、寻求短期激励来维持运作' },
        { range: [0, 3], desc: '仅表示"坚持"或"硬扛"，缺乏具体方法' }
      ],
      mq1: [
        { range: [8, 10], desc: '基于价值观和长期风险，选择合适渠道正式提出关切，并建议合规替代方案' },
        { range: [4, 7], desc: '会感到不安并私下提出疑问，但可能缺乏进一步行动' },
        { range: [0, 3], desc: '表示随大流或完全无视' }
      ],
      mq2: [
        { range: [8, 10], desc: '立即主动沟通，坦诚说明，同时已备好补救或替代方案，全力维护信誉' },
        { range: [4, 7], desc: '会及时告知延迟，但解决方案可能不充分' },
        { range: [0, 3], desc: '试图隐瞒或找借口拖延' }
      ],
      mq3: [
        { range: [8, 10], desc: '将社会责任视为决策必要维度，能举例说明如何主动做出合乎伦理、可持续的选择' },
        { range: [4, 7], desc: '能意识到影响，并在决策中偶尔纳入考量' },
        { range: [0, 3], desc: '认为与己无关或从未考虑' }
      ]
    };

    // 关键词评分规则 - 按IQ/EQ/AQ/MQ维度分类
    this.keywordScoring = {
      iq: {
        positive: { keywords: ['负责', '主导', '优化', '实现', '设计', '架构', '部署', '测试', '数据', '成果', '提升', '降低', '解决', '方案', '具体', '项目', '技术', '细节', '量化', '指标'], score: 2 },
        negative: { keywords: ['大概', '可能', '好像', '不太记得', '差不多', '应该', '感觉', '别人做的', '不清楚'], score: -2 }
      },
      eq: {
        positive: { keywords: ['换位思考', '共情', '理解', '倾听', '沟通', '感受', '情绪', '反思', '包容', '体谅'], score: 2 },
        negative: { keywords: ['不管', '无所谓', '不在乎', '懒得', '随便'], score: -2 }
      },
      aq: {
        positive: { keywords: ['调整', '改进', '学习', '克服', '坚持', '复盘', '成长', '总结', '应对', '突破'], score: 2 },
        negative: { keywords: ['放弃', '逃避', '抱怨', '没办法', '不可能', '做不到'], score: -2 }
      },
      mq: {
        positive: { keywords: ['原则', '合规', '诚信', '责任', '透明', '坦诚', '担当', '底线', '伦理', '可持续'], score: 2 },
        negative: { keywords: ['隐瞒', '欺骗', '违规', '敷衍', '推诿', '侥幸'], score: -2 }
      }
    };

    // ========================================
    // P0改进：升级关键词评分规则 - 三级权重体系
    // ========================================
    this.enhancedKeywordScoring = {
      iq: {
        positive: {
          // 强权重关键词（+3分）：体现核心贡献和领导力
          strong: {
            keywords: ['主导', '负责', '架构设计', '核心开发', '技术攻关', '从0到1', '独立完成', '带领团队'],
            score: 3
          },
          // 中权重关键词（+2分）：体现具体工作内容
          medium: {
            keywords: ['实现', '优化', '设计', '部署', '测试', '解决', '方案', '开发', '编码', '重构'],
            score: 2
          },
          // 弱权重关键词（+1分）：体现参与度
          weak: {
            keywords: ['参与', '协助', '配合', '支持', '跟进', '了解'],
            score: 1
          }
        },
        negative: {
          // 强负面（-3分）
          strong: {
            keywords: ['不清楚', '别人做的', '没参与', '不了解', '不是我负责', '与我无关'],
            score: -3
          },
          // 中负面（-2分）
          medium: {
            keywords: ['大概', '可能', '好像', '不太记得', '差不多', '应该'],
            score: -2
          },
          // 弱负面（-1分）
          weak: {
            keywords: ['感觉', '似乎', '好像'],
            score: -1
          }
        }
      },
      eq: {
        positive: {
          strong: {
            keywords: ['换位思考', '共情', '理解对方', '双赢', '达成共识', '化解矛盾', '建立信任'],
            score: 3
          },
          medium: {
            keywords: ['倾听', '沟通', '体谅', '包容', '反思', '理解', '尊重'],
            score: 2
          },
          weak: {
            keywords: ['考虑', '关注', '注意', '照顾'],
            score: 1
          }
        },
        negative: {
          strong: {
            keywords: ['不管', '无所谓', '不在乎', '与我无关', '关我什么事', '没必要'],
            score: -3
          },
          medium: {
            keywords: ['懒得', '随便', '敷衍'],
            score: -2
          }
        }
      },
      aq: {
        positive: {
          strong: {
            keywords: ['复盘总结', '持续改进', '突破', '从失败中学到', '化压力为动力', '逆境成长'],
            score: 3
          },
          medium: {
            keywords: ['调整', '改进', '学习', '克服', '坚持', '复盘', '成长', '总结'],
            score: 2
          },
          weak: {
            keywords: ['尝试', '努力', '尽力', '争取'],
            score: 1
          }
        },
        negative: {
          strong: {
            keywords: ['放弃', '逃避', '没办法', '不可能', '做不到', '没希望', '无能为力'],
            score: -3
          },
          medium: {
            keywords: ['抱怨', '太难', '太累', '受不了', '扛不住'],
            score: -2
          }
        }
      },
      mq: {
        positive: {
          strong: {
            keywords: ['坚持原则', '主动担责', '坦诚沟通', '坚守底线', '合规第一', '零容忍'],
            score: 3
          },
          medium: {
            keywords: ['原则', '合规', '诚信', '责任', '透明', '坦诚', '担当', '底线'],
            score: 2
          },
          weak: {
            keywords: ['注意', '关注', '重视', '谨慎'],
            score: 1
          }
        },
        negative: {
          strong: {
            keywords: ['隐瞒', '欺骗', '违规', '侥幸', '打擦边球', '钻空子', '明知故犯'],
            score: -3
          },
          medium: {
            keywords: ['敷衍', '推诿', '搪塞', '应付', '糊弄'],
            score: -2
          }
        }
      }
    };

    // P0改进：否定词列表（用于上下文判断）
    this.negationWords = ['不', '没有', '未', '无', '不会', '不能', '并非', '不是', '从未', '绝不', '别', '不要'];

    // ========================================
    // P1改进：题目难度分级体系
    // ========================================
    this.difficultyLevels = {
      JUNIOR: {
        level: 1,
        name: '初级',
        nameEn: 'Junior',
        description: '实习生、应届生、初级工程师（0-2年经验）',
        questionCount: 8,           // 题目数量较少
        depthRequirement: 'basic',  // 深度要求：基础
        scoringWeight: {
          iq: 0.40,  // IQ权重相对较低
          eq: 0.25,
          aq: 0.20,
          mq: 0.15
        },
        questionStyle: {
          iq: '基础概念、学习能力、知识掌握',
          eq: '团队相处、基本沟通、情绪认知',
          aq: '学业挫折、计划调整、压力应对',
          mq: '学术诚信、责任意识、基本原则'
        },
        answerExpectation: '能说清基本概念，有学习意愿，态度端正即可',
        followUpDepth: 1  // 追问深度：1层
      },
      MID_LEVEL: {
        level: 2,
        name: '中级',
        nameEn: 'Mid-level',
        description: '中级工程师、资深专员（2-5年经验）',
        questionCount: 10,
        depthRequirement: 'intermediate',
        scoringWeight: {
          iq: 0.50,
          eq: 0.20,
          aq: 0.18,
          mq: 0.12
        },
        questionStyle: {
          iq: '实际应用、问题解决、技术深度',
          eq: '协作沟通、冲突处理、跨部门合作',
          aq: '项目挫折、资源约束、多任务处理',
          mq: '职业诚信、责任担当、合规意识'
        },
        answerExpectation: '有具体案例，能说明解决思路，展现专业能力',
        followUpDepth: 2
      },
      SENIOR: {
        level: 3,
        name: '高级',
        nameEn: 'Senior',
        description: '高级工程师、技术专家、团队Lead（5-8年经验）',
        questionCount: 12,
        depthRequirement: 'advanced',
        scoringWeight: {
          iq: 0.55,
          eq: 0.18,
          aq: 0.15,
          mq: 0.12
        },
        questionStyle: {
          iq: '架构设计、技术决策、技术影响力',
          eq: '团队激励、跨团队协作、向上管理',
          aq: '项目危机、技术债务、资源争取',
          mq: '技术伦理、团队文化、长期规划'
        },
        answerExpectation: '有架构层面的思考，能权衡利弊，展现技术视野',
        followUpDepth: 3
      },
      EXPERT: {
        level: 4,
        name: '专家',
        nameEn: 'Expert/Principal',
        description: '架构师、技术总监、部门负责人（8年以上经验）',
        questionCount: 12,
        depthRequirement: 'expert',
        scoringWeight: {
          iq: 0.50,
          eq: 0.20,
          aq: 0.15,
          mq: 0.15
        },
        questionStyle: {
          iq: '技术战略、技术演进、组织能力建设',
          eq: '组织变革、文化塑造、高层沟通',
          aq: '业务危机、组织变革、战略调整',
          mq: '商业伦理、社会责任、价值观建设'
        },
        answerExpectation: '有战略高度，能推动组织变革，展现领导力',
        followUpDepth: 3
      }
    };

    // 岗位关键词到难度等级的映射
    this.positionDifficultyMapping = {
      // 专家级关键词
      EXPERT: ['架构师', '总监', 'vp', '首席', 'principal', 'distinguished', 'fellow', '技术负责人', '部门负责人', 'cto', 'cio'],
      // 高级关键词
      SENIOR: ['高级', '资深', 'senior', 'lead', '专家', 'principal', '技术经理', '团队负责人', 'tech lead'],
      // 中级关键词
      MID_LEVEL: ['中级', 'mid', '工程师', 'developer', '程序员', '专员'],
      // 初级关键词（默认）
      JUNIOR: ['初级', '实习', '应届', 'junior', 'intern', '助理', 'trainee']
    };

    // ========================================
    // P1改进：岗位权重配置模板
    // ========================================
    this.positionWeightTemplates = {
      // 技术研发类
      tech_dev: { iq: 60, eq: 15, aq: 15, mq: 10, name: '技术研发岗', category: 'tech' },
      tech_frontend: { iq: 55, eq: 20, aq: 15, mq: 10, name: '前端开发岗', category: 'tech' },
      tech_backend: { iq: 60, eq: 15, aq: 15, mq: 10, name: '后端开发岗', category: 'tech' },
      tech_algorithm: { iq: 65, eq: 10, aq: 15, mq: 10, name: '算法工程师', category: 'tech' },
      tech_qa: { iq: 50, eq: 20, aq: 20, mq: 10, name: '测试工程师', category: 'tech' },
      tech_ops: { iq: 50, eq: 20, aq: 20, mq: 10, name: '运维工程师', category: 'tech' },
      tech_data: { iq: 60, eq: 15, aq: 15, mq: 10, name: '数据工程师', category: 'tech' },
      tech_security: { iq: 55, eq: 15, aq: 15, mq: 15, name: '安全工程师', category: 'tech' },

      // 产品设计类
      product_manager: { iq: 40, eq: 30, aq: 20, mq: 10, name: '产品经理', category: 'product' },
      product_ops: { iq: 35, eq: 35, aq: 20, mq: 10, name: '产品运营', category: 'product' },
      design_ui: { iq: 45, eq: 25, aq: 20, mq: 10, name: 'UI/UX设计', category: 'product' },
      design_visual: { iq: 45, eq: 25, aq: 20, mq: 10, name: '视觉设计', category: 'product' },

      // 销售客服类
      sales_rep: { iq: 30, eq: 40, aq: 20, mq: 10, name: '销售代表', category: 'sales' },
      sales_manager: { iq: 30, eq: 35, aq: 20, mq: 15, name: '销售经理', category: 'sales' },
      customer_success: { iq: 30, eq: 40, aq: 20, mq: 10, name: '客户成功', category: 'sales' },
      bd: { iq: 30, eq: 40, aq: 20, mq: 10, name: '商务拓展', category: 'sales' },

      // 管理类
      project_manager: { iq: 35, eq: 30, aq: 20, mq: 15, name: '项目经理', category: 'management' },
      tech_manager: { iq: 45, eq: 25, aq: 20, mq: 10, name: '技术经理', category: 'management' },
      director: { iq: 40, eq: 25, aq: 20, mq: 15, name: '部门总监', category: 'management' },

      // 财务法务类
      finance: { iq: 45, eq: 15, aq: 15, mq: 25, name: '财务会计', category: 'finance' },
      audit: { iq: 40, eq: 15, aq: 15, mq: 30, name: '审计专员', category: 'finance' },
      legal: { iq: 35, eq: 20, aq: 15, mq: 30, name: '法务专员', category: 'finance' },
      compliance: { iq: 35, eq: 15, aq: 15, mq: 35, name: '合规专员', category: 'finance' },

      // 人力行政类
      hr: { iq: 35, eq: 35, aq: 20, mq: 10, name: 'HR专员', category: 'hr' },
      hrbp: { iq: 35, eq: 35, aq: 20, mq: 10, name: 'HRBP', category: 'hr' },
      recruiter: { iq: 30, eq: 40, aq: 20, mq: 10, name: '招聘专员', category: 'hr' },
      admin: { iq: 30, eq: 40, aq: 20, mq: 10, name: '行政专员', category: 'hr' },
      procurement: { iq: 35, eq: 30, aq: 20, mq: 15, name: '采购专员', category: 'hr' },

      // 市场类
      marketing: { iq: 35, eq: 35, aq: 20, mq: 10, name: '市场营销', category: 'marketing' },
      brand: { iq: 40, eq: 30, aq: 20, mq: 10, name: '品牌专员', category: 'marketing' },

      // 默认
      default: { iq: 50, eq: 20, aq: 15, mq: 15, name: '通用岗位', category: 'general' }
    };

    // 岗位名称到权重模板的映射关键词
    this.positionWeightKeywords = {
      tech_dev: ['开发', '工程师', 'developer', 'engineer', '程序员', '研发'],
      tech_frontend: ['前端', 'frontend', 'react', 'vue', 'web开发', 'h5'],
      tech_backend: ['后端', 'backend', 'java', 'python', 'go', 'node', '服务端'],
      tech_algorithm: ['算法', 'algorithm', 'ai', '机器学习', '深度学习', 'nlp', 'cv'],
      tech_qa: ['测试', 'qa', 'quality', '测试工程师', '质量'],
      tech_ops: ['运维', 'ops', 'devops', 'sre', '运维工程师', '系统管理'],
      tech_data: ['数据', 'data', '大数据', 'etl', '数仓', '数据仓库'],
      tech_security: ['安全', 'security', '网络安全', '信息安全'],
      product_manager: ['产品经理', 'product manager', 'pm', '产品设计'],
      product_ops: ['运营', 'operation', '产品运营', '用户运营'],
      design_ui: ['设计', 'design', 'ui', 'ux', '视觉', '交互'],
      sales_rep: ['销售', 'sales', '业务员', '销售代表', '销售专员'],
      sales_manager: ['销售经理', 'sales manager', '销售总监'],
      customer_success: ['客户成功', 'customer success', 'cs', '客户服务'],
      bd: ['商务', 'bd', '商务拓展', 'business', '商务经理'],
      project_manager: ['项目经理', 'project manager', 'pm', '项目管理'],
      tech_manager: ['技术经理', '技术负责人', 'tech lead', 'tech manager', '研发经理'],
      director: ['总监', 'director', 'vp', '负责人', 'head'],
      finance: ['财务', 'finance', '会计', 'accounting', '出纳'],
      audit: ['审计', 'audit', '内审'],
      legal: ['法务', 'legal', '律师', '法律'],
      compliance: ['合规', 'compliance', '风控'],
      hr: ['hr', '人事', '人力资源', '人力'],
      hrbp: ['hrbp', '业务伙伴', '人力资源伙伴'],
      recruiter: ['招聘', 'recruiter', 'recruitment', '人才引进'],
      admin: ['行政', 'admin', '助理', '秘书', '前台'],
      procurement: ['采购', 'procurement', 'purchasing', '供应商'],
      marketing: ['市场', 'marketing', '推广', '渠道'],
      brand: ['品牌', 'brand', '公关', 'pr']
    };

    // ========================================
    // P2改进：岗位定制化题目库
    // ========================================
    this.positionSpecificQuestions = {
      // 技术类岗位题目
      tech: {
        iq: [
          {
            id: 'tech_iq_1',
            category: '技术深度',
            question: '请详细介绍你在项目中使用过的核心技术栈，遇到过什么技术难题？',
            followUpQuestions: [
              '你提到的这个问题，具体是怎么解决的？',
              '有没有考虑过其他方案？为什么选择这个方案？'
            ],
            evaluationCriteria: {
              high: '能深入讲解技术原理，有实际踩坑经验',
              medium: '了解基本用法，能说明常见问题',
              low: '仅了解概念，缺乏实践经验'
            }
          },
          {
            id: 'tech_iq_2',
            category: '架构设计',
            question: '请描述一次你参与或主导的系统设计经历，包括设计思路和关键决策。',
            evaluationCriteria: {
              high: '能说明架构原理，有权衡取舍的思考',
              medium: '了解基本设计，能说明主要考虑点',
              low: '缺乏架构设计经验'
            }
          },
          {
            id: 'tech_iq_3',
            category: '问题解决',
            question: '请描述一次你解决过的最棘手的技术问题，从发现到解决的完整过程。',
            evaluationCriteria: {
              high: '有完整的问题分析和解决思路',
              medium: '能描述问题和解决方案',
              low: '问题描述不清或缺乏深度'
            }
          }
        ],
        eq: [
          {
            id: 'tech_eq_1',
            category: '技术评审冲突',
            question: '在技术方案评审中，如果其他同事强烈反对你的方案，你会如何处理？',
            evaluationCriteria: {
              high: '能客观分析利弊，寻求共识',
              medium: '能听取意见，但处理方式欠佳',
              low: '情绪化应对或拒绝沟通'
            }
          },
          {
            id: 'tech_eq_2',
            category: '跨团队协作',
            question: '当你的开发进度依赖其他团队，但对方延期了，你会怎么处理？',
            evaluationCriteria: {
              high: '主动沟通协调，寻找替代方案',
              medium: '会沟通但缺乏主动性',
              low: '等待或抱怨'
            }
          }
        ],
        aq: [
          {
            id: 'tech_aq_1',
            category: '项目延期',
            question: '如果项目临近上线发现一个严重的性能问题，你会如何处理？',
            evaluationCriteria: {
              high: '快速评估影响，制定多套方案',
              medium: '能提出解决方案',
              low: '等待指示或推卸责任'
            }
          }
        ],
        mq: [
          {
            id: 'tech_mq_1',
            category: '代码安全',
            question: '如果在代码审查中发现同事的代码存在安全漏洞，但他说"先上线再说"，你会怎么处理？',
            evaluationCriteria: {
              high: '坚持安全原则，说明风险',
              medium: '会提出担忧',
              low: '随大流不坚持'
            }
          }
        ]
      },

      // 产品类岗位题目
      product: {
        iq: [
          {
            id: 'product_iq_1',
            category: '需求分析',
            question: '请描述一次你如何将模糊的业务需求转化为具体的产品方案？',
            evaluationCriteria: {
              high: '有完整的需求分析框架和方法论',
              medium: '能描述基本流程',
              low: '缺乏需求分析经验'
            }
          },
          {
            id: 'product_iq_2',
            category: '数据驱动',
            question: '请举例说明你如何用数据驱动产品决策？',
            evaluationCriteria: {
              high: '有完整的数据分析和决策闭环',
              medium: '能使用数据辅助决策',
              low: '缺乏数据意识'
            }
          }
        ],
        eq: [
          {
            id: 'product_eq_1',
            category: '需求冲突',
            question: '当业务方和研发团队对需求优先级有分歧时，你如何协调？',
            evaluationCriteria: {
              high: '能平衡各方诉求，达成共识',
              medium: '能沟通但缺乏协调技巧',
              low: '偏向一方或回避'
            }
          }
        ],
        aq: [
          {
            id: 'product_aq_1',
            category: '产品失败',
            question: '请描述一次产品失败的经历，你从中学到了什么？',
            evaluationCriteria: {
              high: '能客观分析原因，有改进措施',
              medium: '能描述经历但反思不深',
              low: '归咎外因或回避'
            }
          }
        ],
        mq: [
          {
            id: 'product_mq_1',
            category: '用户隐私',
            question: '如果业务方要求采集用户敏感数据来提升转化率，你会怎么处理？',
            evaluationCriteria: {
              high: '坚持隐私保护原则，提出合规方案',
              medium: '会提出担忧',
              low: '妥协或忽视风险'
            }
          }
        ]
      },

      // 销售类岗位题目
      sales: {
        iq: [
          {
            id: 'sales_iq_1',
            category: '产品理解',
            question: '请介绍你销售过的产品，以及你是如何理解客户需求的？',
            evaluationCriteria: {
              high: '对产品理解深入，有客户洞察',
              medium: '了解产品和客户',
              low: '理解肤浅'
            }
          },
          {
            id: 'sales_iq_2',
            category: '销售策略',
            question: '请描述一次你成功拿下的重要客户案例，你的策略是什么？',
            evaluationCriteria: {
              high: '有清晰的销售策略和方法论',
              medium: '能描述过程',
              low: '缺乏策略思考'
            }
          }
        ],
        eq: [
          {
            id: 'sales_eq_1',
            category: '客户关系',
            question: '当客户对你的产品提出强烈不满时，你如何处理？',
            evaluationCriteria: {
              high: '能共情处理，化解矛盾',
              medium: '能应对但技巧不足',
              low: '情绪化或回避'
            }
          }
        ],
        aq: [
          {
            id: 'sales_aq_1',
            category: '业绩压力',
            question: '当连续几个月未完成业绩目标时，你会怎么做？',
            evaluationCriteria: {
              high: '能分析原因，调整策略',
              medium: '会努力但缺乏方法',
              low: '放弃或抱怨'
            }
          }
        ],
        mq: [
          {
            id: 'sales_mq_1',
            category: '销售诚信',
            question: '如果为了完成业绩需要夸大产品功能，你会怎么做？',
            evaluationCriteria: {
              high: '坚持诚信原则',
              medium: '会犹豫',
              low: '可能妥协'
            }
          }
        ]
      },

      // 管理类岗位题目
      management: {
        iq: [
          {
            id: 'mgmt_iq_1',
            category: '团队建设',
            question: '请描述你如何搭建和管理一个高效的团队？',
            evaluationCriteria: {
              high: '有系统的团队建设方法论',
              medium: '有基本管理经验',
              low: '缺乏管理经验'
            }
          },
          {
            id: 'mgmt_iq_2',
            category: '战略规划',
            question: '请描述一次你制定并执行团队战略规划的经历。',
            evaluationCriteria: {
              high: '有战略思维和执行能力',
              medium: '能制定基本计划',
              low: '缺乏战略意识'
            }
          }
        ],
        eq: [
          {
            id: 'mgmt_eq_1',
            category: '团队冲突',
            question: '当团队成员之间发生严重冲突时，你如何处理？',
            evaluationCriteria: {
              high: '能公正处理，化解矛盾',
              medium: '能介入但效果一般',
              low: '回避或偏袒'
            }
          }
        ],
        aq: [
          {
            id: 'mgmt_aq_1',
            category: '团队危机',
            question: '当团队面临重大危机（如核心成员离职、项目失败）时，你如何应对？',
            evaluationCriteria: {
              high: '能稳定军心，带领团队走出困境',
              medium: '能应对但缺乏领导力',
              low: '慌乱或推卸责任'
            }
          }
        ],
        mq: [
          {
            id: 'mgmt_mq_1',
            category: '管理伦理',
            question: '如果上级要求你辞退一名表现尚可的员工来"优化结构"，你会怎么处理？',
            evaluationCriteria: {
              high: '能坚持原则，保护员工权益',
              medium: '会提出担忧',
              low: '完全服从'
            }
          }
        ]
      },

      // 财务类岗位题目
      finance: {
        iq: [
          {
            id: 'fin_iq_1',
            category: '专业知识',
            question: '请介绍你在财务工作中最擅长的领域，以及相关经验。',
            evaluationCriteria: {
              high: '专业知识扎实，经验丰富',
              medium: '了解基本知识',
              low: '专业能力不足'
            }
          }
        ],
        eq: [
          {
            id: 'fin_eq_1',
            category: '跨部门沟通',
            question: '当业务部门不理解财务合规要求时，你如何沟通？',
            evaluationCriteria: {
              high: '能耐心解释，达成理解',
              medium: '能沟通但效果一般',
              low: '强硬或回避'
            }
          }
        ],
        aq: [
          {
            id: 'fin_aq_1',
            category: '结账压力',
            question: '月底结账时发现重大问题，时间紧迫，你如何处理？',
            evaluationCriteria: {
              high: '能冷静处理，确保准确',
              medium: '能应对但压力大',
              low: '慌乱或敷衍'
            }
          }
        ],
        mq: [
          {
            id: 'fin_mq_1',
            category: '财务诚信',
            question: '如果上级要求你"调整"财务数据，你会怎么处理？',
            evaluationCriteria: {
              high: '坚决拒绝，说明风险',
              medium: '会犹豫',
              low: '可能妥协'
            }
          }
        ]
      },

      // HR类岗位题目
      hr: {
        iq: [
          {
            id: 'hr_iq_1',
            category: 'HR专业',
            question: '请介绍你在人力资源工作中最擅长的模块，以及相关经验。',
            evaluationCriteria: {
              high: 'HR专业知识扎实',
              medium: '了解基本知识',
              low: '专业能力不足'
            }
          }
        ],
        eq: [
          {
            id: 'hr_eq_1',
            category: '员工关系',
            question: '当员工对公司的处理决定强烈不满时，你如何处理？',
            evaluationCriteria: {
              high: '能共情处理，化解矛盾',
              medium: '能沟通但技巧不足',
              low: '强硬或回避'
            }
          }
        ],
        aq: [
          {
            id: 'hr_aq_1',
            category: '招聘压力',
            question: '当关键岗位长期招不到人时，你会怎么做？',
            evaluationCriteria: {
              high: '能调整策略，多渠道解决',
              medium: '会努力但方法单一',
              low: '放弃或抱怨'
            }
          }
        ],
        mq: [
          {
            id: 'hr_mq_1',
            category: 'HR伦理',
            question: '如果发现招聘中存在"关系户"，你会怎么处理？',
            evaluationCriteria: {
              high: '坚持公平原则',
              medium: '会提出担忧',
              low: '可能妥协'
            }
          }
        ]
      },

      // 通用岗位题目（默认）
      general: {
        iq: [
          {
            id: 'gen_iq_1',
            category: '专业能力',
            question: '请介绍你在当前岗位最擅长的技能，以及相关经验。',
            evaluationCriteria: {
              high: '专业能力强，经验丰富',
              medium: '有基本能力',
              low: '能力不足'
            }
          }
        ],
        eq: [
          {
            id: 'gen_eq_1',
            category: '团队协作',
            question: '请描述一次你与团队成员协作完成任务的经历。',
            evaluationCriteria: {
              high: '协作能力强',
              medium: '能协作',
              low: '协作能力不足'
            }
          }
        ],
        aq: [
          {
            id: 'gen_aq_1',
            category: '挫折应对',
            question: '请描述一次工作中遇到的挫折，你是如何应对的？',
            evaluationCriteria: {
              high: '能积极应对，从中学习',
              medium: '能应对',
              low: '应对能力不足'
            }
          }
        ],
        mq: [
          {
            id: 'gen_mq_1',
            category: '职业操守',
            question: '请描述一次你在工作中面临道德抉择的经历。',
            evaluationCriteria: {
              high: '能坚持原则',
              medium: '有基本意识',
              low: '原则性不足'
            }
          }
        ]
      }
    };

    this._debugSessionCounter = 0;
  }

  // ========================================
  // P1改进：难度等级判断方法
  // ========================================

  /**
   * 根据岗位名称和工作经验判断难度等级
   * @param {string} positionName - 岗位名称
   * @param {number|string} experience - 工作经验年限
   * @returns {object} 难度等级配置
   */
  determineDifficultyLevel(positionName, experience) {
    const positionLower = (positionName || '').toLowerCase();

    // 1. 优先根据岗位名称关键词判断
    for (const [level, keywords] of Object.entries(this.positionDifficultyMapping)) {
      if (keywords.some(kw => positionLower.includes(kw.toLowerCase()))) {
        return {
          levelKey: level,
          ...this.difficultyLevels[level]
        };
      }
    }

    // 2. 根据工作年限判断
    if (experience) {
      const years = parseInt(String(experience).replace(/[^0-9]/g, '')) || 0;
      if (years >= 8) {
        return { levelKey: 'EXPERT', ...this.difficultyLevels.EXPERT };
      }
      if (years >= 5) {
        return { levelKey: 'SENIOR', ...this.difficultyLevels.SENIOR };
      }
      if (years >= 2) {
        return { levelKey: 'MID_LEVEL', ...this.difficultyLevels.MID_LEVEL };
      }
      return { levelKey: 'JUNIOR', ...this.difficultyLevels.JUNIOR };
    }

    // 3. 默认返回中级
    return { levelKey: 'MID_LEVEL', ...this.difficultyLevels.MID_LEVEL };
  }

  /**
   * 检测是否为应届生/无工作经验
   * @param {string} resumeText - 简历文本
   * @returns {boolean}
   */
  detectFreshGraduate(resumeText) {
    if (!resumeText) return false;
    const text = resumeText.toLowerCase();

    // 检测工作经历关键词
    const workIndicators = ['工作经历', '工作经验', '在职', '任职', '公司', '企业', '工作年限'];
    const hasWork = workIndicators.some(kw => text.includes(kw));

    // 检测应届生标识
    const freshIndicators = ['应届', '实习', '校园', '学生', '毕业', '校园招聘', '校招'];
    const isFresh = freshIndicators.some(kw => text.includes(kw));

    // 如果明确是应届生或没有工作经历关键词
    return isFresh || !hasWork;
  }

  /**
   * 根据难度等级获取题目数量
   * @param {string} difficultyLevel - 难度等级key
   * @returns {number} 题目数量
   */
  getQuestionCount(difficultyLevel) {
    const level = this.difficultyLevels[difficultyLevel] || this.difficultyLevels.MID_LEVEL;
    return level.questionCount;
  }

  /**
   * 根据难度等级获取评分权重
   * @param {string} difficultyLevel - 难度等级key
   * @returns {object} 各维度权重
   */
  getScoringWeight(difficultyLevel) {
    const level = this.difficultyLevels[difficultyLevel] || this.difficultyLevels.MID_LEVEL;
    return level.scoringWeight;
  }

  // ========================================
  // P1改进：岗位权重配置方法
  // ========================================

  /**
   * 根据岗位名称自动匹配权重模板
   * @param {string} positionName - 岗位名称
   * @returns {object} 匹配到的权重配置
   */
  matchPositionWeightTemplate(positionName) {
    const positionLower = (positionName || '').toLowerCase();

    // 遍历岗位关键词映射
    for (const [templateKey, keywords] of Object.entries(this.positionWeightKeywords)) {
      if (keywords.some(kw => positionLower.includes(kw.toLowerCase()))) {
        const template = this.positionWeightTemplates[templateKey];
        return {
          templateKey,
          ...template
        };
      }
    }

    // 未匹配到则返回默认配置
    return {
      templateKey: 'default',
      ...this.positionWeightTemplates.default
    };
  }

  /**
   * 使用自定义权重计算总分
   * @param {object} categoryScores - 各维度得分 { iq: {...}, eq: {...}, ... }
   * @param {object} weights - 权重配置 { iq: 50, eq: 20, aq: 15, mq: 15 }
   * @returns {number} 加权总分
   */
  calculateWeightedScore(categoryScores, weights) {
    if (!categoryScores || !weights) {
      return this.calculateTotalScore(categoryScores);
    }

    const { iq, eq, aq, mq } = weights;
    const iqScore = (categoryScores.iq?.rawScore || 0) / 10 * iq;
    const eqScore = (categoryScores.eq?.rawScore || 0) / 10 * eq;
    const aqScore = (categoryScores.aq?.rawScore || 0) / 10 * aq;
    const mqScore = (categoryScores.mq?.rawScore || 0) / 10 * mq;

    return Math.round((iqScore + eqScore + aqScore + mqScore) * 10) / 10;
  }

  /**
   * 验证权重配置是否有效
   * @param {object} weights - 权重配置 { iq, eq, aq, mq }
   * @returns {object} { valid: boolean, message: string }
   */
  validateWeights(weights) {
    if (!weights || typeof weights !== 'object') {
      return { valid: false, message: '权重配置不能为空' };
    }

    const { iq, eq, aq, mq } = weights;
    const dimensions = ['iq', 'eq', 'aq', 'mq'];

    // 检查是否所有维度都有权重
    for (const dim of dimensions) {
      if (typeof weights[dim] !== 'number' || isNaN(weights[dim])) {
        return { valid: false, message: `维度 ${dim.toUpperCase()} 的权重无效` };
      }
      if (weights[dim] < 0 || weights[dim] > 100) {
        return { valid: false, message: `维度 ${dim.toUpperCase()} 的权重必须在0-100之间` };
      }
    }

    // 检查权重总和是否为100
    const total = iq + eq + aq + mq;
    if (Math.abs(total - 100) > 0.1) {
      return { valid: false, message: `权重总和必须为100%，当前总和为 ${total}%` };
    }

    return { valid: true, message: '权重配置有效' };
  }

  /**
   * 获取所有岗位权重模板列表
   * @returns {Array} 模板列表
   */
  getAllWeightTemplates() {
    return Object.entries(this.positionWeightTemplates).map(([key, config]) => ({
      key,
      ...config
    }));
  }

  /**
   * 根据岗位类别获取权重模板
   * @param {string} category - 岗位类别 (tech, product, sales, management, finance, hr, marketing)
   * @returns {Array} 该类别的模板列表
   */
  getWeightTemplatesByCategory(category) {
    return Object.entries(this.positionWeightTemplates)
      .filter(([_, config]) => config.category === category)
      .map(([key, config]) => ({ key, ...config }));
  }

  // 获取结构化面试问题列表（所有维度题目由AI动态生成）
  getStructuredQuestions() {
    const questions = [];
    ['iq', 'eq', 'aq', 'mq'].forEach(dim => {
      const criteria = this.scoringCriteria[dim].criteria;
      Object.keys(criteria).forEach(key => {
        questions.push({
          id: key,
          dimension: dim,
          dimensionLabel: this.scoringCriteria[dim].label,
          description: criteria[key].description,
          question: criteria[key].question,
          maxScore: criteria[key].weight,
          dynamic: true
        });
      });
    });
    return questions;
  }

  // 构建任意维度的题目生成提示词（所有维度均由AI动态生成）
  // P1改进：添加 difficultyLevel 参数，支持难度分级
  buildDimensionQuestionPrompt(dimension, questionIndex, resumeText, positionInfo, previousQA = [], difficultyLevel = 'MID_LEVEL') {
    const dimConfig = this.scoringCriteria[dimension];
    if (!dimConfig) return '';
    const criteriaKeys = Object.keys(dimConfig.criteria);
    const criteriaKey = criteriaKeys[questionIndex] || criteriaKeys[0];
    const criteriaItem = dimConfig.criteria[criteriaKey];
    const rubric = this.dimensionRubrics[criteriaKey] || [];
    const rubricText = rubric.map(r => `${r.range[0]}-${r.range[1]}分：${r.desc}`).join('\n');

    const isIQ = dimension === 'iq';

    // P1改进：获取难度等级配置
    const difficultyConfig = this.difficultyLevels[difficultyLevel] || this.difficultyLevels.MID_LEVEL;

    // 检测候选人背景类型
    const isFreshGraduate = this.detectFreshGraduate(resumeText);

    // P1改进：根据难度等级生成问题风格描述
    const questionStyle = difficultyConfig.questionStyle[dimension] || dimConfig.coreFocus;

    // P1改进：难度相关的问题深度指令
    const difficultyInstruction = this.getDifficultyInstruction(difficultyConfig, dimension);

    // 所有维度都注入简历信息
    const resumeSection = `
【候选人简历摘要】
${resumeText || '暂无简历信息'}

【目标岗位】
- 岗位名称：${positionInfo?.positionName || '未知'}
- 岗位描述：${positionInfo?.description || '暂无'}
${positionInfo?.skills ? `- 技能要求：${positionInfo.skills.join('、')}` : ''}

【候选人背景类型】${isFreshGraduate ? '应届生/无工作经验（请从校园经历、项目经验、实习经历中提问）' : '有工作经验'}
【面试难度】${difficultyConfig.name}（${difficultyConfig.description}）`;

    // IQ维度前序问答上下文
    const previousContext = (isIQ && previousQA.length > 0) ? `
【前序问题与回答】（请基于此进行追问深挖）
${previousQA.map((qa, i) => `第${i + 1}问：${qa.question}\n候选人回答：${qa.answer}`).join('\n')}

【追问要求】这是IQ维度的第${questionIndex + 1}题，必须与前序问题形成递进追问关系：
- 不要重复前面已经问过的内容
- 针对候选人回答中的具体细节或漏洞进行深挖
- 追问"具体是怎么做的"、"遇到了什么困难"、"你是如何解决的"
` : '';

    // IQ各题差异化指令
    const iqSpecificGuidance = isIQ ? {
      0: `【第1题指令】专业知识深度考察
- 从简历中选择一项核心技能或项目经验作为切入点
- 要求候选人详细阐述技术细节、实现方案、难点攻克`,
      1: `【第2题指令】经验真实度验证（追问深挖）
- 必须针对第1题的回答进行追问
- 追问候选人回答中的具体细节、数据支撑、个人贡献`,
      2: `【第3题指令】岗位胜任力评估（关联验证）
- 将候选人的回答与目标岗位要求进行关联
- 评估其核心能力是否匹配岗位需求`
    }[questionIndex] : '';

    // 根据维度和背景生成差异化指导
    const dimensionGuidance = this.getDimensionGuidance(dimension, questionIndex, isFreshGraduate);

    const iqExtraRules = isIQ ? `
5. 问题必须紧密结合候选人简历中的具体经历和技能来提问
6. 要追问专业细节和实际案例，验证经验真实性
${questionIndex > 0 ? `7. 这是第${questionIndex + 1}题，必须针对前面候选人的回答进行追问，不要问新话题` : ''}` : '';

    return `你是资深面试官，正在对候选人进行${dimConfig.label}维度的第${questionIndex + 1}题面试。

【面试难度】${difficultyConfig.name}级 - ${difficultyConfig.description}
【问题风格】${questionStyle}
${difficultyInstruction}

【维度核心考察点】${dimConfig.coreFocus}
【本题考察方向】${criteriaItem.description}
${dimensionGuidance}
【评分标准参考】
${rubricText || '8-10分：表现优秀；4-7分：表现一般；0-3分：表现不足'}
${resumeSection}
${previousContext}
${iqSpecificGuidance}
【强制要求】
1. 问题必须针对"${criteriaItem.description}"这一考察方向
2. ${isFreshGraduate
    ? '候选人无工作经验，请从校园经历、项目经验、实习经历、学习过程或假设情境中提问'
    : '使用行为事件访谈法，引导候选人描述具体工作经历和行为'}
3. 避免接受理论性、假设性的回答（除非是无经验者情境模拟）
4. 问题要结合候选人的简历背景，不要问完全无关的问题
5. 只输出一个面试问题，不要输出任何其他内容${iqExtraRules}

【期望回答标准】${difficultyConfig.answerExpectation}

直接输出面试问题：`;
  }

  /**
   * P1改进：根据难度等级生成问题深度指令
   */
  getDifficultyInstruction(difficultyConfig, dimension) {
    const { level, depthRequirement, followUpDepth } = difficultyConfig;

    const depthInstructions = {
      1: `【初级难度指令】
- 问题应聚焦基础概念和标准流程
- 可以接受理论性回答
- 重点考察学习态度和基础知识掌握
- 避免过于复杂的情境`,
      2: `【中级难度指令】
- 问题应结合实际工作场景
- 要求有具体案例和解决思路
- 重点考察独立解决问题的能力
- 避免过于抽象的理论问题`,
      3: `【高级难度指令】
- 问题应涉及架构设计或技术决策
- 要求有深度分析和权衡考量
- 重点考察技术深度和影响力
- 追问技术选型的利弊分析
- 期望回答能展现技术视野`,
      4: `【专家难度指令】
- 问题应涉及战略规划和组织影响
- 要求有跨团队/跨部门的影响力案例
- 重点考察技术视野和领导力
- 追问如何推动组织变革
- 期望回答能展现战略高度`
    };

    return depthInstructions[level] || depthInstructions[2];
  }

  // 根据维度和背景生成差异化指导
  getDimensionGuidance(dimension, questionIndex, isFreshGraduate) {
    const guides = {
      iq: {
        0: isFreshGraduate
          ? '【应届生IQ考察策略】从专业技能、课程项目、竞赛经历中考察知识深度'
          : '【有经验者IQ考察策略】从实际工作项目中考察专业深度和经验真实度',
        1: '【追问策略】针对前一题回答追问具体细节和可验证信息',
        2: '【胜任力评估】将候选人能力与岗位要求进行匹配分析'
      },
      eq: {
        0: isFreshGraduate
          ? '【应届生EQ考察策略】从团队合作、社团活动、宿舍相处中考察情商'
          : '【有经验者EQ考察策略】从跨部门协作、客户沟通、团队管理中考察情商',
        1: isFreshGraduate
          ? '【应届生情境】从给同学/老师传递困难消息的情境考察同理心'
          : '【有经验者情境】从给下属/客户传递坏消息的情境考察同理心',
        2: '【自我觉察】考察对自己情绪状态的认知和调节方法'
      },
      aq: {
        0: isFreshGraduate
          ? '【应届生AQ考察策略】从学业挫折、竞赛失败、求职受挫中考察逆商'
          : '【有经验者AQ考察策略】从项目失败、职场挫折中考察逆商',
        1: '【应变能力】考察在计划被打乱时的应对策略',
        2: '【抗压能力】考察在持续压力下的心理调节方法'
      },
      mq: {
        0: '【原则性】考察面对违规要求的处理方式',
        1: isFreshGraduate
          ? '【应届生诚信考察】从学术诚信、考试诚信、承诺履行中考察'
          : '【有经验者诚信考察】从职业诚信、责任担当中考察',
        2: '【社会责任】考察对社会公益、伦理议题的态度'
      }
    };
    return guides[dimension]?.[questionIndex] || '';
  }

  isDebugEnabled() {
    if (INTERVIEW_SCORING_DEBUG?.enabled === true) return true;
    try {
      if (typeof window !== 'undefined') {
        if (window.__INTERVIEW_SCORING_DEBUG__ === true) return true;
        try { return window.localStorage?.getItem('interview_scoring_debug') === '1'; } catch (e) { return false; }
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  isDebugFlat() {
    return INTERVIEW_SCORING_DEBUG?.flat === true;
  }

  debugGroup(title) {
    if (!this.isDebugEnabled()) return;
    try {
      if (this.isDebugFlat()) { console.log(title); return; }
      if (console.groupCollapsed) console.groupCollapsed(title);
      else if (console.group) console.group(title);
      else console.log(title);
    } catch (e) { /* ignore */ }
  }

  debugGroupEnd() {
    if (!this.isDebugEnabled()) return;
    try { if (!this.isDebugFlat() && console.groupEnd) console.groupEnd(); } catch (e) { /* ignore */ }
  }

  debugLog(label, value) {
    if (!this.isDebugEnabled()) return;
    try {
      if (this.isDebugFlat() && value !== null && typeof value === 'object') {
        let text;
        try { text = JSON.stringify(value); } catch (e) { try { text = JSON.stringify(JSON.parse(JSON.stringify(value))); } catch (e2) { text = String(value); } }
        console.log(`${label} ${text}`);
        return;
      }
      console.log(label, value);
    } catch (e) { /* ignore */ }
  }

  debugDelta(deltaLabel, deltaValue, context = {}) {
    if (!this.isDebugEnabled()) return;
    this.debugLog(`  • Δ ${deltaLabel}:`, { delta: deltaValue, ...context });
  }

  normalizeText(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      if (typeof value.answer === 'string') return value.answer;
      if (typeof value.question === 'string') return value.question;
    }
    try { return String(value); } catch (e) { return ''; }
  }

  calculateScore(conversationData) {
    return this.analyzeInterviewConversation(conversationData);
  }

  // AI评分（调用后端评分服务）
  async analyzeWithAI(conversationData) {
    try {
      const response = await fetch('/api/interview/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: conversationData.questions,
          candidateAnswers: conversationData.candidateAnswers
        })
      });
      if (!response.ok) throw new Error('AI评分请求失败');
      const result = await response.json();
      const questionScores = result.questionScores || [];
      const iqScores = questionScores.filter((_, i) => i < 3);
      const eqScores = questionScores.filter((_, i) => i >= 3 && i < 6);
      const aqScores = questionScores.filter((_, i) => i >= 6 && i < 9);
      const mqScores = questionScores.filter((_, i) => i >= 9 && i < 12);
      const avgArr = (arr, key) => arr.length > 0 ? arr.reduce((s, q) => s + (q[key] || 0), 0) / arr.length : 0;
      const iqRaw = (avgArr(iqScores, 'relevance') + avgArr(iqScores, 'depth')) / 2;
      const eqRaw = (avgArr(eqScores, 'relevance') + avgArr(eqScores, 'depth')) / 2;
      const aqRaw = (avgArr(aqScores, 'relevance') + avgArr(aqScores, 'depth')) / 2;
      const mqRaw = (avgArr(mqScores, 'relevance') + avgArr(mqScores, 'depth')) / 2;
      return {
        totalScore: result.totalScore,
        categoryScores: {
          iq: { score: Math.round(iqRaw / 10 * 50 * 10) / 10, rawScore: Math.round(iqRaw * 10) / 10 },
          eq: { score: Math.round(eqRaw / 10 * 20 * 10) / 10, rawScore: Math.round(eqRaw * 10) / 10 },
          aq: { score: Math.round(aqRaw / 10 * 15 * 10) / 10, rawScore: Math.round(aqRaw * 10) / 10 },
          mq: { score: Math.round(mqRaw / 10 * 15 * 10) / 10, rawScore: Math.round(mqRaw * 10) / 10 }
        },
        questionScores: result.questionScores,
        summary: result.summary,
        strengths: [],
        weaknesses: [],
        aiEvaluated: true
      };
    } catch (e) {
      console.warn('AI评分降级到规则评分:', e.message);
      return this.analyzeInterviewConversation(conversationData);
    }
  }

  // 分析面试对话记录
  analyzeInterviewConversation(conversationData) {
    let safeConversation;
    try { safeConversation = JSON.parse(JSON.stringify(conversationData || {})); } catch (e) { safeConversation = conversationData || {}; }
    const debugEnabled = this.isDebugEnabled();
    const debugSessionId = ++this._debugSessionCounter;
    if (debugEnabled) {
      this.debugGroup(`🧮 InterviewScoring 调试会话 #${debugSessionId}`);
      this.debugLog('[0] 原始输入:', safeConversation);
    }
    const questions = Array.isArray(conversationData?.questions)
      ? conversationData.questions.map(q => this.normalizeText(q))
      : [];
    const candidateAnswers = Array.isArray(conversationData?.candidateAnswers)
      ? conversationData.candidateAnswers.map(a => this.normalizeText(a))
      : [];
    if (debugEnabled) {
      this.debugGroup('[1] 输入规范化');
      this.debugLog('questions:', questions);
      this.debugLog('candidateAnswers:', candidateAnswers);
      this.debugGroupEnd();
    }
    const normalizedConversationData = { questions, candidateAnswers };
    const analysis = {
      totalScore: 0,
      categoryScores: {},
      detailedAnalysis: {},
      recommendations: [],
      conversationSummary: '',
      strengths: [],
      weaknesses: [],
      timestamp: new Date().toISOString()
    };
    // 分析IQ/EQ/AQ/MQ四维度
    analysis.categoryScores.iq = this.analyzeDimension('iq', normalizedConversationData, 0);
    analysis.categoryScores.eq = this.analyzeDimension('eq', normalizedConversationData, 3);
    analysis.categoryScores.aq = this.analyzeDimension('aq', normalizedConversationData, 6);
    analysis.categoryScores.mq = this.analyzeDimension('mq', normalizedConversationData, 9);
    if (debugEnabled) {
      this.debugGroup('[3] 各维度得分');
      this.debugLog('iq:', analysis.categoryScores.iq);
      this.debugLog('eq:', analysis.categoryScores.eq);
      this.debugLog('aq:', analysis.categoryScores.aq);
      this.debugLog('mq:', analysis.categoryScores.mq);
      this.debugGroupEnd();
    }
    analysis.totalScore = this.calculateTotalScore(analysis.categoryScores);
    if (debugEnabled) {
      this.debugLog('[4] totalScore:', analysis.totalScore);
    }
    analysis.detailedAnalysis = this.generateDetailedAnalysis(analysis.categoryScores);
    analysis.recommendations = this.generateRecommendations(analysis.categoryScores);
    analysis.conversationSummary = this.generateConversationSummary(normalizedConversationData);
    analysis.strengths = this.identifyStrengths(analysis.categoryScores);
    analysis.weaknesses = this.identifyWeaknesses(analysis.categoryScores);

    // P0改进：从实时评分数据计算8维度平均分
    const evaluationScores = this.calculateEvaluationScoresFromSession(conversationData);
    if (Object.keys(evaluationScores).length > 0) {
      analysis.evaluationScores = evaluationScores;
    }

    if (debugEnabled) {
      this.debugGroup('[5] 结果');
      this.debugLog('detailedAnalysis:', analysis.detailedAnalysis);
      this.debugLog('recommendations:', analysis.recommendations);
      this.debugLog('strengths:', analysis.strengths);
      this.debugLog('weaknesses:', analysis.weaknesses);
      this.debugLog('evaluationScores:', analysis.evaluationScores);
      this.debugGroupEnd();
      this.debugGroupEnd();
    }
    return analysis;
  }

  /**
   * P0改进：从会话数据中计算8维度平均分
   */
  calculateEvaluationScoresFromSession(conversationData) {
    const candidateAnswers = conversationData?.candidateAnswers || [];
    const evaluationScores = {};
    const dimensions = ['relevance', 'depth', 'clarity', 'professionalism', 'evidence', 'actionability', 'selfAwareness', 'growthMindset'];

    dimensions.forEach(dim => {
      const validScores = candidateAnswers
        .filter(a => a?.realTimeScore?.[dim] !== null && a?.realTimeScore?.[dim] !== undefined)
        .map(a => a.realTimeScore[dim]);

      if (validScores.length > 0) {
        evaluationScores[dim] = Math.round(validScores.reduce((sum, s) => sum + s, 0) / validScores.length);
      }
    });

    return evaluationScores;
  }

  // 分析单个维度（IQ/EQ/AQ/MQ），每维度3题各10分，startIndex指定该维度对应的答案起始索引
  analyzeDimension(dimension, conversationData, startIndex = 0) {
    const criteria = this.scoringCriteria[dimension].criteria;
    const criteriaKeys = Object.keys(criteria);
    const dimKeywords = this.keywordScoring[dimension]; // 保留旧版兼容
    const enhancedKeywords = this.enhancedKeywordScoring?.[dimension]; // P0改进：新版智能评分
    const details = {};
    let totalRaw = 0;
    const answers = conversationData.candidateAnswers || [];
    const questions = conversationData.questions || [];

    criteriaKeys.forEach((key, idx) => {
      const answer = this.normalizeText(answers[startIndex + idx] || '');
      const question = criteria[key].question;
      let score = 5;

      // 回答长度评分
      const len = answer.length;
      if (len < 10) score -= 3;
      else if (len < 30) score -= 1;
      else if (len > 100) score += 1;
      else if (len > 200) score += 2;

      // P0改进：关键词评分 - 优先使用新版智能评分
      let kwScore = 0;
      let foundKw = [];

      if (enhancedKeywords) {
        // 使用新的智能关键词评分（三级权重 + 上下文判断 + 否定词识别）
        const smartResult = this.smartKeywordScoring(answer, dimension);
        kwScore = smartResult.totalScore;
        foundKw = smartResult.details;
      } else if (dimKeywords) {
        // 降级到旧版评分（兼容性保障）
        ['positive', 'negative'].forEach(polarity => {
          const rule = dimKeywords[polarity];
          if (!rule) return;
          rule.keywords.forEach(kw => {
            const regex = new RegExp(kw, 'g');
            const matches = answer.match(regex);
            if (matches) {
              const s = rule.score * Math.min(matches.length, 2);
              kwScore += s;
              foundKw.push({ keyword: kw, polarity, count: matches.length, score: s });
            }
          });
        });
      }

      score += Math.min(Math.max(kwScore, -3), 3);

      // 相关性评分
      const relScore = this.analyzeRelevance(answer, question);
      score += Math.min(relScore.score, 2);

      // 结构化评分
      if (this.analyzeStructure(answer).hasStructure) score += 1;

      const finalScore = Math.min(Math.max(Math.round(score), 0), 10);
      details[key] = { score: finalScore, answer, question: criteria[key].description, keywords: foundKw };
      totalRaw += finalScore;
    });

    const rawScore = criteriaKeys.length > 0 ? totalRaw / criteriaKeys.length : 0;
    const weight = this.scoringCriteria[dimension].weight;
    const points = (rawScore / 10) * weight;

    return { rawScore: Math.round(rawScore * 10) / 10, score: Math.round(points * 10) / 10, details, totalRaw };
  }

  // 评估单个回答 - 满分10分（兼容旧调用）
  evaluateSingleAnswer(answer, question) {
    let score = 5;
    const details = {};
    const safeAnswer = this.normalizeText(answer);
    const safeQuestion = this.normalizeText(question);
    const length = safeAnswer.length;
    details.length = length;
    if (length < 10) score -= 3;
    else if (length < 30) score -= 1;
    else if (length > 100) score += 1;
    else if (length > 200) score += 2;
    const keywordScore = this.analyzeKeywords(safeAnswer);
    details.keywords = keywordScore;
    score += Math.min(Math.max(keywordScore.score, -3), 3);
    const relevanceScore = this.analyzeRelevance(safeAnswer, safeQuestion);
    details.relevance = relevanceScore;
    score += Math.min(relevanceScore.score, 2);
    const structureScore = this.analyzeStructure(safeAnswer);
    details.structure = structureScore;
    if (structureScore.hasStructure) score += 1;
    const finalScore = Math.min(Math.max(Math.round(score), 0), 10);
    return { score: finalScore, details };
  }

  analyzeStructure(text) {
    const safeText = this.normalizeText(text);
    const indicators = {
      hasNumbering: /^[一二三四五六七八九十1-9]/m.test(safeText) || /[首先其次然后最后]/.test(safeText),
      hasLogic: /因为.*所以|如果.*那么|虽然.*但是/.test(safeText),
      hasSummary: /总之|综上所述|总结/.test(safeText)
    };
    return { hasStructure: indicators.hasNumbering || indicators.hasLogic, details: indicators };
  }

  analyzeKeywords(text) {
    const safeText = this.normalizeText(text);
    let score = 0;
    const foundKeywords = [];
    ['iq', 'eq', 'aq', 'mq'].forEach(dim => {
      const dimKw = this.keywordScoring[dim];
      if (!dimKw) return;
      ['positive', 'negative'].forEach(polarity => {
        const rule = dimKw[polarity];
        if (!rule) return;
        rule.keywords.forEach(keyword => {
          const regex = new RegExp(keyword, 'g');
          const matches = safeText.match(regex);
          if (matches) {
            const count = matches.length;
            const s = rule.score * Math.min(count, 2);
            score += s;
            foundKeywords.push({ keyword, category: `${dim}.${polarity}`, count, score: s });
          }
        });
      });
    });
    return { score, foundKeywords };
  }

  analyzeRelevance(answer, question) {
    const questionKeywords = this.extractKeywords(question);
    const answerKeywords = this.extractKeywords(answer);
    let matchCount = 0;
    questionKeywords.forEach(qKw => {
      if (answerKeywords.some(aKw => aKw.includes(qKw) || qKw.includes(aKw))) matchCount++;
    });
    const relevanceScore = (matchCount / Math.max(questionKeywords.length, 1)) * 5;
    return { score: relevanceScore, matchCount, totalKeywords: questionKeywords.length };
  }

  extractKeywords(text) {
    const stopWords = ['的', '了', '在', '是', '我', '你', '他', '她', '它', '们', '这', '那', '有', '和', '与', '或', '但', '因为', '所以', '如果', '虽然', '但是'];
    const safeText = this.normalizeText(text);
    if (!safeText.trim()) return [];
    return safeText.split(/[，。！？；：\s]+/).filter(word => word.length > 1 && !stopWords.includes(word)).slice(0, 10);
  }

  // 计算总分（IQ+EQ+AQ+MQ，满分100分）
  calculateTotalScore(categoryScores) {
    let totalScore = 0;
    Object.keys(categoryScores).forEach(category => {
      if (!this.scoringCriteria[category]) return;
      const points = Number(categoryScores?.[category]?.score || 0);
      totalScore += points;
    });
    return Math.min(Math.max(Number(totalScore.toFixed(1)), 0), 100);
  }

  generateDetailedAnalysis(categoryScores) {
    const analysis = {};
    Object.keys(categoryScores).forEach(category => {
      if (!this.scoringCriteria[category] || !categoryScores[category]) return;
      const score = categoryScores[category].score;
      const maxScore = this.scoringCriteria[category].weight;
      const percentage = (score / maxScore) * 100;
      analysis[category] = { score, maxScore, percentage: Math.round(percentage), level: this.getScoreLevel(percentage) };
    });
    return analysis;
  }

  getScoreLevel(percentage) {
    if (percentage >= 90) return '优秀';
    if (percentage >= 80) return '良好';
    if (percentage >= 70) return '中等';
    if (percentage >= 60) return '及格';
    return '待提升';
  }

  generateRecommendations(categoryScores) {
    const recommendations = [];
    Object.keys(categoryScores).forEach(category => {
      if (!this.scoringCriteria[category] || !categoryScores[category]) return;
      const score = categoryScores[category].score;
      const maxScore = this.scoringCriteria[category].weight;
      const percentage = (score / maxScore) * 100;
      if (percentage < 60) {
        recommendations.push({
          category,
          issue: this.getCategoryIssue(category),
          suggestion: this.getCategorySuggestion(category),
          priority: percentage < 40 ? '高' : '中'
        });
      }
    });
    return recommendations;
  }

  getCategoryIssue(category) {
    const issues = {
      iq: '智商维度表现不足，专业知识深度和经验真实性有待验证',
      eq: '情商维度表现不足，情绪管理与同理心有待提升',
      aq: '逆商维度表现不足，抗压能力与复原力有待加强',
      mq: '德商维度表现不足，职业操守与原则性需要关注'
    };
    return issues[category] || '需要改进';
  }

  getCategorySuggestion(category) {
    const suggestions = {
      iq: '建议进一步验证专业知识的深度和项目经验的真实性',
      eq: '建议加强情绪觉察训练，学习换位思考和积极倾听技巧',
      aq: '建议培养成长型思维，学习压力管理和问题重构方法',
      mq: '建议明确个人职业价值观，在决策中纳入伦理和长期影响考量'
    };
    return suggestions[category] || '建议进一步改进';
  }

  generateConversationSummary(conversationData) {
    const totalQuestions = conversationData.questions.length;
    const totalAnswers = conversationData.candidateAnswers.length;
    const avgLen = this.calculateAverageAnswerLength(conversationData.candidateAnswers);
    return `本次面试共进行${totalQuestions}个问题（IQ/EQ/AQ/MQ四维度），候选人回答了${totalAnswers}个问题，平均回答长度${avgLen}字。`;
  }

  calculateAverageAnswerLength(answers) {
    if (!answers || answers.length === 0) return 0;
    const totalLength = answers.reduce((sum, answer) => sum + this.normalizeText(answer).length, 0);
    return Math.round(totalLength / answers.length);
  }

  identifyStrengths(categoryScores) {
    const strengths = [];
    Object.keys(categoryScores).forEach(category => {
      if (!this.scoringCriteria[category] || !categoryScores[category]) return;
      const score = categoryScores[category].score;
      const maxScore = this.scoringCriteria[category].weight;
      const percentage = (score / maxScore) * 100;
      if (percentage >= 80) {
        strengths.push({ category, description: this.getCategoryStrength(category), score: percentage });
      }
    });
    return strengths;
  }

  identifyWeaknesses(categoryScores) {
    const weaknesses = [];
    Object.keys(categoryScores).forEach(category => {
      if (!this.scoringCriteria[category] || !categoryScores[category]) return;
      const score = categoryScores[category].score;
      const maxScore = this.scoringCriteria[category].weight;
      const percentage = (score / maxScore) * 100;
      if (percentage < 60) {
        weaknesses.push({ category, description: this.getCategoryWeakness(category), score: percentage });
      }
    });
    return weaknesses;
  }

  getCategoryStrength(category) {
    const strengths = {
      iq: '智商优秀，专业知识扎实，经验真实可信，与岗位高度匹配',
      eq: '情商优秀，善于情绪管理和换位思考',
      aq: '逆商优秀，抗压能力强，善于从挫折中学习',
      mq: '德商优秀，职业操守坚定，具有强烈责任感'
    };
    return strengths[category] || '表现优秀';
  }

  getCategoryWeakness(category) {
    const weaknesses = {
      iq: '智商有待提升，专业知识深度不足，经验真实性存疑',
      eq: '情商有待提升，需加强情绪觉察和同理心',
      aq: '逆商有待提升，需增强抗压能力和复原力',
      mq: '德商有待提升，需关注职业操守和原则性'
    };
    return weaknesses[category] || '需要改进';
  }

  // ========================================
  // P0改进：新增维度规则评分方法（AI评分失败时的备选方案）
  // ========================================

  /**
   * 分析新增维度的规则评分
   * @param {string} answer - 候选人回答文本
   * @param {string} question - 面试问题
   * @returns {object} 各新维度评分
   */
  analyzeNewDimensions(answer, question) {
    const safeAnswer = this.normalizeText(answer);
    const result = {};

    result.evidence = this.analyzeEvidence(safeAnswer);
    result.actionability = this.analyzeActionability(safeAnswer);
    result.selfAwareness = this.analyzeSelfAwareness(safeAnswer);
    result.growthMindset = this.analyzeGrowthMindset(safeAnswer);

    return result;
  }

  /**
   * 证据性分析：检测回答中是否有具体数据、案例、成果支撑
   */
  analyzeEvidence(text) {
    let score = 5; // 基础分

    // 检测量化数据（如：30%、5万、3个项目、2次优化）
    const numberPattern = /\d+(\.\d+)?\s*(%|万|千|个|次|年|月|人|倍|分)/g;
    const numbers = text.match(numberPattern) || [];
    if (numbers.length >= 3) score += 2;
    else if (numbers.length >= 1) score += 1;

    // 检测案例佐证
    const caseKeywords = ['案例', '例子', '比如', '例如', '具体是', '有一次', '举个例子', '是这样的'];
    const hasCase = caseKeywords.some(kw => text.includes(kw));
    if (hasCase) score += 1;

    // 检测成果描述
    const resultKeywords = ['成果', '效果', '结果', '达成', '完成', '实现', '产出'];
    const hasResult = resultKeywords.some(kw => text.includes(kw));
    if (hasResult) score += 1;

    // 检测缺乏证据的模糊描述（扣分）
    const vagueKeywords = ['大概', '好像', '可能', '很多', '一些', '比较大的', '显著的'];
    const vagueCount = vagueKeywords.filter(kw => text.includes(kw)).length;
    if (vagueCount >= 2) score -= 1;

    return Math.min(Math.max(Math.round(score), 0), 10);
  }

  /**
   * 可执行性分析：检测方案是否具体可落地
   */
  analyzeActionability(text) {
    let score = 5;

    // 检测步骤性描述
    const stepKeywords = ['第一步', '第二步', '第三步', '首先', '其次', '然后', '最后'];
    const stepCount = stepKeywords.filter(kw => text.includes(kw)).length;
    if (stepCount >= 3) score += 2;
    else if (stepCount >= 1) score += 1;

    // 检测计划性描述
    const planKeywords = ['计划', '安排', '时间', '节点', '阶段', '排期', '里程碑'];
    const hasPlan = planKeywords.some(kw => text.includes(kw));
    if (hasPlan) score += 1;

    // 检测具体行动词
    const actionKeywords = ['具体', '实施', '执行', '落实', '推进', '推动', '驱动'];
    const hasAction = actionKeywords.some(kw => text.includes(kw));
    if (hasAction) score += 1;

    // 检测模糊推诿词（扣分）
    const vagueActionKeywords = ['看情况', '再说', '到时候', '尽量', '争取', '看领导', '等通知'];
    const hasVague = vagueActionKeywords.some(kw => text.includes(kw));
    if (hasVague) score -= 1;

    return Math.min(Math.max(Math.round(score), 0), 10);
  }

  /**
   * 自我认知分析：检测是否坦诚面对优劣势
   */
  analyzeSelfAwareness(text) {
    let score = 5;

    // 检测自我反思
    const reflectionKeywords = ['我的不足', '我需要改进', '我意识到', '我欠缺', '我缺乏', '我的短板'];
    const hasReflection = reflectionKeywords.some(kw => text.includes(kw));
    if (hasReflection) score += 2;

    // 检测优劣势分析
    const analysisKeywords = ['我的优势', '我的劣势', '我擅长', '我不擅长', '我的强项', '我的弱项'];
    const hasAnalysis = analysisKeywords.some(kw => text.includes(kw));
    if (hasAnalysis) score += 1;

    // 检测改进计划
    const planKeywords = ['正在学习', '计划提升', '加强训练', '报名了', '在学习'];
    const hasPlan = planKeywords.some(kw => text.includes(kw));
    if (hasPlan) score += 1;

    // 检测过度自信（扣分）
    const overconfidentKeywords = ['我没什么缺点', '我都很擅长', '这个问题不存在', '我什么都行', '我不需要改进'];
    const isOverconfident = overconfidentKeywords.some(kw => text.includes(kw));
    if (isOverconfident) score -= 2;

    return Math.min(Math.max(Math.round(score), 0), 10);
  }

  /**
   * 成长思维分析：检测是否展现从失败中学习、持续改进的心态
   */
  analyzeGrowthMindset(text) {
    let score = 5;

    // 检测学习心态
    const learningKeywords = ['我学到了', '从中学到', '这让我成长', '收获很大', '受益匪浅'];
    const hasLearning = learningKeywords.some(kw => text.includes(kw));
    if (hasLearning) score += 2;

    // 检测改进意识
    const improveKeywords = ['下次我会', '以后我会', '我会改进', '持续优化', '不断完善'];
    const hasImprove = improveKeywords.some(kw => text.includes(kw));
    if (hasImprove) score += 1;

    // 检测失败反思
    const failureKeywords = ['失败后', '挫折让我', '困难使我', '挑战让我', '逆境中'];
    const hasFailureReflection = failureKeywords.some(kw => text.includes(kw));
    if (hasFailureReflection) score += 1;

    // 检测固定型思维（扣分）
    const fixedKeywords = ['这不是我的问题', '运气不好', '环境不允许', '无法改变', '天生就这样', '别人的问题'];
    const hasFixed = fixedKeywords.some(kw => text.includes(kw));
    if (hasFixed) score -= 2;

    return Math.min(Math.max(Math.round(score), 0), 10);
  }

  // ========================================
  // P1改进：负面回答识别机制
  // ========================================

  /**
   * 综合检测负面回答
   * @param {string} answer - 候选人回答
   * @param {string} question - 面试问题
   * @param {Array} previousAnswers - 之前的回答列表（用于矛盾检测）
   * @returns {object} 检测结果
   */
  detectNegativeAnswer(answer, question, previousAnswers = []) {
    const results = [];

    // 1. 检测套话回答
    const clicheResult = this.detectClicheAnswer(answer);
    if (clicheResult.detected) {
      results.push({
        type: 'cliche',
        severity: clicheResult.severity,
        description: '检测到套话回答',
        details: clicheResult.details,
        suggestion: '建议追问具体案例'
      });
    }

    // 2. 检测回避性回答
    const evasiveResult = this.detectEvasiveAnswer(answer, question);
    if (evasiveResult.detected) {
      results.push({
        type: 'evasive',
        severity: evasiveResult.severity,
        description: '检测到回避性回答',
        details: evasiveResult.details,
        suggestion: '建议重新提问或追问细节'
      });
    }

    // 3. 检测过度包装
    const packagingResult = this.detectOverPackaging(answer);
    if (packagingResult.detected) {
      results.push({
        type: 'overPackaging',
        severity: packagingResult.severity,
        description: '检测到可能的过度包装',
        details: packagingResult.details,
        suggestion: '建议追问验证细节'
      });
    }

    // 4. 检测矛盾回答
    if (previousAnswers.length > 0) {
      const contradictionResult = this.detectContradiction(answer, previousAnswers);
      if (contradictionResult.detected) {
        results.push({
          type: 'contradiction',
          severity: contradictionResult.severity,
          description: '检测到前后矛盾',
          details: contradictionResult.details,
          suggestion: '建议核实矛盾点'
        });
      }
    }

    // 5. 检测准备痕迹
    const preparationResult = this.detectPreparationTraces(answer);
    if (preparationResult.detected) {
      results.push({
        type: 'preparation',
        severity: preparationResult.severity,
        description: '检测到准备痕迹过重',
        details: preparationResult.details,
        suggestion: '建议使用情境追问验证真实性'
      });
    }

    return {
      hasNegativeIndicators: results.length > 0,
      overallSeverity: this.calculateOverallSeverity(results),
      indicators: results
    };
  }

  /**
   * 检测套话回答
   */
  detectClicheAnswer(answer) {
    const clichePhrases = [
      '性格开朗', '善于沟通', '工作认真', '责任心强', '团队精神',
      '学习能力', '积极向上', '吃苦耐劳', '踏实肯干', '有亲和力',
      '执行力强', '抗压能力强', '善于总结', '逻辑清晰', '思维敏捷',
      '做事细心', '有耐心', '热爱学习', '勤奋努力', '认真负责'
    ];

    const matches = [];
    let clicheCount = 0;

    clichePhrases.forEach(phrase => {
      if (answer.includes(phrase)) {
        clicheCount++;
        matches.push(phrase);
      }
    });

    // 套话密度计算
    const answerLength = answer.length;
    const clicheDensity = clicheCount / Math.max(answerLength / 50, 1);

    // 判断严重程度
    let severity = 'none';
    if (clicheCount >= 3 && clicheDensity > 0.3) {
      severity = 'high';
    } else if (clicheCount >= 2 && clicheDensity > 0.2) {
      severity = 'medium';
    } else if (clicheCount >= 1) {
      severity = 'low';
    }

    return {
      detected: clicheCount >= 2,
      severity,
      details: {
        clicheCount,
        matchedPhrases: matches,
        clicheDensity: clicheDensity.toFixed(2)
      }
    };
  }

  /**
   * 检测回避性回答
   */
  detectEvasiveAnswer(answer, question) {
    // 提取问题关键词
    const questionKeywords = this.extractKeywords(question);

    // 检查回答中是否包含问题关键词
    let keywordMatchCount = 0;
    const matchedKeywords = [];
    const missingKeywords = [];

    questionKeywords.forEach(kw => {
      if (answer.includes(kw)) {
        keywordMatchCount++;
        matchedKeywords.push(kw);
      } else {
        missingKeywords.push(kw);
      }
    });

    // 检测回避性词汇
    const evasivePhrases = [
      '这个情况比较复杂', '涉及到很多因素', '不太好说', '因人而异',
      '看具体情况', '很难一概而论', '需要具体分析', '取决于',
      '这个嘛', '怎么说呢', '其实吧'
    ];
    const evasiveMatches = evasivePhrases.filter(phrase => answer.includes(phrase));

    // 计算回避指数
    const keywordMatchRate = questionKeywords.length > 0 ? keywordMatchCount / questionKeywords.length : 0;
    const evasiveScore = evasiveMatches.length * 0.3;
    const avoidanceIndex = (1 - keywordMatchRate) + evasiveScore;

    // 判断严重程度
    let severity = 'none';
    if (avoidanceIndex > 0.7) {
      severity = 'high';
    } else if (avoidanceIndex > 0.5) {
      severity = 'medium';
    } else if (avoidanceIndex > 0.3) {
      severity = 'low';
    }

    return {
      detected: avoidanceIndex > 0.5,
      severity,
      details: {
        keywordMatchRate: (keywordMatchRate * 100).toFixed(0) + '%',
        matchedKeywords,
        missingKeywords,
        evasivePhrases: evasiveMatches,
        avoidanceIndex: avoidanceIndex.toFixed(2)
      }
    };
  }

  /**
   * 检测过度包装
   */
  detectOverPackaging(answer) {
    // 统计强声明词汇
    const strongClaims = [];
    const strongClaimWords = ['主导', '负责', '核心', '关键', '唯一', '首创', '独立', '完全'];
    strongClaimWords.forEach(word => {
      const regex = new RegExp(word, 'g');
      const matches = answer.match(regex);
      if (matches) {
        strongClaims.push({ word, count: matches.length });
      }
    });

    // 统计完美结果词汇
    const perfectOutcomes = [];
    const perfectOutcomeWords = ['完美', '零缺陷', '100%', '全部', '完全', '没有任何问题'];
    perfectOutcomeWords.forEach(word => {
      if (answer.includes(word)) {
        perfectOutcomes.push(word);
      }
    });

    // 检测是否缺乏失败描述
    const lackOfFailurePhrases = ['没有遇到什么困难', '一切顺利', '没有失败', '很顺利', '没什么问题'];
    const hasNoFailure = lackOfFailurePhrases.some(phrase => answer.includes(phrase));

    // 计算包装指数
    const strongClaimScore = strongClaims.reduce((sum, item) => sum + item.count * 2, 0);
    const perfectScore = perfectOutcomes.length * 3;
    const noFailureScore = hasNoFailure ? 5 : 0;
    const packagingIndex = strongClaimScore + perfectScore + noFailureScore;

    // 判断严重程度
    let severity = 'none';
    if (packagingIndex > 15) {
      severity = 'high';
    } else if (packagingIndex > 10) {
      severity = 'medium';
    } else if (packagingIndex > 5) {
      severity = 'low';
    }

    return {
      detected: packagingIndex > 10,
      severity,
      details: {
        strongClaims,
        perfectOutcomes,
        hasNoFailure,
        packagingIndex
      }
    };
  }

  /**
   * 检测矛盾回答
   */
  detectContradiction(currentAnswer, previousAnswers) {
    // 提取当前回答中的关键声明
    const currentClaims = this.extractClaims(currentAnswer);
    const contradictions = [];

    // 与之前的回答对比
    previousAnswers.forEach((prevAnswer, index) => {
      const prevClaims = this.extractClaims(prevAnswer.answer || prevAnswer);

      // 检查角色声明矛盾
      const roleContradictions = this.checkRoleContradiction(currentClaims, prevClaims);
      if (roleContradictions) {
        contradictions.push({
          questionIndex: index,
          type: 'role',
          details: roleContradictions
        });
      }
    });

    // 判断严重程度
    let severity = 'none';
    if (contradictions.length >= 2) {
      severity = 'high';
    } else if (contradictions.length === 1) {
      severity = 'medium';
    }

    return {
      detected: contradictions.length > 0,
      severity,
      details: {
        contradictionCount: contradictions.length,
        contradictions
      }
    };
  }

  /**
   * 检测准备痕迹
   */
  detectPreparationTraces(answer) {
    // 检测完美结构
    let structureScore = 0;
    const structureMatches = [];
    const structureWords = ['首先', '其次', '再次', '最后', '第一', '第二', '第三', '总之', '综上所述'];
    structureWords.forEach(word => {
      if (answer.includes(word)) {
        structureScore++;
        structureMatches.push(word);
      }
    });

    // 检测标准话术
    let phraseScore = 0;
    const phraseMatches = [];
    const standardPhrases = [
      '我认为这个问题可以从以下几个方面来回答',
      '综上所述，我的观点是',
      '这是一个很好的问题',
      '感谢您的提问',
      '关于这个问题，我想从三个角度来阐述'
    ];
    standardPhrases.forEach(phrase => {
      if (answer.includes(phrase)) {
        phraseScore++;
        phraseMatches.push(phrase);
      }
    });

    // 计算准备痕迹指数
    const preparationIndex = structureScore * 2 + phraseScore * 3;

    // 判断严重程度
    let severity = 'none';
    if (preparationIndex > 10) {
      severity = 'high';
    } else if (preparationIndex > 5) {
      severity = 'medium';
    } else if (preparationIndex > 2) {
      severity = 'low';
    }

    return {
      detected: preparationIndex > 5,
      severity,
      details: {
        structureMatches,
        phraseMatches,
        preparationIndex
      }
    };
  }

  /**
   * 计算总体严重程度
   */
  calculateOverallSeverity(indicators) {
    if (indicators.length === 0) return 'none';

    const highCount = indicators.filter(i => i.severity === 'high').length;
    const mediumCount = indicators.filter(i => i.severity === 'medium').length;

    if (highCount >= 1) return 'high';
    if (mediumCount >= 2) return 'high';
    if (mediumCount >= 1) return 'medium';
    return 'low';
  }

  /**
   * 提取关键词
   */
  extractKeywords(text) {
    const stopWords = ['的', '了', '在', '是', '我', '你', '他', '她', '它', '们', '这', '那', '有', '和', '与', '或', '但', '因为', '所以', '如果', '虽然', '但是', '请', '描述', '介绍', '说说', '谈谈', '如何', '怎样', '什么', '为什么'];
    return (text || '').split(/[，。！？；：\s]+/)
      .filter(word => word.length > 1 && !stopWords.includes(word))
      .slice(0, 10);
  }

  /**
   * 提取声明
   */
  extractClaims(text) {
    const claims = {
      roles: [],
      numbers: [],
      outcomes: []
    };

    // 提取角色声明
    const rolePatterns = ['主导', '负责', '参与', '协助', '独立完成'];
    rolePatterns.forEach(pattern => {
      if (text.includes(pattern)) {
        claims.roles.push(pattern);
      }
    });

    // 提取数字声明
    const numberPattern = /\d+(\.\d+)?(%|万|个|次|年|月|人)?/g;
    const numbers = text.match(numberPattern) || [];
    claims.numbers = numbers;

    return claims;
  }

  /**
   * 检查角色矛盾
   */
  checkRoleContradiction(currentClaims, previousClaims) {
    const currentRoles = currentClaims.roles;
    const previousRoles = previousClaims.roles;

    // 检查角色降级
    if (currentRoles.includes('参与') && previousRoles.includes('主导')) {
      return {
        type: 'role_downgrade',
        previous: '主导',
        current: '参与',
        description: '角色定位前后矛盾：之前声称主导，现在说是参与'
      };
    }

    return null;
  }

  // ========================================
  // P0改进：智能关键词评分方法
  // ========================================

  /**
   * 检查关键词是否被否定词修饰
   * @param {string} text - 原始文本
   * @param {number} keywordIndex - 关键词在文本中的位置
   * @param {number} windowSize - 上下文窗口大小（前后几个字符）
   * @returns {object} { isNegated: boolean, negationWord: string|null }
   */
  isKeywordNegated(text, keywordIndex, windowSize = 6) {
    // 获取关键词前 windowSize 个字符的上下文
    const contextStart = Math.max(0, keywordIndex - windowSize);
    const context = text.substring(contextStart, keywordIndex);

    // 检查是否存在否定词
    for (const negWord of this.negationWords) {
      if (context.includes(negWord)) {
        // 进一步检查：否定词和关键词之间是否有其他否定词（双重否定）
        const negIndex = context.lastIndexOf(negWord);
        const subContext = context.substring(negIndex + negWord.length);

        // 如果中间有其他否定词，可能是双重否定
        const hasDoubleNegation = this.negationWords.some(nw => subContext.includes(nw));
        if (hasDoubleNegation) {
          return { isNegated: false, negationWord: null, isDoubleNegation: true };
        }

        return { isNegated: true, negationWord: negWord };
      }
    }

    return { isNegated: false, negationWord: null };
  }

  /**
   * 智能关键词评分（三级权重 + 上下文判断 + 否定词识别）
   * @param {string} text - 回答文本
   * @param {string} dimension - 维度（iq/eq/aq/mq）
   * @returns {object} { totalScore, details }
   */
  smartKeywordScoring(text, dimension) {
    const rules = this.enhancedKeywordScoring?.[dimension];
    if (!rules) return { totalScore: 0, details: [] };

    let totalScore = 0;
    const details = [];

    // 遍历正向和负向关键词
    ['positive', 'negative'].forEach(polarity => {
      const polarityRules = rules[polarity];
      if (!polarityRules) return;

      // 遍历三个权重级别
      ['strong', 'medium', 'weak'].forEach(weight => {
        const weightRule = polarityRules[weight];
        if (!weightRule || !weightRule.keywords) return;

        weightRule.keywords.forEach(keyword => {
          // 查找所有匹配位置
          let startIndex = 0;
          while (true) {
            const index = text.indexOf(keyword, startIndex);
            if (index === -1) break;

            // 检查是否被否定
            const negationResult = this.isKeywordNegated(text, index);

            if (negationResult.isNegated) {
              // 被否定的情况
              if (polarity === 'negative') {
                // 负向关键词被否定 = 正面（如"不会放弃"）
                totalScore += Math.abs(weightRule.score);
                details.push({
                  keyword,
                  polarity,
                  weight,
                  originalScore: weightRule.score,
                  actualScore: Math.abs(weightRule.score),
                  negated: true,
                  negationWord: negationResult.negationWord,
                  interpretation: '负向词被否定，转为正面',
                  context: text.substring(Math.max(0, index - 10), index + keyword.length + 5)
                });
              } else {
                // 正向关键词被否定 = 负面（如"不会坚持"）
                totalScore -= Math.abs(weightRule.score);
                details.push({
                  keyword,
                  polarity,
                  weight,
                  originalScore: weightRule.score,
                  actualScore: -Math.abs(weightRule.score),
                  negated: true,
                  negationWord: negationResult.negationWord,
                  interpretation: '正向词被否定，转为负面',
                  context: text.substring(Math.max(0, index - 10), index + keyword.length + 5)
                });
              }
            } else {
              // 未被否定：正常计分
              totalScore += weightRule.score;
              details.push({
                keyword,
                polarity,
                weight,
                score: weightRule.score,
                negated: false,
                context: text.substring(Math.max(0, index - 10), index + keyword.length + 5)
              });
            }

            startIndex = index + 1;
          }
        });
      });
    });

    // 限制总分范围
    totalScore = Math.max(-5, Math.min(5, totalScore));

    return { totalScore, details };
  }

  // ========================================
  // P2改进：评分置信度计算方法
  // ========================================

  /**
   * 计算评分置信度
   * @param {string} answer - 候选人回答
   * @param {object} aiResponse - AI评分响应（可选）
   * @returns {object} 置信度结果
   */
  calculateConfidence(answer, aiResponse = null) {
    const safeAnswer = this.normalizeText(answer);

    // 1. 回答长度置信度（权重30%）
    const lengthConfidence = this.calculateLengthConfidence(safeAnswer.length);

    // 2. 关键词密度置信度（权重25%）
    const keywordConfidence = this.calculateKeywordConfidence(safeAnswer);

    // 3. 结构完整度置信度（权重25%）
    const structureConfidence = this.calculateStructureConfidence(safeAnswer);

    // 4. AI模型确定性（权重20%）
    const aiConfidence = aiResponse?.confidence || 0.7;

    // 综合置信度
    const overallConfidence =
      lengthConfidence * 0.30 +
      keywordConfidence * 0.25 +
      structureConfidence * 0.25 +
      aiConfidence * 0.20;

    const level = this.getConfidenceLevel(overallConfidence);

    return {
      overall: Math.round(overallConfidence * 100) / 100,
      level: level.level,
      label: level.label,
      color: level.color,
      needsReview: level.needsReview || false,
      breakdown: {
        length: Math.round(lengthConfidence * 100) / 100,
        keyword: Math.round(keywordConfidence * 100) / 100,
        structure: Math.round(structureConfidence * 100) / 100,
        ai: Math.round(aiConfidence * 100) / 100
      }
    };
  }

  /**
   * 计算回答长度置信度
   */
  calculateLengthConfidence(length) {
    if (length >= 200) return 0.95;
    if (length >= 150) return 0.85;
    if (length >= 100) return 0.75;
    if (length >= 50) return 0.55;
    if (length >= 30) return 0.40;
    return 0.25;
  }

  /**
   * 计算关键词密度置信度
   */
  calculateKeywordConfidence(text) {
    // 统计所有维度的关键词
    let totalKeywords = 0;
    const dimensions = ['iq', 'eq', 'aq', 'mq'];

    dimensions.forEach(dim => {
      const rules = this.enhancedKeywordScoring?.[dim];
      if (!rules) return;

      ['positive', 'negative'].forEach(polarity => {
        const polarityRules = rules[polarity];
        if (!polarityRules) return;

        ['strong', 'medium', 'weak'].forEach(weight => {
          const weightRule = polarityRules[weight];
          if (!weightRule || !weightRule.keywords) return;

          weightRule.keywords.forEach(keyword => {
            if (text.includes(keyword)) {
              totalKeywords++;
            }
          });
        });
      });
    });

    // 关键词密度计算
    const density = totalKeywords / Math.max(text.length / 50, 1);

    if (totalKeywords >= 5 && density > 0.3) return 0.95;
    if (totalKeywords >= 3 && density > 0.2) return 0.80;
    if (totalKeywords >= 2) return 0.65;
    if (totalKeywords >= 1) return 0.50;
    return 0.40;
  }

  /**
   * 计算结构完整度置信度
   */
  calculateStructureConfidence(text) {
    let structureScore = 0;

    // 检测编号结构
    const numberingPatterns = [
      /第一[,.，。]/,
      /第二[,.，。]/,
      /第三[,.，。]/,
      /首先[,.，。]/,
      /其次[,.，。]/,
      /然后[,.，。]/,
      /最后[,.，。]/,
      /一是[,.，。]/,
      /二是[,.，。]/,
      /\d+[.、]/
    ];
    const numberingCount = numberingPatterns.filter(p => p.test(text)).length;
    if (numberingCount >= 3) structureScore += 0.4;
    else if (numberingCount >= 2) structureScore += 0.3;
    else if (numberingCount >= 1) structureScore += 0.15;

    // 检测总结句
    const summaryPatterns = [
      /总结[一下来]?/,
      /综上[所述]?/,
      /所以[说]?/,
      /因此[,.，。]/,
      /总[而言之]/
    ];
    if (summaryPatterns.some(p => p.test(text))) {
      structureScore += 0.3;
    }

    // 检测因果逻辑
    const logicPatterns = [
      /因为.+所以/,
      /由于.+导致/,
      /为了.+我/,
      /如果.+就/
    ];
    if (logicPatterns.some(p => p.test(text))) {
      structureScore += 0.2;
    }

    // 检测分点陈述
    if (text.includes('；') || text.split('，').length >= 4) {
      structureScore += 0.1;
    }

    return Math.min(structureScore, 1.0);
  }

  /**
   * 获取置信度等级
   */
  getConfidenceLevel(confidence) {
    if (confidence >= 0.8) {
      return { level: 'high', label: '高置信度', color: '#52c41a' };
    }
    if (confidence >= 0.6) {
      return { level: 'medium', label: '中置信度', color: '#faad14' };
    }
    return { level: 'low', label: '低置信度', color: '#ff4d4f', needsReview: true };
  }

  /**
   * 为整个面试结果计算综合置信度
   */
  calculateInterviewConfidence(conversationData) {
    const answers = conversationData.candidateAnswers || [];
    if (answers.length === 0) {
      return { overall: 0, level: 'low', label: '无数据', needsReview: true };
    }

    const confidences = answers.map(answer => this.calculateConfidence(answer));

    // 计算平均置信度
    const avgConfidence = confidences.reduce((sum, c) => sum + c.overall, 0) / confidences.length;

    // 计算低置信度回答数量
    const lowConfidenceCount = confidences.filter(c => c.level === 'low').length;

    // 如果有超过30%的回答是低置信度，整体置信度降一级
    const adjustedConfidence = lowConfidenceCount / answers.length > 0.3
      ? avgConfidence * 0.8
      : avgConfidence;

    const level = this.getConfidenceLevel(adjustedConfidence);

    return {
      overall: Math.round(adjustedConfidence * 100) / 100,
      level: level.level,
      label: level.label,
      color: level.color,
      needsReview: level.needsReview || false,
      perAnswer: confidences,
      lowConfidenceCount,
      lowConfidenceRate: Math.round(lowConfidenceCount / answers.length * 100)
    };
  }

  // ========================================
  // P2改进：岗位定制化题目库
  // ========================================

  /**
   * 获取岗位定制化题目
   * @param {string} positionName - 岗位名称
   * @param {string} dimension - 维度（iq/eq/aq/mq）
   * @param {number} questionIndex - 题目索引
   * @returns {object|null} 定制题目
   */
  getPositionSpecificQuestion(positionName, dimension, questionIndex) {
    const template = this.matchPositionWeightTemplate(positionName);
    const category = template.category || 'general';

    // 获取该岗位类别的定制题目
    const categoryQuestions = this.positionSpecificQuestions?.[category];
    if (!categoryQuestions || !categoryQuestions[dimension]) {
      return null;
    }

    const questions = categoryQuestions[dimension];
    if (questionIndex >= questions.length) {
      return null;
    }

    return questions[questionIndex];
  }

  /**
   * 岗位定制化题目库
   */
  getPositionQuestionBank(positionName) {
    const template = this.matchPositionWeightTemplate(positionName);
    const category = template.category || 'general';

    return this.positionSpecificQuestions?.[category] || null;
  }

  // ========================================
  // P2改进：录用建议生成方法
  // ========================================

  /**
   * 生成录用建议
   * @param {object} scoringResult - 评分结果
   * @param {Array} negativeIndicators - 负面指标列表
   * @param {object} positionInfo - 岗位信息
   * @returns {object} 录用建议
   */
  generateHiringRecommendation(scoringResult, negativeIndicators = [], positionInfo = null) {
    const { totalScore, categoryScores } = scoringResult;

    // 1. 计算录用等级
    const recommendation = this.determineRecommendationLevel(totalScore, negativeIndicators);

    // 2. 生成推荐理由
    const reasons = this.generateRecommendationReasons(scoringResult, recommendation);

    // 3. 识别风险项
    const risks = this.identifyRisks(scoringResult, negativeIndicators);

    // 4. 生成培养建议
    const developmentSuggestions = this.generateDevelopmentSuggestions(scoringResult);

    // 5. 生成HR追问建议
    const hrFollowUpQuestions = this.generateHRFollowUpQuestions(scoringResult, negativeIndicators);

    // 6. 生成背调重点
    const backgroundCheckPoints = this.generateBackgroundCheckPoints(scoringResult, negativeIndicators);

    return {
      recommendation: recommendation.level,
      recommendationLabel: recommendation.label,
      confidence: recommendation.confidence,
      reasons,
      risks,
      developmentSuggestions,
      hrFollowUpQuestions,
      backgroundCheckPoints,
      suggestedPosition: this.suggestAlternativePosition(scoringResult, positionInfo)
    };
  }

  /**
   * 确定录用等级
   */
  determineRecommendationLevel(totalScore, negativeIndicators) {
    const hasHighRisk = negativeIndicators.some(i => i.severity === 'high');
    const hasMultipleMediumRisk = negativeIndicators.filter(i => i.severity === 'medium').length >= 2;

    if (totalScore >= 85 && !hasHighRisk && !hasMultipleMediumRisk) {
      return { level: 'strongly_recommend', label: '强烈推荐', confidence: 'high' };
    }
    if (totalScore >= 75 && !hasHighRisk) {
      return { level: 'recommend', label: '推荐', confidence: 'medium' };
    }
    if (totalScore >= 60) {
      return { level: 'pending', label: '待定', confidence: 'low' };
    }
    if (totalScore >= 50) {
      return { level: 'not_recommend', label: '不推荐', confidence: 'medium' };
    }
    return { level: 'strongly_not_recommend', label: '强烈不推荐', confidence: 'high' };
  }

  /**
   * 生成推荐理由
   */
  generateRecommendationReasons(scoringResult, recommendation) {
    const reasons = [];
    const { totalScore, categoryScores } = scoringResult;

    // 根据各维度得分生成理由
    if (categoryScores?.iq?.rawScore >= 8) {
      reasons.push({
        type: 'strength',
        dimension: 'IQ',
        text: '专业能力强，技术深度符合岗位要求'
      });
    }
    if (categoryScores?.eq?.rawScore >= 8) {
      reasons.push({
        type: 'strength',
        dimension: 'EQ',
        text: '情商高，沟通协作能力出色'
      });
    }
    if (categoryScores?.aq?.rawScore >= 8) {
      reasons.push({
        type: 'strength',
        dimension: 'AQ',
        text: '逆商高，抗压能力和成长心态良好'
      });
    }
    if (categoryScores?.mq?.rawScore >= 8) {
      reasons.push({
        type: 'strength',
        dimension: 'MQ',
        text: '德商高，职业操守和诚信意识强'
      });
    }

    // 根据总分补充理由
    if (totalScore >= 80) {
      reasons.push({
        type: 'overall',
        text: '综合表现优秀，与岗位匹配度高'
      });
    } else if (totalScore >= 70) {
      reasons.push({
        type: 'overall',
        text: '综合表现良好，基本符合岗位要求'
      });
    }

    // 如果是待定或不推荐，添加关注点
    if (recommendation.level === 'pending' || recommendation.level === 'not_recommend') {
      if (categoryScores?.iq?.rawScore < 6) {
        reasons.push({
          type: 'concern',
          dimension: 'IQ',
          text: '专业能力有待提升，需进一步验证'
        });
      }
      if (categoryScores?.eq?.rawScore < 6) {
        reasons.push({
          type: 'concern',
          dimension: 'EQ',
          text: '沟通协作能力需要关注'
        });
      }
    }

    return reasons;
  }

  /**
   * 识别风险项
   */
  identifyRisks(scoringResult, negativeIndicators) {
    const risks = {
      high: [],
      medium: [],
      low: []
    };
    const { totalScore, categoryScores } = scoringResult;

    // 高风险项
    if (totalScore < 50) {
      risks.high.push({
        type: 'overall_score',
        text: '综合评分过低，可能无法胜任岗位',
        suggestion: '建议谨慎考虑，或安排二面深入评估'
      });
    }

    // 从负面指标中提取风险
    negativeIndicators.forEach(indicator => {
      const risk = {
        type: indicator.type,
        text: indicator.description,
        suggestion: indicator.suggestion
      };

      if (indicator.severity === 'high') {
        risks.high.push(risk);
      } else if (indicator.severity === 'medium') {
        risks.medium.push(risk);
      } else {
        risks.low.push(risk);
      }
    });

    // 维度得分过低的风险
    if (categoryScores?.iq?.rawScore < 5) {
      risks.high.push({
        type: 'iq_low',
        text: '专业能力评分过低',
        suggestion: '建议进行技术笔试或实操考核'
      });
    }
    if (categoryScores?.mq?.rawScore < 5) {
      risks.high.push({
        type: 'mq_low',
        text: '职业操守评分较低',
        suggestion: '建议加强背景调查，重点关注诚信记录'
      });
    }

    // 中风险项
    if (categoryScores?.aq?.rawScore < 6) {
      risks.medium.push({
        type: 'aq_low',
        text: '抗压能力可能不足',
        suggestion: '建议在二面中设置压力测试问题'
      });
    }

    // 低风险项（可在入职后改善）
    if (categoryScores?.eq?.rawScore < 7) {
      risks.low.push({
        type: 'eq_improvable',
        text: '沟通技巧有提升空间',
        suggestion: '入职后可安排沟通技巧培训'
      });
    }

    return risks;
  }

  /**
   * 生成培养建议
   */
  generateDevelopmentSuggestions(scoringResult) {
    const suggestions = [];
    const { categoryScores } = scoringResult;

    // 培训重点
    const trainingFocus = [];
    if (categoryScores?.iq?.rawScore < 7) {
      trainingFocus.push('专业技能深化培训');
    }
    if (categoryScores?.eq?.rawScore < 7) {
      trainingFocus.push('沟通协作技巧培训');
    }
    if (categoryScores?.aq?.rawScore < 7) {
      trainingFocus.push('压力管理与情绪调节培训');
    }

    if (trainingFocus.length > 0) {
      suggestions.push({
        type: 'training',
        label: '入职培训重点',
        items: trainingFocus
      });
    }

    // 导师建议
    let mentorType = '综合型导师';
    if (categoryScores?.iq?.rawScore < 6) {
      mentorType = '技术型导师';
    } else if (categoryScores?.eq?.rawScore < 6) {
      mentorType = '管理型导师';
    }
    suggestions.push({
      type: 'mentor',
      label: '建议导师类型',
      value: mentorType
    });

    // 发展目标
    const developmentGoals = [];
    if (categoryScores?.iq?.rawScore >= 7) {
      developmentGoals.push('3个月内独立承担核心模块开发');
    } else {
      developmentGoals.push('3个月内熟练掌握岗位所需核心技能');
    }
    if (categoryScores?.eq?.rawScore >= 7) {
      developmentGoals.push('6个月内能够主导跨部门协作项目');
    } else {
      developmentGoals.push('6个月内提升跨团队沟通能力');
    }
    suggestions.push({
      type: 'goals',
      label: '3-6个月发展目标',
      items: developmentGoals
    });

    return suggestions;
  }

  /**
   * 生成HR追问建议
   */
  generateHRFollowUpQuestions(scoringResult, negativeIndicators) {
    const questions = [];
    const { categoryScores } = scoringResult;

    // 基于评分薄弱项生成追问
    if (categoryScores?.iq?.rawScore < 7) {
      questions.push({
        dimension: 'IQ',
        question: '请详细介绍一下您最擅长的技术领域，以及在这个领域的实际项目经验。',
        purpose: '进一步验证技术深度'
      });
    }

    if (categoryScores?.eq?.rawScore < 7) {
      questions.push({
        dimension: 'EQ',
        question: '请描述一次您与同事或上级发生分歧的经历，您是如何处理的？',
        purpose: '验证沟通协作能力'
      });
    }

    if (categoryScores?.aq?.rawScore < 7) {
      questions.push({
        dimension: 'AQ',
        question: '请分享一次工作中遇到的最大挫折，您是如何走出来的？',
        purpose: '验证抗压和成长心态'
      });
    }

    // 基于负面指标生成追问
    const clicheIndicator = negativeIndicators.find(i => i.type === 'cliche');
    if (clicheIndicator) {
      questions.push({
        dimension: 'general',
        question: '您提到的这些优点，能具体举例说明在什么场景下体现的吗？',
        purpose: '打破套话，获取真实信息'
      });
    }

    const packagingIndicator = negativeIndicators.find(i => i.type === 'overPackaging');
    if (packagingIndicator) {
      questions.push({
        dimension: 'general',
        question: '在这个项目中，您遇到的最大困难是什么？是如何解决的？',
        purpose: '验证项目经验真实性'
      });
    }

    return questions;
  }

  /**
   * 生成背调重点
   */
  generateBackgroundCheckPoints(scoringResult, negativeIndicators) {
    const points = [];
    const { categoryScores } = scoringResult;

    // 基础背调点
    points.push({
      type: 'basic',
      label: '工作履历核实',
      items: ['工作时间', '职位职级', '离职原因', '薪资范围']
    });

    // 基于评分的背调重点
    if (categoryScores?.mq?.rawScore < 7) {
      points.push({
        type: 'special',
        label: '诚信背调',
        items: ['是否有违规记录', '离职是否正常', '是否有劳动纠纷'],
        reason: '德商评分较低，需重点关注诚信记录'
      });
    }

    if (categoryScores?.iq?.rawScore >= 8) {
      points.push({
        type: 'special',
        label: '能力背调',
        items: ['技术能力评价', '项目贡献验证', '团队评价'],
        reason: '专业评分较高，需验证实际能力水平'
      });
    }

    // 基于负面指标的背调重点
    const contradictionIndicator = negativeIndicators.find(i => i.type === 'contradiction');
    if (contradictionIndicator) {
      points.push({
        type: 'special',
        label: '信息一致性核查',
        items: ['简历信息与面试陈述一致性', '项目经历真实性'],
        reason: '检测到前后矛盾，需核实信息真实性'
      });
    }

    return points;
  }

  /**
   * 建议其他岗位
   */
  suggestAlternativePosition(scoringResult, positionInfo) {
    const { totalScore, categoryScores } = scoringResult;

    // 如果当前岗位匹配度高，不建议其他岗位
    if (totalScore >= 75) {
      return null;
    }

    // 根据维度得分特征建议其他岗位
    const suggestions = [];

    if (categoryScores?.eq?.rawScore >= 8 && categoryScores?.iq?.rawScore < 6) {
      suggestions.push({
        position: '客户服务类岗位',
        reason: '情商评分高，适合需要大量人际沟通的岗位'
      });
    }

    if (categoryScores?.iq?.rawScore >= 8 && categoryScores?.eq?.rawScore < 6) {
      suggestions.push({
        position: '技术研发类岗位',
        reason: '专业能力强，适合技术深度要求高的岗位'
      });
    }

    if (categoryScores?.mq?.rawScore >= 8) {
      suggestions.push({
        position: '财务/审计/合规类岗位',
        reason: '职业操守强，适合对诚信要求高的岗位'
      });
    }

    return suggestions.length > 0 ? suggestions : null;
  }
}

export default InterviewScoring;
