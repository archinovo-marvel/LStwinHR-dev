import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Select, 
  Button, 
  Upload, 
  message, 
  Steps,
  Radio,
  Space,
  Typography,
  Divider,
  Row,
  Col,
  Tag,
  Progress,
  Modal
} from 'antd';
import { 
  UserOutlined,
  FileTextOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  BulbOutlined,
  StarOutlined,
  MessageOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import axios from 'axios';
import candidateDB from '../utils/candidateDB';
import serverDataSync from '../utils/serverDataSync';
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

import { colors } from '../../theme/colors';

// 页面容器
const FormContainer = styled.div`
  min-height: 100vh;
  background: ${colors.background};
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

// 页面标题区
const PageHeader = styled.div`
  text-align: center;
  margin-bottom: 32px;
  
  .title {
    font-size: 28px;
    font-weight: 600;
    color: ${colors.title};
    margin-bottom: 8px;
  }
  
  .subtitle {
    font-size: 14px;
    color: ${colors.muted};
  }
`;

// 表单卡片
const FormCard = styled(Card)`
  width: 100%;
  max-width: 760px;
  border-radius: 16px;
  border: 1px solid ${colors.border};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  
  .ant-card-body {
    padding: 32px;
  }
`;

// 步骤条容器
const StepsContainer = styled.div`
  margin-bottom: 32px;
  
  .ant-steps {
    .ant-steps-item-process .ant-steps-item-icon {
      background: ${colors.primary};
      border-color: ${colors.primary};
    }
    
    .ant-steps-item-finish .ant-steps-item-icon {
      background: ${colors.primaryLight};
      border-color: ${colors.primary};
      
      .ant-steps-icon {
        color: ${colors.primary};
      }
    }
    
    .ant-steps-item-wait .ant-steps-item-icon {
      background: ${colors.background};
      border-color: ${colors.border};
    }
    
    .ant-steps-item-title {
      font-weight: 500;
    }
    
    .ant-steps-item-process .ant-steps-item-title {
      color: ${colors.title};
    }
    
    .ant-steps-item-wait .ant-steps-item-title {
      color: ${colors.muted};
    }
  }
`;

// 步骤标题
const StepTitle = styled.div`
  text-align: center;
  margin-bottom: 32px;
  
  .step-title {
    font-size: 22px;
    font-weight: 600;
    color: ${colors.title};
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  
  .step-subtitle {
    font-size: 13px;
    color: ${colors.muted};
  }
`;

// 表单网格
const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  
  @media (max-width: 576px) {
    grid-template-columns: 1fr;
  }
`;

// 输入框样式
const StyledInput = styled(Input)`
  height: 40px;
  border-radius: 10px;
  border: 1px solid ${colors.border};
  transition: all 0.2s ease;
  
  &:hover, &:focus {
    border-color: ${colors.primary};
    box-shadow: 0 0 0 2px ${colors.primaryLight};
  }
`;

// 选择框样式
const StyledSelect = styled(Select)`
  .ant-select-selector {
    height: 40px !important;
    border-radius: 10px !important;
    border: 1px solid ${colors.border} !important;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
  }
  
  &:hover .ant-select-selector {
    border-color: ${colors.primary} !important;
  }
`;

// MBTI选项卡片
const MBTIOptionCard = styled.div`
  border: 1px solid ${colors.border};
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 12px;
  
  &:hover {
    border-color: ${colors.primary};
    background: ${colors.primaryLight};
  }
  
  &.selected {
    border-color: ${colors.primary};
    background: ${colors.primaryLight};
  }
  
  .option-title {
    font-weight: 600;
    margin-bottom: 4px;
    color: ${colors.title};
  }
  
  .option-desc {
    font-size: 13px;
    color: ${colors.muted};
  }
`;

// MBTI问题卡片
const MBTIQuestionCard = styled(Card)`
  border-radius: 12px;
  border: 1px solid ${colors.border};
  margin-bottom: 16px;
  
  .ant-card-body {
    padding: 20px;
  }
`;

// MBTI快速选择区域
const MBTIQuickSelect = styled.div`
  margin-top: 16px;
  padding: 16px;
  background: ${colors.primaryLight};
  border-radius: 12px;
`;

const MBTIQuickSelectTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: ${colors.title};
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const MBTIBtnGroup = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
`;

const MBTIBtn = styled.button`
  height: 32px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  border: 1px solid ${colors.border};
  background: #fff;
  color: ${colors.text};
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  
  &:hover {
    background: #E8F2FF;
    border-color: ${colors.primary};
    color: ${colors.primary};
  }
  
  &.selected {
    background: ${colors.primary};
    border-color: ${colors.primary};
    color: #fff;
    box-shadow: 0 2px 6px rgba(47, 128, 237, 0.3);
  }
`;

// 上传区域
const UploadBox = styled.div`
  border: 2px dashed ${colors.border};
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  transition: all 0.2s ease;
  cursor: pointer;
  
  &:hover {
    border-color: ${colors.primary};
    background: ${colors.primaryLight};
  }
  
  .upload-icon {
    font-size: 48px;
    color: ${colors.primary};
    margin-bottom: 16px;
  }
  
  .upload-text {
    font-size: 16px;
    color: ${colors.title};
    margin-bottom: 8px;
  }
  
  .upload-hint {
    font-size: 13px;
    color: ${colors.muted};
  }
`;

// 成功图标
const SuccessIcon = styled.div`
  width: 80px;
  height: 80px;
  margin: 0 auto 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);
  border-radius: 50%;
  
  .anticon {
    font-size: 40px;
    color: ${colors.success};
  }
`;

// 成功标题
const SuccessTitle = styled.div`
  font-size: 28px;
  font-weight: 600;
  color: ${colors.title};
  margin-bottom: 16px;
  text-align: center;
  letter-spacing: 1px;
`;

// 成功描述
const SuccessDesc = styled.div`
  font-size: 15px;
  color: ${colors.text};
  text-align: center;
`;

// 结果卡片
const ResultCard = styled(Card)`
  border-radius: 12px;
  border: 1px solid ${colors.border};
  margin-bottom: 16px;
  
  .ant-card-body {
    padding: 20px;
  }
`;

// 匹配度分数
const MatchScore = styled.div`
  text-align: center;
  margin-bottom: 16px;
  
  .score-value {
    font-size: 36px;
    font-weight: 600;
    color: ${colors.primary};
    margin-bottom: 8px;
  }
  
  .score-label {
    font-size: 13px;
    color: ${colors.muted};
  }
`;

// 主按钮
const PrimaryButton = styled(Button)`
  height: 40px;
  border-radius: 10px;
  font-weight: 500;
  background: ${colors.primary};
  border-color: ${colors.primary};
  padding: 0 32px;
  
  &:hover {
    background: ${colors.primaryHover};
    border-color: ${colors.primaryHover};
  }
`;

// 次按钮
const SecondaryButton = styled(Button)`
  height: 40px;
  border-radius: 10px;
  font-weight: 500;
  border: 1px solid ${colors.border};
  color: ${colors.text};
  background: ${colors.cardBg};
  padding: 0 32px;
  
  &:hover {
    border-color: ${colors.primary};
    color: ${colors.primary};
  }
`;

// 按钮组
const ButtonGroup = styled.div`
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 32px;
`;

const CandidateForm = () => {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentCandidateData, setCurrentCandidateData] = useState(null);
  const [mbtiAnswers, setMbtiAnswers] = useState({});
  const [mbtiMode, setMbtiMode] = useState('quiz');
  const [directMbtiInput, setDirectMbtiInput] = useState('');
  const [availablePositions, setAvailablePositions] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const ownerId = (() => {
    try {
      const currentUrl = new URL(window.location.href);
      const value = Number(currentUrl.searchParams.get('ownerId'));
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch (error) {
      return null;
    }
  })();

  useEffect(() => {
    fetchAvailablePositions();
  }, []);

  const fetchAvailablePositions = async () => {
    setPositionsLoading(true);
    try {
      const positions = await serverDataSync.getAvailablePositions({ ownerId });
      if (Array.isArray(positions) && positions.length > 0) {
        setAvailablePositions(positions.map(p => p.name));
      } else {
        setAvailablePositions(['商务管培生', '运营管培生', '数据类管培生', '供应链管培生', '设计类管培生', '人力管培生']);
      }
    } catch (error) {
      console.error('获取岗位列表失败:', error);
      setAvailablePositions(['商务管培生', '运营管培生', '数据类管培生', '供应链管培生', '设计类管培生', '人力管培生']);
    } finally {
      setPositionsLoading(false);
    }
  };

  const steps = [
    {
      title: '基本信息',
      description: '填写个人基本信息'
    },
    {
      title: 'MBTI测评',
      description: '完成性格测评'
    },
    {
      title: '简历上传',
      description: '上传个人简历'
    },
    {
      title: '提交完成',
      description: '等待系统分析'
    }
  ];

  const mbtiQuestions = [
    {
      id: 1,
      question: "在社交场合中，你更倾向于：",
      options: [
        { value: 'E', text: '主动与陌生人交谈，享受热闹的氛围' },
        { value: 'I', text: '与熟悉的人深入交流，喜欢安静的环境' }
      ]
    },
    {
      id: 2,
      question: "做决定时，你更依赖：",
      options: [
        { value: 'S', text: '具体的事实和数据' },
        { value: 'N', text: '直觉和可能性' }
      ]
    },
    {
      id: 3,
      question: "面对问题时，你更注重：",
      options: [
        { value: 'T', text: '逻辑分析和客观判断' },
        { value: 'F', text: '情感影响和人际关系' }
      ]
    },
    {
      id: 4,
      question: "你的生活方式更倾向于：",
      options: [
        { value: 'J', text: '有计划、有组织、喜欢确定性' },
        { value: 'P', text: '灵活、适应性强、喜欢开放性' }
      ]
    }
  ];

  const calculateMBTI = (answers) => {
    const counts = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
    
    Object.values(answers).forEach(answer => {
      counts[answer]++;
    });

    return (counts.E > counts.I ? 'E' : 'I') +
           (counts.S > counts.N ? 'S' : 'N') +
           (counts.T > counts.F ? 'T' : 'F') +
           (counts.J > counts.P ? 'J' : 'P');
  };

  const validateMBTIInput = (input) => {
    const validMBTIs = [
      'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
      'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'
    ];
    return validMBTIs.includes(input.toUpperCase());
  };

  const getMBTIResult = () => {
    if (mbtiMode === 'direct') {
      if (!validateMBTIInput(directMbtiInput)) {
        return null;
      }
      return directMbtiInput.toUpperCase();
    } else {
      return calculateMBTI(mbtiAnswers);
    }
  };
  const calculateMatchScore = (mbtiType, position, resumeFileName) => {
    // 不同职位的MBTI偏好配置
    const positionPreferences = {
      '商务管培生': {
        preferred: ['ENTJ', 'ESTJ', 'ENFJ', 'ESFJ'], // 外向、判断型
        neutral: ['INTJ', 'ISTJ', 'INFJ', 'ISFJ', 'ENTP', 'ESTP', 'ENFP', 'ESFP'],
        baseScore: 75
      },
      '运营管培生': {
        preferred: ['ESTJ', 'ISTJ', 'ENTJ', 'INTJ'], // 判断型、逻辑型
        neutral: ['ESTP', 'ISTP', 'ENTP', 'INTP', 'ESFJ', 'ISFJ', 'ENFJ', 'INFJ'],
        baseScore: 70
      },
      '数据类管培生': {
        preferred: ['INTJ', 'INTP', 'ENTJ', 'ENTP'], // 直觉型、思考型
        neutral: ['ISTJ', 'ISTP', 'ESTJ', 'ESTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP'],
        baseScore: 80
      },
      '供应链管培生': {
        preferred: ['ISTJ', 'ESTJ', 'INTJ', 'ENTJ'], // 判断型、逻辑型
        neutral: ['ISTP', 'ESTP', 'INTP', 'ENTP', 'ISFJ', 'ESFJ', 'INFJ', 'ENFJ'],
        baseScore: 75
      },
      '设计类管培生': {
        preferred: ['ENFP', 'INFP', 'ENFJ', 'INFJ'], // 直觉型、情感型
        neutral: ['ENTP', 'INTP', 'ENTJ', 'INTJ', 'ESFP', 'ISFP', 'ESFJ', 'ISFJ'],
        baseScore: 70
      },
      '人力管培生': {
        preferred: ['ENFJ', 'ESFJ', 'INFJ', 'ISFJ'], // 情感型、判断型
        neutral: ['ENFP', 'ESFP', 'INFP', 'ISFP', 'ENTJ', 'ESTJ', 'INTJ', 'ISTJ'],
        baseScore: 75
      }
    };

    const config = positionPreferences[position] || positionPreferences['商务管培生'];
    
    // 计算MBTI匹配度
    let mbtiScore = 0;
    if (config.preferred.includes(mbtiType)) {
      mbtiScore = Math.min(95, config.baseScore + 15 + Math.floor(Math.random() * 5));
    } else if (config.neutral.includes(mbtiType)) {
      mbtiScore = Math.min(90, config.baseScore + 5 + Math.floor(Math.random() * 10));
    } else {
      mbtiScore = Math.max(60, config.baseScore - 10 + Math.floor(Math.random() * 15));
    }
    const resumeAnalysis = {
      overallScore: Math.floor(Math.random() * 10) + 15,
      skillMatches: [],
      educationMatch: true,
      experienceMatch: true,
      highlights: ['简历已上传，等待后端分析'],
      recommendations: ['简历将在提交后进行详细分析']
    };
    const resumeScore = config.baseScore + resumeAnalysis.overallScore * 2;
    const finalScore = Math.round(mbtiScore * 0.6 + resumeScore * 0.4);
    return {
      finalScore: Math.min(Math.max(finalScore, 50), 98),
      mbtiScore,
      resumeScore,
      resumeAnalysis
    };
  };

  const handleMBTIAnswer = (questionId, value) => {
    setMbtiAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleNext = () => {
    if (currentStep === 0) {
      // 验证基本信息
      form.validateFields(['name', 'position', 'phone', 'email']).then(() => {
        console.log('基本信息验证成功，切换到MBTI测评');
        setCurrentStep(1);
      }).catch((error) => {
        console.error('基本信息验证失败:', error);
        message.error('请填写完整的基本信息');
      });
    } else if (currentStep === 1) {
      // 验证MBTI测评
      if (mbtiMode === 'quiz') {
        if (Object.keys(mbtiAnswers).length < mbtiQuestions.length) {
          message.error('请完成所有MBTI测评题目');
          return;
        }
      } else {
        if (!directMbtiInput || !validateMBTIInput(directMbtiInput)) {
          message.error('请输入有效的MBTI类型（如：INTJ、ENFP等）');
          return;
        }
      }
      console.log('MBTI测评完成，切换到简历上传');
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // 验证简历上传
      if (fileList.length === 0) {
        message.error('请上传简历文件');
        return;
      }
      console.log('简历上传完成，开始提交');
      setCurrentStep(3);
      handleSubmit();
    }
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setUploading(true);
    let candidateData = null; // 在函数开始就声明变量
    
    try {
      // 先验证表单
      console.log('开始验证表单...');
      await form.validateFields();
      console.log('表单验证成功');
      
      const values = form.getFieldsValue();
      console.log('表单数据:', values);
      console.log('表单字段详情:', {
        name: values.name,
        position: values.position,
        phone: values.phone,
        email: values.email
      });
      console.log('MBTI答案:', mbtiAnswers);
      
      // 检查必要字段是否存在
      if (!values.name || !values.position || !values.phone || !values.email) {
        throw new Error('表单数据不完整，请检查必填字段');
      }
      
        const mbtiType = getMBTIResult();
        console.log('计算出的MBTI类型:', mbtiType);

        // 基于MBTI、职位和简历内容计算综合匹配度
        const matchAnalysis = calculateMatchScore(mbtiType, values.position, fileList[0]?.name || '未上传');
        console.log('综合分析结果:', matchAnalysis);

        // 生成推荐理由
        const generateRecommendation = (analysis) => {
          const { mbtiScore, resumeAnalysis } = analysis;
          let reasons = [];
          
          if (mbtiScore >= 85) {
            reasons.push('MBTI性格类型高度匹配');
          } else if (mbtiScore >= 75) {
            reasons.push('MBTI性格类型较为匹配');
          }
          
          if (resumeAnalysis.skillMatches.length > 0) {
            const topSkills = resumeAnalysis.skillMatches.slice(0, 3).map(s => s.skill);
            reasons.push(`具备相关技能：${topSkills.join('、')}`);
          }
          
          if (resumeAnalysis.highlights.length > 0) {
            reasons.push(resumeAnalysis.highlights[0]);
          }
          
          return reasons.length > 0 ? reasons.join('；') : '综合评估待进一步分析';
        };

        // 创建候选人数据
        candidateData = {
          id: Date.now(), // 使用时间戳作为ID
          name: values.name,
          position: values.position,
          phone: values.phone,
          email: values.email,
          mbti: mbtiType,
          submitTime: new Date().toLocaleString('zh-CN'),
          resumeFileName: fileList[0]?.name || '未上传',
          resumeSize: fileList[0]?.size || 0,
          status: '已提交',
          matchScore: matchAnalysis.finalScore, // 综合匹配度
          recommendation: generateRecommendation(matchAnalysis), // 智能推荐理由
          // 添加详细分析数据
          analysisDetails: {
            mbtiScore: matchAnalysis.mbtiScore,
            resumeScore: matchAnalysis.resumeScore,
            matchedSkills: matchAnalysis.resumeAnalysis.skillMatches.map(s => s.skill),
            analysisPoints: matchAnalysis.resumeAnalysis.highlights,
            // 新增详细的简历分析数据
            resumeAnalysis: {
              overallScore: matchAnalysis.resumeAnalysis.overallScore,
              skillMatches: matchAnalysis.resumeAnalysis.skillMatches,
              educationMatch: matchAnalysis.resumeAnalysis.educationMatch,
              experienceMatch: matchAnalysis.resumeAnalysis.experienceMatch,
              highlights: matchAnalysis.resumeAnalysis.highlights,
              recommendations: matchAnalysis.resumeAnalysis.recommendations,
              detailedAnalysis: matchAnalysis.resumeAnalysis.detailedAnalysis,
              pdfContentAnalysis: matchAnalysis.resumeAnalysis.pdfContentAnalysis
            }
          }
        };
      
      console.log('创建的候选人数据:', candidateData);

      // 保存到IndexedDB（仅当用户已登录时）
      try {
        const user = localStorage.getItem('user');
        if (user) {
          await candidateDB.addCandidate(candidateData);
          console.log('候选人数据已保存到IndexedDB:', candidateData);
        } else {
          console.log('用户未登录，跳过IndexedDB保存，直接上传到服务器');
        }
      } catch (dbError) {
        console.warn('IndexedDB保存失败，继续上传到服务器:', dbError.message);
      }
      
      // 保存到服务器（包含文件上传）
      const formData = new FormData();
      
      // 添加候选人数据
      Object.keys(candidateData).forEach(key => {
        if (key !== 'resumeFile') {
          formData.append(key, candidateData[key]);
        }
      });
      if (ownerId) {
        formData.append('ownerId', String(ownerId));
      }
      
      // 如果有文件，添加到FormData
      console.log('文件列表:', fileList);
      console.log('第一个文件:', fileList[0]);
      console.log('文件对象:', fileList[0]?.originFileObj);
      
      if (fileList[0]?.originFileObj) {
        console.log('添加文件到FormData:', fileList[0].originFileObj.name, fileList[0].originFileObj.size);
        formData.append('resume', fileList[0].originFileObj);
      } else {
        console.log('⚠️ 没有找到有效的文件对象');
      }
      
      const savedCandidate = await serverDataSync.addCandidateWithFile(formData, { ownerId });
      console.log('候选人数据已保存到服务器，电脑端将实时看到更新');
      
      console.log('当前域名:', window.location.origin);
      
      // 保存到状态中，供后续使用
      setCurrentCandidateData(savedCandidate || {
        ...candidateData,
        status: '分析中',
        recommendation: '简历分析排队中，请稍候查看结果'
      });
      setSubmitted(true);
      setUploading(false);
      message.success('信息提交成功，简历正在后台分析');
      
    } catch (error) {
      console.error('提交失败:', error);
      console.error('错误详情:', {
        message: error.message,
        stack: error.stack,
        candidateData: candidateData
      });
      message.error(`提交失败: ${error.message}，请重试`);
      setUploading(false);
    }
  };

  const uploadProps = {
    name: 'resume',
    multiple: false,
    fileList,
    beforeUpload: (file) => {
      const isPDF = file.type === 'application/pdf';
      const isWord = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                     file.type === 'application/msword';
      const isJPG = file.type === 'image/jpeg' || file.type === 'image/jpg';
      
      if (!isPDF && !isWord && !isJPG) {
        message.error('只支持PDF、Word和JPG格式文件！');
        return false;
      }
      
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('文件大小不能超过10MB！');
        return false;
      }
      
      console.log('beforeUpload - 文件信息:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });
      // 创建符合Ant Design Upload组件期望的文件对象
      const fileObj = {
        uid: file.uid || Date.now().toString(),
        name: file.name,
        status: 'done',
        originFileObj: file
      };
      setFileList([fileObj]);
      console.log('文件已添加到fileList:', fileObj);
      return false;
    },
    onRemove: () => {
      setFileList([]);
    }
  };

  const renderStepContent = () => {
    return (
      <div>
        {/* 基本信息 - 始终存在，通过display控制显示 */}
        <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
          <StepTitle>
            <div className="step-title">
              <UserOutlined />
              基本信息填写
            </div>
            <div className="step-subtitle">请填写您的个人基本信息</div>
          </StepTitle>
          <FormGrid>
            <Form.Item
              name="name"
              label="姓名"
              rules={[{ required: true, message: '请输入姓名' }]}
            >
              <StyledInput placeholder="请输入您的姓名" />
            </Form.Item>
            <Form.Item
              name="position"
              label="应聘职位"
              rules={[{ required: true, message: '请选择应聘职位' }]}
            >
              <StyledSelect placeholder={positionsLoading ? "加载岗位中..." : "请选择应聘职位"} disabled={positionsLoading}>
                {availablePositions.map((position) => (
                  <Option key={position} value={position}>{position}</Option>
                ))}
              </StyledSelect>
            </Form.Item>
            <Form.Item
              name="phone"
              label="手机号码"
              rules={[
                { required: true, message: '请输入手机号码' },
                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码' }
              ]}
            >
              <StyledInput placeholder="请输入手机号码" />
            </Form.Item>
            <Form.Item
              name="email"
              label="邮箱地址"
              rules={[
                { required: true, message: '请输入邮箱地址' },
                { type: 'email', message: '请输入正确的邮箱地址' }
              ]}
            >
              <StyledInput placeholder="请输入邮箱地址" />
            </Form.Item>
          </FormGrid>
        </div>

        {/* MBTI测评 - 始终存在，通过display控制显示 */}
        <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
          <StepTitle>
            <div className="step-title">
              <BulbOutlined />
              MBTI性格测评
            </div>
            <div className="step-subtitle">完成性格测评，帮助我们更好地了解您</div>
          </StepTitle>
          
          {/* 模式选择 */}
          <MBTIQuestionCard>
            <Title level={4} style={{ marginBottom: '16px', color: colors.title }}>选择测评方式</Title>
            <Radio.Group 
              value={mbtiMode} 
              onChange={(e) => setMbtiMode(e.target.value)}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <MBTIOptionCard 
                  className={mbtiMode === 'quiz' ? 'selected' : ''}
                  onClick={() => setMbtiMode('quiz')}
                >
                  <Radio value="quiz">
                    <div className="option-title">📝 在线测评</div>
                    <div className="option-desc">通过4道选择题了解你的性格类型</div>
                  </Radio>
                </MBTIOptionCard>
                <MBTIOptionCard 
                  className={mbtiMode === 'direct' ? 'selected' : ''}
                  onClick={() => setMbtiMode('direct')}
                >
                  <Radio value="direct">
                    <div className="option-title">✏️ 直接填写</div>
                    <div className="option-desc">如果你已经知道自己的MBTI类型，可以直接输入</div>
                  </Radio>
                </MBTIOptionCard>
              </Space>
            </Radio.Group>
          </MBTIQuestionCard>

          {/* 选择题模式 */}
          {mbtiMode === 'quiz' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <Progress 
                  percent={(Object.keys(mbtiAnswers).length / mbtiQuestions.length) * 100} 
                  status="active"
                  strokeColor={colors.primary}
                />
                <Text style={{ display: 'block', textAlign: 'center', marginTop: '8px', color: colors.muted }}>
                  已完成 {Object.keys(mbtiAnswers).length} / {mbtiQuestions.length} 题
                </Text>
              </div>
              <Space direction="vertical" style={{ width: '100%' }}>
                {mbtiQuestions.map((question, index) => (
                  <MBTIQuestionCard key={question.id}>
                    <Title level={4} style={{ marginBottom: '16px', color: colors.title }}>
                      问题 {index + 1}: {question.question}
                    </Title>
                    <Radio.Group 
                      value={mbtiAnswers[question.id]}
                      onChange={(e) => handleMBTIAnswer(question.id, e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {question.options.map((option, optIndex) => (
                          <MBTIOptionCard 
                            key={optIndex}
                            className={mbtiAnswers[question.id] === option.value ? 'selected' : ''}
                            onClick={() => handleMBTIAnswer(question.id, option.value)}
                          >
                            <Radio value={option.value}>
                              {option.text}
                            </Radio>
                          </MBTIOptionCard>
                        ))}
                      </Space>
                    </Radio.Group>
                  </MBTIQuestionCard>
                ))}
              </Space>
            </div>
          )}

          {/* 直接输入模式 */}
          {mbtiMode === 'direct' && (
            <MBTIQuestionCard>
              <Title level={4} style={{ marginBottom: '16px', color: colors.title }}>直接输入MBTI类型</Title>
              <div style={{ marginBottom: '16px' }}>
                <Text type="secondary" style={{ color: colors.muted }}>
                  请输入你的MBTI类型（如：INTJ、ENFP、ISTJ等）
                </Text>
              </div>
              <Input
                placeholder="例如：INTJ"
                value={directMbtiInput}
                onChange={(e) => setDirectMbtiInput(e.target.value.toUpperCase())}
                style={{ 
                  fontSize: '18px',
                  textAlign: 'center',
                  letterSpacing: '2px',
                  fontWeight: 'bold',
                  height: '48px',
                  borderRadius: '10px',
                  border: `1px solid ${colors.border}`
                }}
                maxLength={4}
              />
              {directMbtiInput && !validateMBTIInput(directMbtiInput) && (
                <div style={{ marginTop: '8px', color: colors.danger, fontSize: '13px' }}>
                  请输入有效的MBTI类型
                </div>
              )}
              {directMbtiInput && validateMBTIInput(directMbtiInput) && (
                <div style={{ marginTop: '8px', color: colors.success, fontSize: '13px' }}>
                  ✅ 有效的MBTI类型
                </div>
              )}
              <MBTIQuickSelect>
                <MBTIQuickSelectTitle>
                  <BulbOutlined style={{ color: colors.primary }} />
                  快速选择（推荐）：
                </MBTIQuickSelectTitle>
                <MBTIBtnGroup>
                  {['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
                    'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'].map(type => (
                    <MBTIBtn
                      key={type}
                      className={directMbtiInput === type ? 'selected' : ''}
                      onClick={() => setDirectMbtiInput(type)}
                    >
                      {type}
                    </MBTIBtn>
                  ))}
                </MBTIBtnGroup>
              </MBTIQuickSelect>
            </MBTIQuestionCard>
          )}
        </div>

        {/* 简历上传 - 始终存在，通过display控制显示 */}
        <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
          <StepTitle>
            <div className="step-title">
              <FileTextOutlined />
              简历上传
            </div>
            <div className="step-subtitle">上传您的个人简历，支持PDF、Word格式</div>
          </StepTitle>
          <Dragger {...uploadProps} style={{ padding: '20px' }}>
            <UploadBox>
              <div className="upload-icon">
                <UploadOutlined />
              </div>
              <div className="upload-text">点击或拖拽文件到此区域上传</div>
              <div className="upload-hint">支持 PDF、Word 格式，文件大小不超过 10MB</div>
            </UploadBox>
          </Dragger>
          {fileList.length > 0 && (
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <Tag color="green" style={{ fontSize: '14px', padding: '4px 12px' }}>
                <CheckCircleOutlined style={{ marginRight: '4px' }} />
                已选择文件: {fileList[0].name}
              </Tag>
            </div>
          )}
        </div>

        {/* 提交完成 - 始终存在，通过display控制显示 */}
        <div style={{ display: currentStep === 3 ? 'block' : 'none' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{ textAlign: 'center', padding: '60px 20px' }}
          >
            <SuccessIcon>
              <CheckCircleOutlined />
            </SuccessIcon>
            <SuccessTitle>提交成功</SuccessTitle>
            <SuccessDesc style={{ marginBottom: '16px' }}>
              系统正在分析您的信息
            </SuccessDesc>
            <Text style={{ display: 'block', color: colors.muted, fontSize: '14px', marginBottom: '40px' }}>
              HR将尽快与您联系
            </Text>
            <PrimaryButton 
              size="large"
              onClick={async () => {
                form.resetFields();
                setFileList([]);
                setCurrentStep(0);
                setSubmitted(false);
                setUploading(false);
                setCurrentCandidateData(null);
              }}
            >
              <ReloadOutlined style={{ marginRight: '8px' }} />
              重新填写
            </PrimaryButton>
          </motion.div>
        </div>
      </div>
    );
  };

  return (
    <FormContainer>
      <PageHeader>
        <div className="title">招聘灵犀</div>
        <div className="subtitle">管培生招聘申请系统</div>
      </PageHeader>
      <FormCard>
        <StepsContainer>
          <Steps current={currentStep}>
            {steps.map((item, index) => (
              <Steps.Step key={index} title={item.title} description={item.description} />
            ))}
          </Steps>
        </StepsContainer>

        <Form form={form} layout="vertical" preserve={true}>
          {renderStepContent()}
        </Form>

        {currentStep < 3 && (
          <ButtonGroup>
            {currentStep > 0 && (
              <SecondaryButton size="large" onClick={handlePrev}>
                上一步
              </SecondaryButton>
            )}
            <PrimaryButton 
              type="primary" 
              size="large"
              onClick={handleNext}
              loading={uploading}
            >
              {currentStep === 2 ? '提交申请' : '下一步'}
            </PrimaryButton>
          </ButtonGroup>
        )}
      </FormCard>
    </FormContainer>
  );
};

export default CandidateForm;
