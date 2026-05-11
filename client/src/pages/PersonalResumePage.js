import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { Upload, Button, Spin, Modal } from 'antd';
import { App } from 'antd';
import {
  InboxOutlined,
  FileTextOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
  CloseOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

const { Dragger } = Upload;

// ============================================
// PAGE WRAPPER
// ============================================
const PageWrapper = styled.div`
  background: ${colors.bg};
  min-height: 100vh;
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
`;

// ============================================
// HERO SECTION
// ============================================
const HeroSection = styled.section`
  padding: 120px 60px 60px;
  background: ${colors.bg};
  max-width: 1200px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 100px 24px 40px;
  }
`;

const HeroTitle = styled(motion.h1)`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: clamp(32px, 4vw, 48px);
  font-weight: 400;
  color: ${colors.text};
  line-height: 1.3;
  margin: 0 0 16px 0;
`;

const HeroDesc = styled(motion.p)`
  font-size: 16px;
  color: ${colors.textMuted};
  line-height: 1.7;
  margin: 0 0 48px 0;
  max-width: 600px;
`;

// ============================================
// UPLOAD AREA
// ============================================
const UploadContainer = styled(motion.div)`
  background: ${colors.surface};
  border-radius: 16px;
  border: 1px solid ${colors.border};
  padding: 32px;
  margin-bottom: 60px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.03);
`;

const UploadArea = styled.div`
  .ant-upload-drag {
    border: 2px dashed ${colors.border};
    border-radius: 12px;
    background: ${colors.frost};
    transition: all 0.3s ease;
    padding: 40px 24px;

    &:hover {
      border-color: ${colors.accent};
      background: ${colors.accentSub};
    }
  }

  .ant-upload-drag-icon .anticon {
    font-size: 40px;
    color: ${colors.accent};
  }

  .ant-upload-text {
    font-size: 15px;
    font-weight: 500;
    color: ${colors.text};
    margin-top: 16px;
  }

  .ant-upload-hint {
    color: ${colors.textMuted};
    font-size: 13px;
    margin-top: 8px;
  }
`;

// ============================================
// RESULT SECTION
// ============================================
const ResultSection = styled.section`
  padding: 0 60px 60px;
  background: ${colors.bg};
  max-width: 1200px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 0 24px 40px;
  }
`;

const ResultContainer = styled(motion.div)`
  background: ${colors.surface};
  border-radius: 16px;
  border: 1px solid ${colors.border};
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.03);
`;

const ResultHeader = styled.div`
  padding: 24px 32px;
  border-bottom: 1px solid ${colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: ${colors.frost};
`;

const ResultTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: ${colors.text};
  display: flex;
  align-items: center;
  gap: 10px;
`;

const ResultBody = styled.div`
  padding: 32px;
`;

const ContentBlock = styled.div`
  margin-bottom: 32px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const BlockTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${colors.text};
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;

  .anticon {
    color: ${colors.accent};
  }
`;

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ItemCard = styled.div`
  background: ${colors.frost};
  border-radius: 10px;
  padding: 16px 20px;
  font-size: 14px;
  color: ${colors.text};
  line-height: 1.6;
  border-left: 3px solid ${colors.accent};
`;

const SuggestionCard = styled.div`
  background: ${colors.frost};
  border-radius: 10px;
  padding: 16px 20px;
  font-size: 14px;
  color: ${colors.text};
  line-height: 1.6;
  border-left: 3px solid #f59e0b;
`;

// ============================================
// HISTORY SECTION
// ============================================
const HistorySection = styled.section`
  padding: 0 60px 80px;
  background: ${colors.bg};
  max-width: 1200px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 0 24px 60px;
  }
`;

const SectionLabel = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: ${colors.textMuted};
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 24px;
`;

const HistoryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
`;

const HistoryCard = styled(motion.div)`
  background: ${colors.surface};
  border-radius: 12px;
  border: 1px solid ${colors.border};
  padding: 20px;
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    border-color: ${colors.accent};
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
    transform: translateY(-2px);
  }
`;

const HistoryHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;

const HistoryIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: ${colors.accentSub};
  display: flex;
  align-items: center;
  justify-content: center;

  .anticon {
    font-size: 16px;
    color: ${colors.accent};
  }
`;

const HistoryName = styled.div`
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: ${colors.text};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const HistoryDate = styled.div`
  font-size: 12px;
  color: ${colors.textMuted};
`;

const HistoryActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid ${colors.border};
`;

// ============================================
// MODAL STYLES
// ============================================
const ModalContent = styled.div`
  padding: 0;
`;

const ModalBlock = styled.div`
  margin-bottom: 28px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const ModalBlockTitle = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: ${colors.text};
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;

  .anticon {
    font-size: 18px;
  }
`;

const ModalItem = styled.div`
  background: ${colors.frost};
  border-radius: 8px;
  padding: 14px 18px;
  font-size: 14px;
  color: ${colors.text};
  line-height: 1.6;
  margin-bottom: 10px;

  &:last-child {
    margin-bottom: 0;
  }
`;

// ============================================
// LOADING & EMPTY STATES
// ============================================
const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
`;

const LoadingText = styled.div`
  margin-top: 20px;
  font-size: 14px;
  color: ${colors.textMuted};
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  color: ${colors.textMuted};
  font-size: 14px;
`;

// ============================================
// COMPONENT
// ============================================
const PersonalResumePage = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedResume, setSelectedResume] = useState(null);
  const getToken = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      message.error('登录已过期，请重新登录');
      logout();
      navigate('/login');
      return null;
    }
    return token;
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await axios.get('/api/personal/resume/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data || []);
    } catch (error) {
      if (error.response?.status === 401) {
        message.error('登录已过期，请重新登录');
        logout();
        navigate('/login');
        return;
      }
      setHistory([]);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    const isPdf = file.type === 'application/pdf';
    const isDoc = file.type === 'application/msword' ||
                  file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (!isPdf && !isDoc) {
      message.error('仅支持 PDF 或 Word 文档');
      return false;
    }

    if (file.size / 1024 / 1024 >= 10) {
      message.error('文件大小不能超过 10MB');
      return false;
    }

    setSelectedFile(file);
    setAnalyzing(true);
    setResult(null);

    const token = getToken();
    if (!token) {
      setAnalyzing(false);
      return false;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/api/personal/resume/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setResult(res.data);
      message.success('简历分析完成');
      fetchHistory();
    } catch (error) {
      if (error.response?.status === 401) {
        message.error('登录已过期，请重新登录');
        logout();
        navigate('/login');
      } else {
        message.error(error.response?.data?.message || '分析失败，请重试');
      }
    } finally {
      setAnalyzing(false);
    }

    return false;
  };

  const fetchResumeDetail = async (id) => {
    const token = getToken();
    if (!token) return null;
    try {
      const res = await axios.get(`/api/personal/resume/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    } catch (error) {
      if (error.response?.status === 401) {
        message.error('登录已过期，请重新登录');
        logout();
        navigate('/login');
        return null;
      }
      message.error('获取详情失败');
      return null;
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    const token = getToken();
    if (!token) return;
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这份简历吗？',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await axios.delete(`/api/personal/resume/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          message.success('删除成功');
          fetchHistory();
          if (selectedResume?.id === id) {
            setModalVisible(false);
            setSelectedResume(null);
          }
        } catch (error) {
          if (error.response?.status === 401) {
            message.error('登录已过期，请重新登录');
            logout();
            navigate('/login');
          } else {
            message.error('删除失败');
          }
        }
      }
    });
  };

  const handleViewHistory = async (item) => {
    const detail = await fetchResumeDetail(item.id);
    if (detail) {
      setSelectedResume(detail);
      setModalVisible(true);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 渲染结果内容
  const renderResultContent = (data) => {
    const content = data?.optimized_content;
    if (!content) {
      return <EmptyState>暂无分析结果</EmptyState>;
    }

    return (
      <>
        {content.highlights && content.highlights.length > 0 && (
          <ContentBlock>
            <BlockTitle>
              <BulbOutlined />
              简历亮点
            </BlockTitle>
            <ItemList>
              {content.highlights.map((item, index) => (
                <ItemCard key={index}>{item}</ItemCard>
              ))}
            </ItemList>
          </ContentBlock>
        )}

        {content.suggestions && content.suggestions.length > 0 && (
          <ContentBlock>
            <BlockTitle>
              <ThunderboltOutlined />
              优化建议
            </BlockTitle>
            <ItemList>
              {content.suggestions.map((item, index) => (
                <SuggestionCard key={index}>{item}</SuggestionCard>
              ))}
            </ItemList>
          </ContentBlock>
        )}
      </>
    );
  };

  // Modal 内容
  const renderModalContent = () => {
    const content = selectedResume?.optimized_content;
    if (!content) {
      return <EmptyState>暂无分析结果</EmptyState>;
    }

    return (
      <ModalContent>
        {content.highlights && content.highlights.length > 0 && (
          <ModalBlock>
            <ModalBlockTitle>
              <BulbOutlined style={{ color: colors.accent }} />
              简历亮点
            </ModalBlockTitle>
            {content.highlights.map((item, index) => (
              <ModalItem key={index}>{item}</ModalItem>
            ))}
          </ModalBlock>
        )}

        {content.suggestions && content.suggestions.length > 0 && (
          <ModalBlock>
            <ModalBlockTitle>
              <ThunderboltOutlined style={{ color: '#f59e0b' }} />
              优化建议
            </ModalBlockTitle>
            {content.suggestions.map((item, index) => (
              <ModalItem key={index}>{item}</ModalItem>
            ))}
          </ModalBlock>
        )}
      </ModalContent>
    );
  };

  return (
    <PageWrapper>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500&family=Noto+Sans+SC:wght@300;400;500&display=swap');

          ::selection {
            background: ${colors.highlight};
            color: #FFFFFF;
          }

          ::-webkit-scrollbar {
            width: 6px;
          }

          ::-webkit-scrollbar-track {
            background: ${colors.bg};
          }

          ::-webkit-scrollbar-thumb {
            background: ${colors.border};
            border-radius: 3px;
          }
        `}
      </style>

      {/* Hero Section */}
      <HeroSection>
        <HeroTitle
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          简历优化建议
        </HeroTitle>
        <HeroDesc
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          上传您的简历，AI 将分析内容并给出专业的亮点总结与优化建议，帮助您提升简历竞争力。
        </HeroDesc>

        <UploadContainer
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <UploadArea>
            <Dragger
              name="file"
              multiple={false}
              showUploadList={false}
              beforeUpload={handleFileUpload}
              disabled={analyzing}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                {selectedFile ? selectedFile.name : '点击或拖拽文件到此区域上传'}
              </p>
              <p className="ant-upload-hint">
                支持 PDF、Word 文档，最大 10MB
              </p>
            </Dragger>
          </UploadArea>
        </UploadContainer>
      </HeroSection>

      {/* Result Section */}
      <ResultSection>
        <AnimatePresence mode="wait">
          {analyzing ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ResultContainer>
                <LoadingState>
                  <Spin size="large" />
                  <LoadingText>AI 正在分析您的简历...</LoadingText>
                </LoadingState>
              </ResultContainer>
            </motion.div>
          ) : result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <ResultContainer>
                <ResultHeader>
                  <ResultTitle>
                    <FileTextOutlined />
                    {result.original_file_name || '分析结果'}
                  </ResultTitle>
                  <Button
                    type="text"
                    icon={<CloseOutlined />}
                    onClick={() => {
                      setSelectedFile(null);
                      setResult(null);
                    }}
                  >
                    清除
                  </Button>
                </ResultHeader>
                <ResultBody>
                  {renderResultContent(result)}
                </ResultBody>
              </ResultContainer>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </ResultSection>

      {/* History Section */}
      {history.length > 0 && (
        <HistorySection>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <SectionLabel>历史记录 ({history.length})</SectionLabel>
          </motion.div>

          <HistoryGrid>
            {history.map((item, index) => (
              <HistoryCard
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                onClick={() => handleViewHistory(item)}
              >
                <HistoryHeader>
                  <HistoryIcon>
                    <FileTextOutlined />
                  </HistoryIcon>
                  <HistoryName>{item.original_file_name}</HistoryName>
                </HistoryHeader>
                <HistoryDate>{formatDate(item.created_at)}</HistoryDate>
                <HistoryActions>
                  <span style={{ fontSize: 12, color: colors.textMuted }}>
                    点击查看详情
                  </span>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => handleDelete(item.id, e)}
                  />
                </HistoryActions>
              </HistoryCard>
            ))}
          </HistoryGrid>
        </HistorySection>
      )}

      {/* Detail Modal */}
      <Modal
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setSelectedResume(null);
        }}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined style={{ color: colors.accent }} />
            {selectedResume?.original_file_name || '简历分析报告'}
          </span>
        }
        footer={null}
        width={600}
        centered
      >
        {renderModalContent()}
      </Modal>
    </PageWrapper>
  );
};

export default PersonalResumePage;
