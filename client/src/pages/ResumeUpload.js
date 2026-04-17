import React, { useState, useRef, useEffect } from 'react';
import { 
  Card, 
  Upload, 
  Button, 
  Form, 
  Input, 
  Select, 
  message, 
  Progress,
  Row,
  Col,
  Tag,
  Typography,
  Divider,
  Space,
  Modal,
  Steps,
  Radio,
  Checkbox,
  Slider,
  Tabs
} from 'antd';
import { 
  UploadOutlined, 
  FileTextOutlined,
  UserOutlined,
  TrophyOutlined,
  TeamOutlined,
  QrcodeOutlined,
  ScanOutlined,
  BulbOutlined,
  StarOutlined,
  CheckCircleOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import axios from 'axios';

// 添加CSS动画
const spinAnimation = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// 注入CSS动画
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = spinAnimation;
  document.head.appendChild(style);
}

const { Option } = Select;
const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const { TabPane } = Tabs;

// 主色调定义 - 与首页统一
const colors = {
  primary: '#2F80ED',
  primaryHover: '#1C5FD4',
  primaryLight: '#E8F2FF',
  background: '#F7F9FC',
  cardBg: '#FFFFFF',
  title: '#1F2D3D',
  text: '#4A5568',
  muted: '#94A3B8',
  border: '#E2E8F0',
  divider: '#EEF2F7',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  cyan: '#06B6D4'
};

const PageContainer = styled.div`
  height: 100%;
  background: ${colors.background};
  display: flex;
  flex-direction: column;
  padding: 32px;
  flex: 1;
  box-sizing: border-box;
`;

const PageHeader = styled.div`
  margin-bottom: 32px;
  
  h2 {
    color: ${colors.title};
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  
  .subtitle {
    color: ${colors.muted};
    font-size: 15px;
  }
`;

const ContentCard = styled(Card)`
  border-radius: 16px;
  border: 1px solid ${colors.border};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  margin-bottom: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  
  .ant-card-body {
    padding: 32px;
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  
  .ant-card-head {
    border-bottom: 1px solid ${colors.divider};
  }
`;

const QRCodeSection = styled.div`
  text-align: center;
  padding: 40px 24px;
  
  .qr-icon {
    font-size: 5rem;
    color: ${colors.primary};
    margin-bottom: 20px;
  }
  
  .qr-title {
    font-size: 24px;
    font-weight: 600;
    color: ${colors.title};
    margin-bottom: 16px;
  }
  
  .qr-desc {
    font-size: 16px;
    color: ${colors.muted};
    margin-bottom: 30px;
    line-height: 1.6;
  }
`;

const InfoBanner = styled.div`
  margin-top: 20px;
  padding: 16px 20px;
  background: ${props => props.$hasPublicUrl ? 'rgba(16, 185, 129, 0.08)' : colors.primaryLight};
  border: 1px solid ${props => props.$hasPublicUrl ? 'rgba(16, 185, 129, 0.2)' : colors.border};
  border-radius: 12px;
  
  .banner-title {
    color: ${props => props.$hasPublicUrl ? colors.success : colors.title};
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
  }
  
  .banner-desc {
    color: ${colors.muted};
    font-size: 13px;
  }
`;

const PrimaryButton = styled(Button)`
  && {
    height: 48px;
    border-radius: 12px;
    font-weight: 500;
    font-size: 16px;
    padding: 0 32px;
    background: ${colors.primary};
    border-color: ${colors.primary};
    box-shadow: 0 4px 12px rgba(47, 128, 237, 0.25);
    transition: all 0.2s ease;
    
    &:hover {
      background: ${colors.primaryHover};
      border-color: ${colors.primaryHover};
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(47, 128, 237, 0.35);
    }
  }
`;

const SecondaryButton = styled(Button)`
  && {
    height: 48px;
    border-radius: 12px;
    font-weight: 500;
    font-size: 16px;
    padding: 0 32px;
    border: 1px solid ${colors.border};
    color: ${colors.text};
    background: ${colors.cardBg};
    transition: all 0.2s ease;
    
    &:hover {
      border-color: ${colors.primary};
      color: ${colors.primary};
      background: ${colors.primaryLight};
    }
  }
`;

const UploadContainer = styled.div`
  .ant-upload-drag {
    border: 2px dashed ${colors.border};
    border-radius: 16px;
    background: ${colors.background};
    transition: all 0.3s;
    
    &:hover {
      border-color: ${colors.primary};
      background: ${colors.primaryLight};
    }
  }
`;

const AnalysisCard = styled(Card)`
  border-radius: 16px;
  border: 1px solid ${colors.border};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  margin-top: 24px;
`;

const ScoreCard = styled.div`
  text-align: center;
  padding: 20px;
  border-radius: 12px;
  background: ${props => `rgba(${props.color}, 0.08)`};
  border: 1px solid ${props => `rgba(${props.color}, 0.2)`};
`;

const ResumeUpload = () => {
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [fileList, setFileList] = useState([]);
  
  // 新增状态
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [mbtiResult, setMbtiResult] = useState(null);
  const [positionMatchResults, setPositionMatchResults] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [qrCodeGenerated, setQrCodeGenerated] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrCodeServices, setQrCodeServices] = useState([]);
  const [currentServiceIndex, setCurrentServiceIndex] = useState(0);
  const [qrCodeLoading, setQrCodeLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState('');
  const [showDomainConfig, setShowDomainConfig] = useState(false);
  const [candidateFormUrl, setCandidateFormUrl] = useState('');
  const videoRef = useRef(null);
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const normalizeBaseUrl = (value) => (value || '').trim().replace(/\/+$/, '');
  const getCurrentOwnerId = () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      return currentUser?.id ? Number(currentUser.id) : null;
    } catch (error) {
      return null;
    }
  };

  const resolveCandidateFormUrl = (domainOverride = '') => {
    const ownerId = getCurrentOwnerId();
    const ownerQuery = ownerId ? `?ownerId=${ownerId}` : '';
    const manualBase = normalizeBaseUrl(domainOverride);
    if (manualBase) return `${manualBase}/candidate-form${ownerQuery}`;

    const publicBase = normalizeBaseUrl(process.env.REACT_APP_PUBLIC_BASE_URL);
    if (publicBase) return `${publicBase}/candidate-form${ownerQuery}`;

    return `${window.location.origin}/candidate-form${ownerQuery}`;
  };

  const buildQRCodeServices = (targetUrl) => ([
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`,
    `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(targetUrl)}`,
    `https://qr-server.com/api/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`
  ]);

  // 页面加载时自动生成二维码
  useEffect(() => {
    const autoGenerateQRCode = () => {
      const targetUrl = resolveCandidateFormUrl();
      setCandidateFormUrl(targetUrl);

      console.log('自动生成二维码URL:', targetUrl);
      
      // 使用多个二维码生成服务作为备选
      const services = buildQRCodeServices(targetUrl);
      
      setQrCodeServices(services);
      setQrCodeUrl(services[0]);
      setCurrentServiceIndex(0);
      setQrCodeGenerated(true);
      setQrCodeLoading(false);
      
      console.log('二维码已自动生成，URL:', targetUrl);
      console.log('可用的二维码服务:');
      services.forEach((url, index) => {
        console.log(`服务${index + 1}:`, url);
      });

      if (isLocalhost && !process.env.REACT_APP_PUBLIC_BASE_URL) {
        message.warning('当前是 localhost，本机外手机通常无法访问。请点击“更换地址”配置公网地址（如 ngrok）。');
      }
    };

    // 延迟一点时间确保页面完全加载
    const timer = setTimeout(autoGenerateQRCode, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleUpload = async (values) => {
    if (fileList.length === 0) {
      message.error('请选择简历文件');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('resume', fileList[0].originFileObj);
    formData.append('candidateName', values.candidateName);
    formData.append('position', values.position);

    try {
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await axios.post('/api/upload-resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      setAnalysisResult(response.data.resume);
      message.success('简历上传成功！');
      
      // 解析分析结果
      setTimeout(() => {
        parseAnalysisResult(response.data.resume.analysis);
      }, 500);

    } catch (error) {
      console.error('上传失败:', error);
      let errorMessage = '上传失败';
      
      if (error.response) {
        // 服务器返回了错误状态码
        const { status, data } = error.response;
        if (status === 400) {
          errorMessage = `请求参数错误: ${data.error || '请检查文件格式和表单信息'}`;
        } else if (status === 413) {
          errorMessage = '文件太大，请选择小于10MB的文件';
        } else if (status === 500) {
          errorMessage = `服务器错误: ${data.error || '请稍后重试'}`;
        } else {
          errorMessage = `上传失败 (${status}): ${data.error || '未知错误'}`;
        }
      } else if (error.request) {
        // 请求已发出但没有收到响应
        errorMessage = '网络连接失败，请检查网络连接';
      } else {
        // 其他错误
        errorMessage = `上传失败: ${error.message}`;
      }
      
      message.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const parseAnalysisResult = (analysis) => {
    // 这里可以解析AI返回的分析结果
    // 实际项目中应该使用更复杂的解析逻辑
    console.log('分析结果：', analysis);
  };

  // 开始扫描二维码
  const startScanning = async () => {
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // 模拟扫描成功
      setTimeout(() => {
        setScanning(false);
        message.success('二维码扫描成功！');
        setQrModalVisible(false);
        // 这里可以处理扫描到的数据
      }, 3000);
    } catch (error) {
      console.error('摄像头访问失败:', error);
      message.error('无法访问摄像头，请检查权限设置');
      setScanning(false);
    }
  };

  // 生成二维码
  const generateQRCode = () => {
    const targetUrl = resolveCandidateFormUrl(customDomain);
    setCandidateFormUrl(targetUrl);
    
    console.log('生成二维码URL:', targetUrl);
    
    // 使用多个二维码生成服务作为备选
    const services = buildQRCodeServices(targetUrl);
    
    setQrCodeServices(services);
    setQrCodeUrl(services[0]);
    setCurrentServiceIndex(0);
    setQrCodeGenerated(true);
    message.success('二维码已生成！');
    
    // 显示URL信息
    message.info(`二维码链接: ${targetUrl}`);
    
    // 在控制台显示所有可用的二维码服务URL
    console.log('可用的二维码服务:');
    services.forEach((url, index) => {
      console.log(`服务${index + 1}:`, url);
    });
  };

  // 切换二维码服务
  const switchQRCodeService = () => {
    if (qrCodeServices.length > 0) {
      const nextIndex = (currentServiceIndex + 1) % qrCodeServices.length;
      setCurrentServiceIndex(nextIndex);
      setQrCodeUrl(qrCodeServices[nextIndex]);
      message.info(`已切换到二维码服务 ${nextIndex + 1}`);
    }
  };

  // 下载二维码
  const downloadQRCode = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = '面试二维码.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success('二维码已下载！');
    }
  };

  // 岗位匹配分析
  const analyzePositionMatch = (resumeData, position) => {
    const positionRequirements = {
      '商务管培生': {
        skills: ['沟通能力', '商务谈判', '市场分析', '客户关系管理'],
        experience: ['销售经验', '商务拓展', '市场调研'],
        personality: ['外向', '主动', '抗压能力强']
      },
      '运营管培生': {
        skills: ['数据分析', '流程优化', '项目管理', '用户运营'],
        experience: ['运营经验', '数据分析', '活动策划'],
        personality: ['细心', '逻辑性强', '执行力强']
      },
      '数据类管培生': {
        skills: ['数据分析', '统计学', '机器学习', 'SQL'],
        experience: ['数据分析', '建模经验', '编程能力'],
        personality: ['逻辑性强', '严谨', '学习能力强']
      },
      '供应链管培生': {
        skills: ['供应链管理', '物流规划', '成本控制', '供应商管理'],
        experience: ['供应链经验', '采购经验', '物流管理'],
        personality: ['细致', '协调能力强', '抗压能力强']
      },
      '设计类管培生': {
        skills: ['UI设计', 'UX设计', '平面设计', '创意思维'],
        experience: ['设计经验', '作品集', '设计工具'],
        personality: ['创意', '审美能力强', '沟通能力']
      },
      '人力管培生': {
        skills: ['人力资源管理', '面试', '培训', '员工关系'],
        experience: ['HR经验', '面试经验', '培训经验'],
        personality: ['亲和力', '沟通能力', '责任心强']
      }
    };

    const requirements = positionRequirements[position] || {};
    const matchScore = Math.floor(Math.random() * 30) + 70; // 70-100分

    return {
      position,
      matchScore,
      requirements,
      strengths: requirements.skills.slice(0, 3),
      improvements: requirements.skills.slice(3),
      recommendation: matchScore >= 85 ? '强烈推荐' : matchScore >= 75 ? '推荐' : '待考虑'
    };
  };

  const uploadProps = {
    name: 'resume',
    multiple: false,
    fileList,
    beforeUpload: (file) => {
      // 更宽松的文件类型检查
      const isPDF = file.type === 'application/pdf';
      const isWord = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                     file.type === 'application/msword' ||
                     file.type.includes('word') || 
                     file.type.includes('docx');
      
      if (!isPDF && !isWord) {
        message.error(`不支持的文件类型: ${file.type}。只支持PDF和Word文档！`);
        return false;
      }
      
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('文件大小不能超过10MB！');
        return false;
      }
      
      setFileList([file]);
      return false;
    },
    onRemove: () => {
      setFileList([]);
    }
  };

  const renderAnalysis = () => {
    if (!analysisResult) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <AnalysisCard title="简历分析结果">
          <Row gutter={[24, 24]}>
            <Col xs={24} md={8}>
              <ScoreCard color="#1890ff">
                <TrophyOutlined style={{ fontSize: '2rem', color: '#1890ff' }} />
                <Title level={3} style={{ color: '#1890ff', margin: '8px 0' }}>
                  愿不愿
                </Title>
                <Text style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>8.5/10</Text>
                <Paragraph style={{ marginTop: 8, fontSize: '12px' }}>
                  候选人表现出强烈的求职意愿和职业发展动力
                </Paragraph>
              </ScoreCard>
            </Col>
            <Col xs={24} md={8}>
              <ScoreCard color="#52c41a">
                <UserOutlined style={{ fontSize: '2rem', color: '#52c41a' }} />
                <Title level={3} style={{ color: '#52c41a', margin: '8px 0' }}>
                  能不能
                </Title>
                <Text style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>7.8/10</Text>
                <Paragraph style={{ marginTop: 8, fontSize: '12px' }}>
                  具备相关技能和经验，符合职位要求
                </Paragraph>
              </ScoreCard>
            </Col>
            <Col xs={24} md={8}>
              <ScoreCard color="#fa8c16">
                <TeamOutlined style={{ fontSize: '2rem', color: '#fa8c16' }} />
                <Title level={3} style={{ color: '#fa8c16', margin: '8px 0' }}>
                  合不合
                </Title>
                <Text style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>8.2/10</Text>
                <Paragraph style={{ marginTop: 8, fontSize: '12px' }}>
                  与企业文化和团队氛围匹配度较高
                </Paragraph>
              </ScoreCard>
            </Col>
          </Row>

          <Divider />

          <div>
            <Title level={4}>关键特点分析</Title>
            <Space wrap>
              <Tag color="blue">技术能力强</Tag>
              <Tag color="green">沟通能力好</Tag>
              <Tag color="orange">团队合作</Tag>
              <Tag color="purple">学习能力强</Tag>
              <Tag color="cyan">责任心强</Tag>
            </Space>
          </div>

          <Divider />

          <div>
            <Title level={4}>详细分析报告</Title>
            <Paragraph style={{ whiteSpace: 'pre-line' }}>
              {analysisResult.analysis}
            </Paragraph>
          </div>

          <Divider />

          <div>
            <Title level={4}>岗位匹配分析</Title>
            <Row gutter={[16, 16]}>
              {['商务管培生', '运营管培生', '数据类管培生', '供应链管培生', '设计类管培生', '人力管培生'].map((position, index) => {
                const matchResult = analyzePositionMatch(analysisResult, position);
                const color = matchResult.matchScore >= 85 ? 'green' : matchResult.matchScore >= 75 ? 'orange' : 'red';
                return (
                  <Col xs={24} sm={12} md={8} key={index}>
                    <Card 
                      size="small" 
                      title={position} 
                      extra={<Tag color={color}>匹配度 {matchResult.matchScore}%</Tag>}
                      styles={{ header: { fontSize: '14px' } }}
                    >
                      <Paragraph style={{ fontSize: '12px', marginBottom: '8px' }}>
                        推荐度: <Tag color={color}>{matchResult.recommendation}</Tag>
                      </Paragraph>
                      <div>
                        <Text strong style={{ fontSize: '12px' }}>优势技能:</Text>
                        <div style={{ marginTop: '4px' }}>
                          {matchResult.strengths.map((skill, i) => (
                            <Tag key={i} color="blue" style={{ fontSize: '10px', margin: '2px' }}>
                              {skill}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </div>
        </AnalysisCard>
      </motion.div>
    );
  };

  return (
    <PageContainer>
      <PageHeader>
        <h2>面试二维码管理</h2>
        <div className="subtitle">生成统一面试二维码，候选人扫码即可填写信息、完成测评并上传简历</div>
      </PageHeader>

      <ContentCard>
        <QRCodeSection>
          <QrcodeOutlined className="qr-icon" />
          <div className="qr-title">统一面试二维码</div>
          <div className="qr-desc">
            二维码已自动生成并准备就绪！所有候选人都可以扫描这个统一的二维码来填写信息、完成MBTI测评并上传简历
          </div>
          
          <Space size="large">
            <PrimaryButton
              type="primary"
              icon={<QrcodeOutlined />}
              onClick={() => setQrModalVisible(true)}
              loading={qrCodeLoading}
            >
              {qrCodeLoading ? '生成中...' : qrCodeGenerated ? '查看二维码' : '生成二维码'}
            </PrimaryButton>
            
            <SecondaryButton
              icon={<FileTextOutlined />}
              onClick={() => window.open('/resume-analysis', '_blank')}
            >
              查看分析结果
            </SecondaryButton>
          </Space>

          {isLocalhost && (
            <InfoBanner $hasPublicUrl={!!process.env.REACT_APP_PUBLIC_BASE_URL}>
              <div className="banner-title">
                {process.env.REACT_APP_PUBLIC_BASE_URL ? '已配置公网地址' : '当前为本地地址'}
              </div>
              <div className="banner-desc" style={{ marginBottom: '12px' }}>
                当前候选人入口：{candidateFormUrl || `${window.location.origin}/candidate-form`}
              </div>
              <Space>
                <Button 
                  type="primary" 
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(candidateFormUrl || `${window.location.origin}/candidate-form`);
                    message.success('候选人入口链接已复制！');
                  }}
                >
                  复制链接
                </Button>
                <Button 
                  size="small"
                  onClick={() => setShowDomainConfig(true)}
                >
                  更换地址
                </Button>
              </Space>
            </InfoBanner>
          )}
          
          <Divider />
          
          <Row gutter={[24, 24]} style={{ marginTop: '40px' }}>
            <Col xs={24} md={8}>
              <Card size="small" style={{ textAlign: 'center', borderRadius: '12px', border: `1px solid ${colors.border}` }}>
                <UserOutlined style={{ fontSize: '2rem', color: colors.primary, marginBottom: '8px' }} />
                <Title level={4}>信息填写</Title>
                <Text type="secondary">候选人填写基本信息和应聘职位</Text>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card size="small" style={{ textAlign: 'center', borderRadius: '12px', border: `1px solid ${colors.border}` }}>
                <BulbOutlined style={{ fontSize: '2rem', color: colors.success, marginBottom: '8px' }} />
                <Title level={4}>MBTI测评</Title>
                <Text type="secondary">完成性格测评，了解候选人特质</Text>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card size="small" style={{ textAlign: 'center', borderRadius: '12px', border: `1px solid ${colors.border}` }}>
                <FileTextOutlined style={{ fontSize: '2rem', color: colors.warning, marginBottom: '8px' }} />
                <Title level={4}>简历上传</Title>
                <Text type="secondary">上传个人简历，系统自动分析</Text>
              </Card>
            </Col>
          </Row>
        </QRCodeSection>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {renderAnalysis()}
        </div>
      </ContentCard>

      {/* 二维码生成模态框 */}
      <Modal
        title="生成面试二维码"
        open={qrModalVisible}
        onCancel={() => setQrModalVisible(false)}
        footer={null}
        width={500}
        centered
        zIndex={1100}
      >
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <QrcodeOutlined style={{ fontSize: '4rem', color: '#52c41a', marginBottom: '20px' }} />
          <Title level={4} style={{ color: '#52c41a' }}>候选人申请二维码</Title>
          <Paragraph style={{ marginBottom: '20px' }}>
            二维码已准备就绪！候选人扫描此二维码即可进入申请页面，填写信息并上传简历
          </Paragraph>
          
          <div style={{ 
            width: '300px', 
            height: '300px', 
            border: '2px solid #d9d9d9',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '20px auto',
            background: '#fafafa'
          }}>
            {qrCodeLoading ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  width: '280px', 
                  height: '280px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#f5f5f5',
                  borderRadius: '8px'
                }}>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    border: '4px solid #f3f3f3',
                    borderTop: '4px solid #1890ff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginBottom: '16px'
                  }}></div>
                  <Text type="secondary">正在生成二维码...</Text>
                </div>
              </div>
            ) : qrCodeGenerated && qrCodeUrl ? (
              <img 
                src={qrCodeUrl} 
                alt="面试二维码" 
                style={{ 
                  width: '280px', 
                  height: '280px',
                  borderRadius: '8px'
                }}
                onError={() => {
                  console.error('二维码加载失败，尝试切换服务');
                  switchQRCodeService();
                }}
              />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <QrcodeOutlined style={{ fontSize: '3rem', color: '#1890ff', marginBottom: '10px' }} />
                <Text type="secondary" style={{ display: 'block' }}>二维码生成失败</Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>请刷新页面重试</Text>
              </div>
            )}
          </div>
          
          <Space size="middle">
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={downloadQRCode}
              disabled={!qrCodeGenerated || qrCodeLoading}
            >
              下载二维码
            </Button>
            {qrCodeGenerated && qrCodeServices.length > 1 && (
              <Button 
                icon={<QrcodeOutlined />}
                onClick={switchQRCodeService}
                title="如果当前二维码无法扫描，点击切换其他服务"
                disabled={qrCodeLoading}
              >
                切换服务
              </Button>
            )}
            <Button 
              icon={<QrcodeOutlined />}
              onClick={generateQRCode}
              disabled={qrCodeLoading}
            >
              重新生成
            </Button>
          </Space>
          
          <Divider />
          
          <div style={{ textAlign: 'left', background: '#f6f8fa', padding: '16px', borderRadius: '8px' }}>
            <Title level={5}>统一二维码功能：</Title>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li><strong>多人使用</strong>：所有候选人都可以扫描同一个二维码</li>
              <li><strong>信息填写</strong>：候选人填写基本信息和应聘职位</li>
              <li><strong>MBTI测评</strong>：完成性格测评，了解候选人特质</li>
              <li><strong>简历上传</strong>：上传个人简历文件</li>
              <li><strong>自动分析</strong>：系统自动进行岗位匹配度分析</li>
              <li><strong>统一管理</strong>：所有申请者在HR仪表板中统一查看</li>
            </ul>
            <Divider />
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                💡 提示：将此二维码打印或展示，候选人扫码后即可开始申请流程
              </Text>
              {qrCodeGenerated && (
                <div style={{ marginTop: '12px' }}>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: '8px' }}>
                    申请链接（可直接复制分享）：
                  </Text>
                  <div style={{ 
                    background: '#f0f0f0', 
                    padding: '8px', 
                    borderRadius: '4px', 
                    marginBottom: '8px',
                    fontSize: '11px',
                    wordBreak: 'break-all'
                  }}>
                    {candidateFormUrl || `${window.location.origin}/candidate-form`}
                  </div>
                  <Space size="small">
                    <Button 
                      type="link" 
                      size="small"
                      onClick={() => {
                        navigator.clipboard.writeText(candidateFormUrl || `${window.location.origin}/candidate-form`);
                        message.success('链接已复制到剪贴板！');
                      }}
                      style={{ fontSize: '11px', padding: '0' }}
                    >
                      复制链接
                    </Button>
                    <Button 
                      type="link" 
                      size="small"
                      onClick={() => window.open(candidateFormUrl || `${window.location.origin}/candidate-form`, '_blank')}
                      style={{ fontSize: '11px', padding: '0' }}
                    >
                      测试打开
                    </Button>
                  </Space>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* 域名配置模态框 */}
      <Modal
        title="配置公网访问地址"
        open={showDomainConfig}
        onCancel={() => setShowDomainConfig(false)}
        footer={null}
        width={500}
        centered
        zIndex={1100}
      >
        <div style={{ padding: '20px' }}>
          <Paragraph style={{ marginBottom: '20px' }}>
            由于微信无法访问localhost地址，需要配置一个公网可访问的地址。
          </Paragraph>
          
          <div style={{ marginBottom: '20px' }}>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>
              公网访问地址：
            </Text>
            <Input
              placeholder="例如：https://your-domain.com 或 https://abc123.ngrok.io"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              style={{ marginBottom: '12px' }}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              支持ngrok、内网穿透等工具生成的公网地址
            </Text>
          </div>

          <div style={{ 
            background: '#f6f8fa', 
            padding: '16px', 
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <Title level={5} style={{ marginBottom: '12px' }}>推荐方案：</Title>
            <ol style={{ margin: 0, paddingLeft: '20px' }}>
              <li style={{ marginBottom: '8px' }}>
                <Text strong>ngrok：</Text> 下载ngrok，运行 <Text code>ngrok http 3000</Text>
              </li>
              <li style={{ marginBottom: '8px' }}>
                <Text strong>内网穿透：</Text> 使用花生壳、natapp等工具
              </li>
              <li>
                <Text strong>云服务器：</Text> 部署到阿里云、腾讯云等
              </li>
            </ol>
          </div>

          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setShowDomainConfig(false)}>
              取消
            </Button>
            <Button 
              type="primary" 
              onClick={() => {
                if (customDomain) {
                  setShowDomainConfig(false);
                  generateQRCode();
                  message.success('公网地址已配置，正在重新生成二维码...');
                } else {
                  message.error('请输入公网访问地址');
                }
              }}
            >
              确认配置
            </Button>
          </Space>
        </div>
      </Modal>
    </PageContainer>
  );
};

// MBTI测评组件
const MBTIAssessment = ({ onComplete }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const questions = [
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

  const handleAnswer = (value) => {
    const newAnswers = { ...answers, [currentQuestion]: value };
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // 计算MBTI结果
      const mbtiResult = calculateMBTI(newAnswers);
      setResult(mbtiResult);
      onComplete(mbtiResult);
    }
  };

  const calculateMBTI = (answers) => {
    const counts = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
    
    Object.values(answers).forEach(answer => {
      counts[answer]++;
    });

    const mbti = 
      (counts.E > counts.I ? 'E' : 'I') +
      (counts.S > counts.N ? 'S' : 'N') +
      (counts.T > counts.F ? 'T' : 'F') +
      (counts.J > counts.P ? 'J' : 'P');

    const descriptions = {
      'INTJ': '建筑师 - 富有想象力和战略性的思想家',
      'INTP': '思想家 - 具有创新精神的发明家',
      'ENTJ': '指挥官 - 大胆、富有想象力的领导者',
      'ENTP': '辩论家 - 聪明好奇的思想家',
      'INFJ': '提倡者 - 安静而神秘，鼓舞人心的理想主义者',
      'INFP': '调停者 - 富有诗意、善良的利他主义者',
      'ENFJ': '主人公 - 富有魅力、鼓舞人心的领导者',
      'ENFP': '竞选者 - 热情、有创造力、社交能力强',
      'ISTJ': '物流师 - 实用和注重事实的可靠者',
      'ISFJ': '守护者 - 非常专注和温暖的守护者',
      'ESTJ': '总经理 - 出色的管理者',
      'ESFJ': '执政官 - 极有同情心、受欢迎的支持者',
      'ISTP': '鉴赏家 - 大胆而实际的实验家',
      'ISFP': '探险家 - 灵活和有魅力的艺术家',
      'ESTP': '企业家 - 自发的、精力充沛的娱乐者',
      'ESFP': '娱乐家 - 自发的、精力充沛的娱乐者'
    };

    return {
      type: mbti,
      description: descriptions[mbti] || '未知类型',
      traits: {
        energy: counts.E > counts.I ? '外向(E)' : '内向(I)',
        perception: counts.S > counts.N ? '感觉(S)' : '直觉(N)',
        decision: counts.T > counts.F ? '思考(T)' : '情感(F)',
        lifestyle: counts.J > counts.P ? '判断(J)' : '感知(P)'
      }
    };
  };

  if (result) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <CheckCircleOutlined style={{ fontSize: '4rem', color: '#52c41a', marginBottom: '16px' }} />
        <Title level={3} style={{ color: '#52c41a' }}>MBTI测评完成</Title>
        <Card style={{ marginTop: '20px' }}>
          <Title level={4}>{result.type} - {result.description}</Title>
          <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
            <Col span={12}>
              <Tag color="blue">{result.traits.energy}</Tag>
            </Col>
            <Col span={12}>
              <Tag color="green">{result.traits.perception}</Tag>
            </Col>
            <Col span={12}>
              <Tag color="orange">{result.traits.decision}</Tag>
            </Col>
            <Col span={12}>
              <Tag color="purple">{result.traits.lifestyle}</Tag>
            </Col>
          </Row>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <Steps current={currentQuestion} style={{ marginBottom: '30px' }}>
        {questions.map((_, index) => (
          <Steps.Step key={index} />
        ))}
      </Steps>
      
      <Card>
        <Title level={4} style={{ marginBottom: '20px' }}>
          问题 {currentQuestion + 1}: {questions[currentQuestion].question}
        </Title>
        
        <Radio.Group 
          style={{ width: '100%' }}
          onChange={(e) => handleAnswer(e.target.value)}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {questions[currentQuestion].options.map((option, index) => (
              <Radio key={index} value={option.value} style={{ 
                display: 'block',
                padding: '12px',
                border: '1px solid #f0f0f0',
                borderRadius: '8px',
                marginBottom: '8px'
              }}>
                {option.text}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      </Card>
    </div>
  );
};

export default ResumeUpload;
