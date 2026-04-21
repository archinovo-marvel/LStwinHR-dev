import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Input,
  Select,
  message,
  Row,
  Col,
  Typography,
  Space,
  Tag,
  Progress,
  Divider,
  Avatar
} from 'antd';
import {
  VideoCameraOutlined,
  AudioOutlined,
  SendOutlined,
  UserOutlined,
  RobotOutlined,
  PauseCircleOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import axios from 'axios';
import InterviewScoring from '../utils/interviewScoring';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

const InterviewContainer = styled.div`
  background: #f8f9fa;
  border-radius: 16px;
  padding: 24px;
  min-height: 60vh;
  margin-bottom: 24px;
`;

const MessageBubble = styled.div`
  margin-bottom: 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const UserMessage = styled.div`
  background: #1890ff;
  color: white;
  padding: 12px 16px;
  border-radius: 18px 18px 4px 18px;
  max-width: 70%;
  word-wrap: break-word;
`;

const BotMessage = styled.div`
  background: white;
  color: #333;
  padding: 12px 16px;
  border-radius: 18px 18px 18px 4px;
  max-width: 70%;
  word-wrap: break-word;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
`;

const InterviewPage = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [messages, setMessages] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  const interviewContainerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const interviewQuestions = {
    '前端开发工程师': [
      "请介绍一下您的技术栈和项目经验",
      "您如何处理跨浏览器兼容性问题？",
      "请解释一下React的生命周期",
      "您如何优化网站性能？",
      "请描述一个您解决过的技术难题"
    ],
    '后端开发工程师': [
      "请介绍一下您的后端技术栈",
      "您如何设计数据库结构？",
      "请解释一下RESTful API的设计原则",
      "您如何处理高并发问题？",
      "请描述一个您参与的系统架构设计"
    ],
    '产品经理': [
      "请介绍一下您负责过的产品",
      "您如何进行用户需求分析？",
      "请描述一个产品从0到1的过程",
      "您如何平衡用户需求和商业目标？",
      "请分享一个产品迭代的经验"
    ]
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchCompanies = async () => {
    try {
      const response = await axios.get('/api/companies');
      setCompanies(response.data.companies);
    } catch (error) {
      console.error('获取公司列表失败:', error);
    }
  };

  const scrollToBottom = () => {
    if (interviewContainerRef.current) {
      interviewContainerRef.current.scrollTop = interviewContainerRef.current.scrollHeight;
    }
  };

  const startInterview = () => {
    if (!selectedCompany || !selectedPosition) {
      message.error('请选择公司和职位');
      return;
    }

    setInterviewStarted(true);
    setQuestionIndex(0);
    setMessages([]);
    setEvaluation(null);
    
    const questions = interviewQuestions[selectedPosition] || interviewQuestions['前端开发工程师'];
    const firstQuestion = questions[0];
    
    const botMessage = {
      id: Date.now(),
      type: 'bot',
      content: `您好！我是${companies.find(c => c.id === selectedCompany)?.name || '公司'}的AI面试官。欢迎参加${selectedPosition}的面试。我们的第一个问题是：${firstQuestion}`,
      timestamp: new Date()
    };
    
    setMessages([botMessage]);
  };

  const submitAnswer = async () => {
    if (!userAnswer.trim()) {
      message.error('请输入您的回答');
      return;
    }

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: userAnswer,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setUserAnswer('');

    const questions = interviewQuestions[selectedPosition] || interviewQuestions['前端开发工程师'];
    const nextIndex = questionIndex + 1;

    if (nextIndex < questions.length) {
      // 还有更多问题
      const nextQuestion = questions[nextIndex];
      setQuestionIndex(nextIndex);

      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: `谢谢您的回答。下一个问题是：${nextQuestion}`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } else {
      // 面试结束，开始评估
      await evaluateInterview();
    }
  };

  const evaluateInterview = async () => {
    setIsEvaluating(true);

    const botMessage = {
      id: Date.now() + 1,
      type: 'bot',
      content: '面试已完成，正在为您生成评估报告...',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, botMessage]);

    try {
      const questions = interviewQuestions[selectedPosition] || interviewQuestions['前端开发工程师'];
      const candidateAnswers = messages
        .filter(msg => msg.type === 'user')
        .map(msg => msg.content);

      // Call AI scoring with silent degradation
      let aiScores = null;
      try {
        const scoring = new InterviewScoring();
        const aiResult = await scoring.analyzeWithAI({
          questions: questions,
          candidateAnswers: candidateAnswers
        });
        aiScores = {
          questionScores: aiResult.questionScores,
          totalScore: aiResult.totalScore,
          summary: aiResult.summary
        };
      } catch (e) {
        console.warn('AI评分失败:', e.message);
        // Silent degradation - continue without AI scores
      }

      // Save AI scoring result to candidate data (if available)
      if (aiScores) {
        try {
          await axios.post('/api/candidates/interview-score', {
            candidateId: 'temp-candidate-id',
            interviewScore: aiScores.totalScore,
            interviewDetails: aiScores,
            interviewDate: new Date().toISOString(),
            interviewRecord: { questions, answers: candidateAnswers },
            candidateSnapshot: { companyId: selectedCompany, position: selectedPosition }
          });
        } catch (saveError) {
          console.warn('保存AI评分结果失败:', saveError);
        }
      }

      // Also get the standard evaluation from backend
      const response = await axios.post('/api/interview', {
        candidateId: 'temp-candidate-id',
        questions: questions,
        answers: candidateAnswers,
        companyId: selectedCompany
      });

      // Merge AI result with evaluation
      const mergedEvaluation = {
        ...response.data.interview,
        aiScores: aiScores,
        totalScore: aiScores ? aiScores.totalScore : response.data.interview.totalScore
      };

      setEvaluation(mergedEvaluation);

      const finalMessage = {
        id: Date.now() + 2,
        type: 'bot',
        content: '评估完成！您可以在下方查看详细的评估报告。',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, finalMessage]);
    } catch (error) {
      message.error('评估失败：' + error.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await sendAudioAnswer(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      message.error('无法访问麦克风');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const sendAudioAnswer = async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob);

    try {
      const response = await axios.post('/api/speech-to-text', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUserAnswer(response.data.text);
    } catch (error) {
      message.error('语音识别失败');
    }
  };

  const renderEvaluation = () => {
    if (!evaluation) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card 
          title="面试评估报告" 
          style={{ borderRadius: '16px' }}
          styles={{ header: { borderRadius: '16px 16px 0 0' } }}
        >
          <Row gutter={[24, 24]}>
            <Col xs={24} md={12}>
              <div style={{ marginBottom: 24 }}>
                <Title level={4}>综合评分</Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text>专业能力</Text>
                    <Progress percent={85} strokeColor="#1890ff" />
                  </div>
                  <div>
                    <Text>沟通能力</Text>
                    <Progress percent={78} strokeColor="#52c41a" />
                  </div>
                  <div>
                    <Text>团队合作</Text>
                    <Progress percent={82} strokeColor="#fa8c16" />
                  </div>
                  <div>
                    <Text>学习能力</Text>
                    <Progress percent={90} strokeColor="#722ed1" />
                  </div>
                </Space>
              </div>
            </Col>
            
            <Col xs={24} md={12}>
              <div style={{ marginBottom: 24 }}>
                <Title level={4}>关键特点</Title>
                <Space wrap>
                  <Tag color="blue">技术扎实</Tag>
                  <Tag color="green">表达清晰</Tag>
                  <Tag color="orange">思维敏捷</Tag>
                  <Tag color="purple">学习能力强</Tag>
                </Space>
              </div>
              
              <div>
                <Title level={4}>建议</Title>
                <Paragraph>
                  建议在技术深度方面继续加强，同时可以多参与开源项目来提升实践经验。
                </Paragraph>
              </div>
            </Col>
          </Row>

          <Divider />

          <div>
            <Title level={4}>详细评估</Title>
            <Paragraph style={{ whiteSpace: 'pre-line' }}>
              {evaluation.evaluation}
            </Paragraph>
          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <div style={{ 
      height: '100%',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      flex: 1,
      boxSizing: 'border-box'
    }}>
      <Card 
        title={
          <div style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#1890ff',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <VideoCameraOutlined />
            AI面试系统
          </div>
        } 
        style={{ 
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}
        bodyStyle={{ 
          padding: '32px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {!interviewStarted ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Row gutter={[32, 24]}>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: '24px' }}>
                  <Text strong style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>选择公司：</Text>
                  <Select
                    style={{ width: '100%', borderRadius: '8px' }}
                    placeholder="选择面试公司"
                    value={selectedCompany}
                    onChange={setSelectedCompany}
                    size="large"
                  >
                    {companies.map(company => (
                      <Option key={company.id} value={company.id}>
                        {company.name}
                      </Option>
                    ))}
                  </Select>
                </div>

                <div style={{ marginBottom: '32px' }}>
                  <Text strong style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>应聘职位：</Text>
                  <Select
                    style={{ width: '100%', borderRadius: '8px' }}
                    placeholder="选择应聘职位"
                    value={selectedPosition}
                    onChange={setSelectedPosition}
                    size="large"
                  >
                    <Option value="前端开发工程师">前端开发工程师</Option>
                    <Option value="后端开发工程师">后端开发工程师</Option>
                    <Option value="产品经理">产品经理</Option>
                  </Select>
                </div>

                <Button
                  type="primary"
                  icon={<VideoCameraOutlined />}
                  onClick={startInterview}
                  size="large"
                  style={{ 
                    width: '100%', 
                    borderRadius: '12px',
                    height: '48px',
                    fontSize: '16px',
                    background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(24, 144, 255, 0.3)'
                  }}
                >
                  开始面试
                </Button>
              </Col>

              <Col xs={24} md={12}>
                <Card 
                  title="面试说明" 
                  size="small"
                  style={{ 
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    height: 'fit-content'
                  }}
                  styles={{ header: { borderRadius: '12px 12px 0 0' } }}
                >
                  <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    <li style={{ marginBottom: '8px' }}>面试将包含5个专业问题</li>
                    <li style={{ marginBottom: '8px' }}>支持文字和语音回答</li>
                    <li style={{ marginBottom: '8px' }}>AI将根据您的回答进行评估</li>
                    <li style={{ marginBottom: '8px' }}>面试结束后将生成详细报告</li>
                  </ul>
                </Card>
              </Col>
            </Row>
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <InterviewContainer 
              ref={interviewContainerRef}
              style={{ 
                flex: 1, 
                minHeight: '400px',
                maxHeight: 'none',
                overflowY: 'auto'
              }}
            >
              {messages.map((msg) => (
                <MessageBubble key={msg.id}>
                  <Avatar 
                    icon={msg.type === 'user' ? <UserOutlined /> : <RobotOutlined />}
                    size={40}
                    style={{ 
                      backgroundColor: msg.type === 'user' ? '#1890ff' : '#52c41a',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    {msg.type === 'user' ? (
                      <UserMessage>
                        {msg.content}
                      </UserMessage>
                    ) : (
                      <BotMessage>
                        {msg.content}
                      </BotMessage>
                    )}
                    <Text type="secondary" style={{ fontSize: '12px', marginTop: 4 }}>
                      {msg.timestamp.toLocaleTimeString()}
                    </Text>
                  </div>
                </MessageBubble>
              ))}
              
              {isEvaluating && (
                <MessageBubble>
                  <Avatar icon={<RobotOutlined />} size={40} style={{ backgroundColor: '#52c41a' }} />
                  <BotMessage>
                    <div>正在生成评估报告，请稍候...</div>
                  </BotMessage>
                </MessageBubble>
              )}
            </InterviewContainer>

            {!evaluation && (
              <div style={{ 
                display: 'flex', 
                gap: '16px', 
                alignItems: 'flex-end',
                marginTop: '24px',
                padding: '24px',
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
              }}>
                <div style={{ flex: 1 }}>
                  <TextArea
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="请输入您的回答..."
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    style={{ 
                      borderRadius: '12px',
                      border: '2px solid #f0f0f0',
                      fontSize: '16px'
                    }}
                  />
                </div>
                <Space size="middle">
                  <Button
                    type={isRecording ? "primary" : "default"}
                    icon={isRecording ? <PauseCircleOutlined /> : <AudioOutlined />}
                    onClick={isRecording ? stopRecording : startRecording}
                    danger={isRecording}
                    size="large"
                    style={{ 
                      borderRadius: '50%',
                      width: '48px',
                      height: '48px'
                    }}
                  />
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={submitAnswer}
                    disabled={!userAnswer.trim() || isEvaluating}
                    size="large"
                    style={{ 
                      borderRadius: '12px',
                      height: '48px',
                      padding: '0 24px',
                      background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
                      border: 'none',
                      boxShadow: '0 4px 15px rgba(24, 144, 255, 0.3)'
                    }}
                  >
                    提交回答
                  </Button>
                </Space>
              </div>
            )}
          </div>
        )}
      </Card>

      <div style={{ flex: 1 }}>
        {renderEvaluation()}
      </div>
    </div>
  );
};

export default InterviewPage;

