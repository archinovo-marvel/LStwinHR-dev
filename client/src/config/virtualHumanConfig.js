// 虚拟人SDK配置文件
// 从环境变量读取敏感凭证
const COMPANY_PROFILE_PROMPT = "嘉兴孪数光线科技有限公司是一家以BIM技术为基础，秉持“产学研”一体创业理念，专注于空间数字模型及AI应用场景创新的科技型企业，公司的技术和产品已经服务上海、苏州、嘉兴等地多个重点工程的数字孪生场景。";

export const virtualHumanConfig = {
  // API配置 - 从环境变量读取
  appId: process.env.REACT_APP_XUNFEI_APP_ID,
  apiKey: process.env.REACT_APP_XUNFEI_API_KEY,
  apiSecret: process.env.REACT_APP_XUNFEI_API_SECRET,
  sceneId: process.env.REACT_APP_XUNFEI_SCENE_ID,
  serverUrl: process.env.REACT_APP_XUNFEI_SERVER_URL,
  
  // 虚拟人配置 - 从环境变量读取
  avatar_id: process.env.REACT_APP_XUNFEI_AVATAR_ID,
  vcn: process.env.REACT_APP_XUNFEI_VCN,
  
  // 流配置
  protocol: 'xrtc', // 回到XRTC协议，这是讯飞原生支持的协议
  alpha: 1,
  bitrate: process.env.bitrate,
  width: 1080, // 4的倍数
  height: 1920, // 4的倍数
  scale: 1,
  move_h: 0, // 文档要求：[-4096, +4096]
  move_v: 0, // 文档要求：[-4096, +4096]
  
  // TTS配置
  speed: 70, // 提高语速，从50提升到70
  
  pitch: 50,
  volume: 100,
  
  // 交互配置
  interactive_mode: 1,
  content_analysis: 0,
  
  // 大模型配置（已开启）
  nlp: {
    enabled: true,
    // 大模型配置 - 匹配讯飞虚拟人控制台配置
    domain: "xdeepseekr1",
    promptTemplate: `# 角色\n\n你是招聘灵犀的AI面试官，负责进行面试提问。\n\n## 公司常驻知识库\n- ${COMPANY_PROFILE_PROMPT}\n- 当候选人询问公司背景、业务、技术方向、项目场景时，优先基于以上公司简介进行回答。\n- 若问题超出公司简介范围，不要编造，可基于已有信息做简洁说明。\n\n## 面试官行为准则\n- 每次回复不超过20个字\n- 禁止分析候选人的回答\n- 禁止给出任何评价（如"很棒"、"很好"、"优秀"等）\n- 禁止提供职业建议或技术指导\n- 禁止重复候选人的内容\n- 禁止长篇大论\n\n## 面试流程\n1. 问完问题后，等待候选人回答\n2. 候选人回答后，只说："好的" 或 "明白了" 或 "谢谢"\n3. 然后提出1个相关的反问\n4. 等待候选人回答反问\n5. 进入下一个正式问题\n\n## 知识文本：\n\n\${DOC_CONTENT}\n\n## 用户的问题：\n\n\${USER_CONTENT}\n\n## 回复要求：\n\n- 回复内容必须控制在20字以内\n- 简洁明了，重点突出\n- 专注于提问，不要评价\n- 保持面试节奏流畅`,
    embeddingTop: 10,
    thresholdScore: 0.45,
    qaThresholdScore: 0.9,
    dialogueTop: 5,
    dbList: [
      {
        name: "e1219e141bb84c2e89739901c4f8b56f",
        version: 2
      }
    ],
    esTop: 4,
    topK: 1,
    temperature: 0.5,
    dialoguePromptTemplate: "你是一个问题改写助手，从历史会话中，改写或补全问题，使问题描述的更完整，这是一些示例：\n----\n历史会话：\n{\n问题：周杰伦的媳妇是谁？\n答案：周杰伦的媳妇是昆凌。\n}\n问题：\n{\n她多大了？\n}\n输出：[\"昆凌今年多大了\"]\n----\n历史会话：\n{\n问题：河南省高标准农田面积有多少？\n答案：根据中国农业协会统计一共有33999亩。\n问题：那南阳呢？\n答案：南阳高标准农田面积有5899亩。\n}\n问题：\n{\n它的总人口是多少？\n}\n输出：[\"南阳总人口是多少？\"]\n----\n历史会话：\n{\n${DOC_CONTENT}\n}\n问题：\n{\n${USER_CONTENT}\n}\n输出：",
    qqEmbThresholdScore: 0.8,
    // 大模型类型
    model_type: 'deepseek-r1',
    // 其他大模型参数
    parameters: {
      temperature: 0.5,
      max_tokens: 1000
    }
  },
  
  // 字幕配置
  subtitle: 1,
  font_color: '#FF0000',
  font_name: 'Sanji.Suxian.Simple',
  position_x: 100,
  position_y: 0,
  font_size: 10,
  subtitle_width: 100,
  subtitle_height: 100,
  
  // 动作配置
  air: 1,
  add_nonsemantic: 1,
  
  // 其他配置
  autoConnect: true // 自动连接虚拟人
};

export default virtualHumanConfig;
