import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Upload, Button, List, Spin, message, Card } from 'antd';
import { InboxOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { colors } from '../theme/colors';

const { Dragger } = Upload;

const PageWrapper = styled.div`
  background: ${colors.bg};
  min-height: 100vh;
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  padding: 60px;
`;

const PageInner = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const PageHeader = styled.div`
  margin-bottom: 48px;
`;

const SectionLabel = styled.span`
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${colors.textMuted};
  display: block;
  margin-bottom: 24px;
`;

const PageTitle = styled.h1`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 36px;
  font-weight: 400;
  color: ${colors.text};
  margin: 0 0 16px 0;
`;

const PageSubtitle = styled.p`
  font-size: 16px;
  color: ${colors.textMuted};
  margin: 0;
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 48px;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const LeftPanel = styled.div``;

const RightPanel = styled.div``;

const CardStyled = styled(Card)`
  background: ${colors.surface};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  box-shadow: 0 1px 3px ${colors.shadow};

  .ant-card-head {
    border-bottom: 1px solid ${colors.border};
    min-height: 56px;
  }

  .ant-card-head-title {
    font-family: 'Noto Sans SC', sans-serif;
    font-weight: 500;
  }
`;

const UploadCard = styled(CardStyled)`
  margin-bottom: 24px;
`;

const ResultCard = styled(CardStyled)`
  .optimized-content {
    background: ${colors.frost};
    border-radius: 8px;
    padding: 24px;
    margin-top: 16px;
  }

  .content-section {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .section-title {
    font-weight: 500;
    color: ${colors.text};
    margin-bottom: 8px;
    font-size: 14px;
  }

  .section-text {
    color: ${colors.textSecondary};
    font-size: 14px;
    line-height: 1.7;
    white-space: pre-wrap;
  }

  .score-badge {
    display: inline-block;
    background: ${colors.accentSub};
    color: ${colors.accent};
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 16px;
  }
`;

const UploadArea = styled.div`
  .ant-upload-drag {
    border: 2px dashed ${colors.border};
    border-radius: 8px;
    background: ${colors.frost};
    transition: all 0.3s ease;

    &:hover {
      border-color: ${colors.accent};
    }
  }

  .ant-upload-drag-icon {
    color: ${colors.accent};
  }

  .ant-upload-text {
    font-size: 16px;
    font-weight: 500;
    color: ${colors.text};
    margin-bottom: 8px;
  }

  .ant-upload-hint {
    color: ${colors.textMuted};
    font-size: 14px;
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  text-align: center;
`;

const LoadingText = styled.p`
  margin-top: 16px;
  color: ${colors.textMuted};
  font-size: 14px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: ${colors.textMuted};

  .empty-icon {
    font-size: 48px;
    color: ${colors.border};
    margin-bottom: 16px;
  }
`;

const HistoryItem = styled.div`
  padding: 16px;
  border-bottom: 1px solid ${colors.border};
  cursor: pointer;
  transition: background 0.2s ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${colors.frost};
  }

  .file-name {
    font-weight: 500;
    color: ${colors.text};
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .file-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: ${colors.textMuted};
  }

  .score {
    color: ${colors.accent};
    font-weight: 500;
  }

  .status {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;

    &.completed {
      background: ${colors.accentSub};
      color: ${colors.accent};
    }

    &.processing {
      background: ${colors.warning}20;
      color: ${colors.warning};
    }

    &.failed {
      background: ${colors.error}20;
      color: ${colors.error};
    }
  }
`;

const PersonalResumePage = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/personal/resume/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data || []);
    } catch (error) {
      console.error('获取历史记录失败:', error);
      message.error('获取历史记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    const isPdf = file.type === 'application/pdf';
    const isDoc = file.type === 'application/msword' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (!isPdf && !isDoc) {
      message.error('仅支持 PDF 或 Word 文档');
      return false;
    }

    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超过 10MB');
      return false;
    }

    setSelectedFile(file);
    setOptimizing(true);
    setResult(null);

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
      message.success('简历优化完成');
      fetchHistory();
    } catch (error) {
      console.error('上传失败:', error);
      message.error(error.response?.data?.message || '上传失败，请重试');
    } finally {
      setOptimizing(false);
    }

    return false;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'completed':
        return 'completed';
      case 'processing':
        return 'processing';
      default:
        return 'failed';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'processing':
        return '处理中';
      default:
        return '失败';
    }
  };

  const renderOptimizedContent = () => {
    if (!result || !result.optimized_content) {
      return (
        <EmptyState>
          <div className="empty-icon">
            <FileTextOutlined />
          </div>
          <p>暂无优化结果</p>
        </EmptyState>
      );
    }

    const content = result.optimized_content;

    return (
      <div className="optimized-content">
        {result.resume_score && (
          <div className="score-badge">简历评分: {result.resume_score}</div>
        )}

        {content.summary && (
          <div className="content-section">
            <div className="section-title">简历摘要</div>
            <div className="section-text">{content.summary}</div>
          </div>
        )}

        {content.strengths && content.strengths.length > 0 && (
          <div className="content-section">
            <div className="section-title">优势亮点</div>
            <div className="section-text">
              {content.strengths.map((item, index) => (
                <div key={index}>• {item}</div>
              ))}
            </div>
          </div>
        )}

        {content.suggestions && content.suggestions.length > 0 && (
          <div className="content-section">
            <div className="section-title">优化建议</div>
            <div className="section-text">
              {content.suggestions.map((item, index) => (
                <div key={index}>• {item}</div>
              ))}
            </div>
          </div>
        )}

        {content.improved_version && (
          <div className="content-section">
            <div className="section-title">优化后版本</div>
            <div className="section-text">{content.improved_version}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageWrapper>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500&family=Noto+Sans+SC:wght@300;400;500&family=JetBrains+Mono:wght@400&family=Cabinet+Grotesk:wght@400;500;700&display=swap');

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

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
          }

          @media (max-width: 768px) {
            ${PageWrapper} {
              padding: 24px;
            }
          }
        `}
      </style>

      <PageInner>
        <PageHeader>
          <SectionLabel>个人服务</SectionLabel>
          <PageTitle>简历优化</PageTitle>
          <PageSubtitle>上传您的简历，AI将分析内容并提供专业的优化建议</PageSubtitle>
        </PageHeader>

        <ContentGrid>
          <LeftPanel>
            <UploadCard
              title="上传简历"
              extra={<span style={{ color: colors.textMuted, fontSize: 12 }}>支持 PDF、Word 格式，最大 10MB</span>}
            >
              <Dragger
                name="file"
                multiple={false}
                showUploadList={false}
                beforeUpload={handleFileUpload}
                disabled={optimizing || uploading}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                <p className="ant-upload-hint">
                  {selectedFile ? `已选择: ${selectedFile.name}` : '支持 PDF 和 Word 文档'}
                </p>
              </Dragger>

              {selectedFile && !optimizing && !result && (
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <Button
                    type="primary"
                    icon={<UploadOutlined />}
                    onClick={() => handleFileUpload(selectedFile)}
                  >
                    开始优化
                  </Button>
                </div>
              )}
            </UploadCard>

            {optimizing && (
              <CardStyled title="优化结果">
                <LoadingContainer>
                  <Spin size="large" />
                  <LoadingText>AI 正在分析您的简历，请稍候...</LoadingText>
                </LoadingContainer>
              </CardStyled>
            )}

            {!optimizing && result && (
              <ResultCard title="优化结果">
                {renderOptimizedContent()}

                <div style={{ marginTop: 24, textAlign: 'center' }}>
                  <Button
                    onClick={() => {
                      setSelectedFile(null);
                      setResult(null);
                    }}
                  >
                    重新上传
                  </Button>
                </div>
              </ResultCard>
            )}

            {!optimizing && !result && (
              <CardStyled title="优化结果">
                <EmptyState>
                  <div className="empty-icon">
                    <FileTextOutlined />
                  </div>
                  <p>上传简历后将在此显示优化结果</p>
                </EmptyState>
              </CardStyled>
            )}
          </LeftPanel>

          <RightPanel>
            <CardStyled title="历史记录">
              {loading ? (
                <LoadingContainer>
                  <Spin size="small" />
                </LoadingContainer>
              ) : history.length === 0 ? (
                <EmptyState>
                  <div className="empty-icon">
                    <FileTextOutlined />
                  </div>
                  <p>暂无历史记录</p>
                </EmptyState>
              ) : (
                <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                  {history.map((item) => (
                    <HistoryItem
                      key={item.id}
                      onClick={() => {
                        if (item.status === 'completed' && item.optimized_content) {
                          setResult({
                            resume_score: item.resume_score,
                            optimized_content: item.optimized_content
                          });
                        }
                      }}
                    >
                      <div className="file-name">
                        <FileTextOutlined />
                        {item.original_file_name}
                      </div>
                      <div className="file-meta">
                        <span className={`status ${getStatusClass(item.status)}`}>
                          {getStatusText(item.status)}
                        </span>
                        {item.resume_score && (
                          <span className="score">评分: {item.resume_score}</span>
                        )}
                      </div>
                      <div className="file-meta" style={{ marginTop: 8 }}>
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                    </HistoryItem>
                  ))}
                </div>
              )}
            </CardStyled>
          </RightPanel>
        </ContentGrid>
      </PageInner>
    </PageWrapper>
  );
};

export default PersonalResumePage;