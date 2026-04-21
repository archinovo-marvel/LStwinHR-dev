import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginPromptModal from '../components/LoginPromptModal';

// Custom SVG Icons
const IconQR = ({ size = 22, color, strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || '#4A9ECF'} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h2v2h2v2h-2v2h-2" />
  </svg>
);

const IconDocument = ({ size = 22, color, strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || '#4A9ECF'} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="12" y2="17" />
  </svg>
);

const IconUser = ({ size = 22, color, strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || '#4A9ECF'} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconLightbulb = ({ size = 22, color, strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || '#4A9ECF'} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
  </svg>
);

const IconDownload = ({ size = 22, color, strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || '#4A9ECF'} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconLink = ({ size = 18, color, strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || '#4A9ECF'} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const IconCheck = ({ size = 18, color, strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || '#4A9ECF'} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

import { colors } from '../theme/colors';

const PageWrapper = styled.div`
  background: ${colors.bg};
  min-height: 100vh;
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
`;

const PageHeader = styled.header`
  padding: 120px 60px 32px;
  border-bottom: 1px solid ${colors.border};
`;

const HeaderInner = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const SectionLabel = styled.span`
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${colors.textMuted};
  display: block;
  margin-bottom: 12px;
`;

const PageTitle = styled.h1`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: clamp(32px, 4vw, 48px);
  font-weight: 400;
  color: ${colors.text};
  margin: 0 0 16px 0;
  line-height: 1.2;
`;

const PageSubtitle = styled.p`
  font-size: 16px;
  color: ${colors.textMuted};
  margin: 0;
  max-width: 600px;
  line-height: 1.6;
`;

const MainContent = styled.main`
  max-width: 1400px;
  margin: 0 auto;
  padding: 60px;
`;

const Section = styled.section`
  margin-bottom: 60px;
`;

const Card = styled.div`
  background: #FFFFFF;
  border: 1px solid ${colors.border};
  border-radius: 16px;
  padding: 48px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, ${colors.highlight}, ${colors.accent});
  }
`;

const QRDisplaySection = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const QRCodeBox = styled.div`
  background: ${colors.bgSecondary};
  border-radius: 12px;
  padding: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 380px;
  position: relative;
`;

const QRPlaceholder = styled.div`
  width: 280px;
  height: 280px;
  border-radius: 12px;
  background: ${colors.bg};
  border: 2px dashed ${colors.border};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
`;

const QRServiceSelector = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 20px;
  flex-wrap: wrap;
  justify-content: center;
`;

const ServiceButton = styled.button`
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  border: 1px solid ${props => props.$active ? colors.highlight : colors.border};
  background: ${props => props.$active ? colors.highlight : 'transparent'};
  color: ${props => props.$active ? '#FFFFFF' : colors.textMuted};
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    border-color: ${colors.highlight};
    color: ${props => props.$active ? '#FFFFFF' : colors.highlight};
  }
`;

const QRInfoPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const InfoItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: ${props => props.$highlight ? 'rgba(139, 115, 85, 0.08)' : colors.bgSecondary};
  border-radius: 12px;
  border: 1px solid ${props => props.$highlight ? 'rgba(139, 115, 85, 0.2)' : 'transparent'};
`;

const InfoIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${props => props.$color || colors.accent};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .anticon {
    font-size: 22px;
    color: #FFFFFF;
  }
`;

const InfoContent = styled.div`
  flex: 1;
`;

const InfoTitle = styled.h4`
  font-size: 15px;
  font-weight: 500;
  color: ${colors.text};
  margin: 0 0 4px 0;
`;

const InfoText = styled.p`
  font-size: 13px;
  color: ${colors.textMuted};
  margin: 0;
  line-height: 1.5;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const PrimaryButton = styled(motion.button)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 28px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 400;
  background: ${colors.accent};
  color: #FFFFFF;
  border: none;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    background: ${colors.highlight};
  }

  &:active {
    transform: scale(0.98);
  }

  .anticon {
    font-size: 16px;
  }
`;

const SecondaryButton = styled(motion.button)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 28px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 400;
  background: transparent;
  color: ${colors.text};
  border: 1px solid ${colors.border};
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    border-color: ${colors.highlight};
    color: ${colors.highlight};
  }

  &:active {
    transform: scale(0.98);
  }

  .anticon {
    font-size: 16px;
  }
`;

const ProcessFlow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-top: 40px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ProcessStep = styled(motion.div)`
  text-align: center;
  padding: 32px 24px;
  background: ${colors.bg};
  border-radius: 12px;
  border: 1px solid ${colors.border};
  position: relative;

  &::after {
    content: '';
    position: absolute;
    right: -12px;
    top: 50%;
    width: 24px;
    height: 1px;
    background: ${colors.border};
    display: ${props => props.$last ? 'none' : 'block'};

    @media (max-width: 768px) {
      display: none;
    }
  }
`;

const StepNumber = styled.span`
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: ${colors.textMuted};
  display: block;
  margin-bottom: 16px;
`;

const StepIcon = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: ${props => props.$color || colors.accent};
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;

  .anticon {
    font-size: 24px;
    color: #FFFFFF;
  }
`;

const StepTitle = styled.h3`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 18px;
  font-weight: 400;
  color: ${colors.text};
  margin: 0 0 8px 0;
`;

const StepDesc = styled.p`
  font-size: 13px;
  color: ${colors.textMuted};
  margin: 0;
  line-height: 1.5;
`;

// Modal
const ModalOverlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;

const ModalContent = styled(motion.div)`
  background: #FFFFFF;
  border-radius: 20px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
`;

const ModalHeader = styled.div`
  padding: 28px 32px 24px;
  border-bottom: 1px solid ${colors.border};
`;

const ModalTitle = styled.h3`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 22px;
  font-weight: 400;
  color: ${colors.text};
  margin: 0;
`;

const ModalBody = styled.div`
  padding: 32px;
`;

const ModalClose = styled.button`
  position: absolute;
  top: 24px;
  right: 24px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid ${colors.border};
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: ${colors.textMuted};
  transition: all 0.2s;

  &:hover {
    background: ${colors.bg};
    color: ${colors.text};
  }
`;

const QRBigImage = styled.div`
  width: 300px;
  height: 300px;
  margin: 0 auto 24px;
  background: ${colors.bg};
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  img {
    width: 280px;
    height: 280px;
    border-radius: 8px;
  }
`;

const LoadingSpinner = styled.div`
  width: 280px;
  height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: ${colors.bgSecondary};
  border-radius: 12px;
`;

const SpinnerCircle = styled.div`
  width: 48px;
  height: 48px;
  border: 4px solid ${colors.border};
  border-top-color: ${colors.highlight};
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const FeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;

  li {
    padding: 10px 0;
    font-size: 14px;
    color: ${colors.text};
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid ${colors.border};

    &:last-child {
      border-bottom: none;
    }

    &::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${colors.highlight};
      flex-shrink: 0;
    }
  }
`;

const UrlBox = styled.div`
  background: ${colors.bg};
  padding: 12px 16px;
  border-radius: 8px;
  margin: 16px 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: ${colors.text};
  word-break: break-all;
  line-height: 1.5;
`;

const Input = styled.input`
  width: 100%;
  height: 44px;
  padding: 0 16px;
  border: 1px solid ${colors.border};
  border-radius: 8px;
  font-size: 14px;
  background: #FFFFFF;
  color: ${colors.text};
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: ${colors.highlight};
  }

  &::placeholder {
    color: ${colors.textMuted};
  }
`;

const InfoBanner = styled.div`
  margin-top: 24px;
  padding: 20px 24px;
  background: ${props => props.$success ? 'rgba(16, 185, 129, 0.08)' : colors.bgSecondary};
  border: 1px solid ${props => props.$success ? 'rgba(16, 185, 129, 0.2)' : colors.border};
  border-radius: 12px;
`;

const BannerTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.$success ? colors.success : colors.text};
  margin-bottom: 8px;
`;

const BannerText = styled.p`
  font-size: 13px;
  color: ${colors.textMuted};
  margin: 0 0 16px 0;
  line-height: 1.5;
`;

const ResumeUpload = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loginPromptVisible, setLoginPromptVisible] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [domainModalVisible, setDomainModalVisible] = useState(false);
  const [customDomain, setCustomDomain] = useState('');
  const [qrCodeGenerated, setQrCodeGenerated] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrCodeLoading, setQrCodeLoading] = useState(true);
  const [qrCodeServices, setQrCodeServices] = useState([]);
  const [currentServiceIndex, setCurrentServiceIndex] = useState(0);
  const [candidateFormUrl, setCandidateFormUrl] = useState('');

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const normalizeBaseUrl = (value) => (value || '').trim().replace(/\/+$/, '');

  const getCurrentOwnerId = () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      return currentUser?.id ? Number(currentUser.id) : null;
    } catch {
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

  const buildQRCodeServices = (targetUrl) => [
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`,
    `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(targetUrl)}`,
    `https://qr-server.com/api/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`
  ];

  useEffect(() => {
    const autoGenerateQRCode = () => {
      const targetUrl = resolveCandidateFormUrl();
      setCandidateFormUrl(targetUrl);
      const services = buildQRCodeServices(targetUrl);
      setQrCodeServices(services);
      setQrCodeUrl(services[0]);
      setCurrentServiceIndex(0);
      setQrCodeGenerated(true);
      setQrCodeLoading(false);

      if (isLocalhost && !process.env.REACT_APP_PUBLIC_BASE_URL) {
        console.warn('当前是 localhost，本机外手机通常无法访问。请配置公网地址（如 ngrok）。');
      }
    };

    const timer = setTimeout(autoGenerateQRCode, 500);
    return () => clearTimeout(timer);
  }, []);

  const generateQRCode = () => {
    const targetUrl = resolveCandidateFormUrl(customDomain);
    setCandidateFormUrl(targetUrl);
    const services = buildQRCodeServices(targetUrl);
    setQrCodeServices(services);
    setQrCodeUrl(services[0]);
    setCurrentServiceIndex(0);
    setQrCodeGenerated(true);
    setDomainModalVisible(false);
  };

  const switchQRCodeService = () => {
    if (qrCodeServices.length > 0) {
      const nextIndex = (currentServiceIndex + 1) % qrCodeServices.length;
      setCurrentServiceIndex(nextIndex);
      setQrCodeUrl(qrCodeServices[nextIndex]);
    }
  };

  const downloadQRCode = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = '面试二维码.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <PageWrapper>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500&family=Noto+Sans+SC:wght@300;400;500&family=JetBrains+Mono:wght@400&display=swap');

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
            .page-header {
              padding: 32px 24px 24px;
            }
            .main-content {
              padding: 32px 24px;
            }
            .card {
              padding: 32px 24px;
            }
          }
        `}
      </style>

      <PageHeader className="page-header">
        <HeaderInner>
          <PageTitle>面试二维码</PageTitle>
          <PageSubtitle>生成统一面试二维码，候选人扫码即可填写信息、完成测评并上传简历</PageSubtitle>
        </HeaderInner>
      </PageHeader>

      <MainContent className="main-content">
        <Section>
          <Card className="card">
            <QRDisplaySection>
              <QRCodeBox>
                <AnimatePresence mode="wait">
                  {qrCodeLoading ? (
                    <QRPlaceholder key="loading">
                      <LoadingSpinner>
                        <SpinnerCircle />
                        <span style={{ fontSize: 13, color: colors.textMuted }}>正在生成...</span>
                      </LoadingSpinner>
                    </QRPlaceholder>
                  ) : qrCodeGenerated ? (
                    <motion.img
                      key="qr"
                      src={qrCodeUrl}
                      alt="面试二维码"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4 }}
                      onError={() => switchQRCodeService()}
                    />
                  ) : (
                    <QRPlaceholder key="empty">
                      <IconQR size={64} color={colors.border} strokeWidth={1} />
                      <span style={{ fontSize: 14, color: colors.textMuted }}>二维码生成失败</span>
                    </QRPlaceholder>
                  )}
                </AnimatePresence>

                {qrCodeGenerated && qrCodeServices.length > 1 && (
                  <QRServiceSelector>
                    {qrCodeServices.map((_, idx) => (
                      <ServiceButton
                        key={idx}
                        $active={idx === currentServiceIndex}
                        onClick={() => {
                          setCurrentServiceIndex(idx);
                          setQrCodeUrl(qrCodeServices[idx]);
                        }}
                      >
                        服务 {idx + 1}
                      </ServiceButton>
                    ))}
                  </QRServiceSelector>
                )}
              </QRCodeBox>

              <QRInfoPanel>
                <InfoItem $highlight>
                  <InfoIcon $color={colors.success}>
                    <IconQR />
                  </InfoIcon>
                  <InfoContent>
                    <InfoTitle>统一二维码</InfoTitle>
                    <InfoText>所有候选人都可以扫描同一个二维码来填写信息和上传简历</InfoText>
                  </InfoContent>
                </InfoItem>

                <InfoItem>
                  <InfoIcon $color={colors.accent}>
                    <IconDocument />
                  </InfoIcon>
                  <InfoContent>
                    <InfoTitle>简历自动分析</InfoTitle>
                    <InfoText>上传后系统自动进行岗位匹配度分析</InfoText>
                  </InfoContent>
                </InfoItem>

                <ButtonGroup>
                  <PrimaryButton
                    onClick={() => setQrModalVisible(true)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <IconQR size={16} />
                    查看大图
                  </PrimaryButton>
                  <SecondaryButton
                    onClick={downloadQRCode}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <IconDownload size={16} />
                    下载二维码
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={() => window.open('/resume-analysis', '_blank')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <IconDocument size={16} />
                    分析结果
                  </SecondaryButton>
                </ButtonGroup>

                {isLocalhost && (
                  <InfoBanner $success={!!process.env.REACT_APP_PUBLIC_BASE_URL}>
                    <BannerTitle $success={!!process.env.REACT_APP_PUBLIC_BASE_URL}>
                      {process.env.REACT_APP_PUBLIC_BASE_URL ? '已配置公网地址' : '当前为本地地址'}
                    </BannerTitle>
                    <BannerText>
                      候选人入口：{candidateFormUrl || `${window.location.origin}/candidate-form`}
                    </BannerText>
                    <ButtonGroup>
                      <PrimaryButton
                        style={{ height: 36, fontSize: 13, padding: '0 16px' }}
                        onClick={() => copyToClipboard(candidateFormUrl || `${window.location.origin}/candidate-form`)}
                      >
                        <IconLink size={14} />
                        复制链接
                      </PrimaryButton>
                      <SecondaryButton
                        style={{ height: 36, fontSize: 13, padding: '0 16px' }}
                        onClick={() => setDomainModalVisible(true)}
                      >
                        <IconLink size={14} />
                        更换地址
                      </SecondaryButton>
                    </ButtonGroup>
                  </InfoBanner>
                )}
              </QRInfoPanel>
            </QRDisplaySection>

            <ProcessFlow>
              <ProcessStep
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <StepNumber>01</StepNumber>
                <StepIcon $color={colors.accent}>
                  <IconUser />
                </StepIcon>
                <StepTitle>信息填写</StepTitle>
                <StepDesc>候选人填写基本信息和应聘职位</StepDesc>
              </ProcessStep>

              <ProcessStep
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <StepNumber>02</StepNumber>
                <StepIcon $color={colors.success}>
                  <IconLightbulb />
                </StepIcon>
                <StepTitle>MBTI测评</StepTitle>
                <StepDesc>完成性格测评，了解候选人特质</StepDesc>
              </ProcessStep>

              <ProcessStep
                $last
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <StepNumber>03</StepNumber>
                <StepIcon $color={colors.warning}>
                  <IconDocument />
                </StepIcon>
                <StepTitle>简历上传</StepTitle>
                <StepDesc>上传个人简历，系统自动分析</StepDesc>
              </ProcessStep>
            </ProcessFlow>
          </Card>
        </Section>
      </MainContent>

      {/* QR Modal */}
      <AnimatePresence>
        {qrModalVisible && (
          <ModalOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setQrModalVisible(false)}
          >
            <ModalContent
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader>
                <ModalTitle>面试二维码</ModalTitle>
                <ModalClose onClick={() => setQrModalVisible(false)}>×</ModalClose>
              </ModalHeader>

              <ModalBody>
                <QRBigImage>
                  {qrCodeLoading ? (
                    <LoadingSpinner>
                      <SpinnerCircle />
                      <span style={{ fontSize: 13, color: colors.textMuted }}>生成中...</span>
                    </LoadingSpinner>
                  ) : (
                    <img src={qrCodeUrl} alt="面试二维码" onError={() => switchQRCodeService()} />
                  )}
                </QRBigImage>

                <ButtonGroup style={{ justifyContent: 'center', marginBottom: 24 }}>
                  <PrimaryButton onClick={downloadQRCode}>
                    <IconDownload size={16} />
                    下载二维码
                  </PrimaryButton>
                  {qrCodeGenerated && qrCodeServices.length > 1 && (
                    <SecondaryButton onClick={switchQRCodeService}>
                      切换服务
                    </SecondaryButton>
                  )}
                  <SecondaryButton onClick={generateQRCode}>
                    重新生成
                  </SecondaryButton>
                </ButtonGroup>

                <FeatureList>
                  <li>多人使用：所有候选人都可以扫描同一个二维码</li>
                  <li>信息填写：候选人填写基本信息和应聘职位</li>
                  <li>MBTI测评：完成性格测评，了解候选人特质</li>
                  <li>简历上传：上传个人简历文件</li>
                  <li>自动分析：系统自动进行岗位匹配度分析</li>
                  <li>统一管理：所有申请者在HR仪表板中统一查看</li>
                </FeatureList>

                <InfoBanner>
                  <BannerText style={{ marginBottom: 12 }}>
                    申请链接（可直接复制分享）：
                  </BannerText>
                  <UrlBox>{candidateFormUrl || `${window.location.origin}/candidate-form`}</UrlBox>
                  <ButtonGroup>
                    <PrimaryButton
                      style={{ height: 36, fontSize: 13, padding: '0 16px' }}
                      onClick={() => copyToClipboard(candidateFormUrl)}
                    >
                      <IconLink size={14} />
                      复制链接
                    </PrimaryButton>
                    <SecondaryButton
                      style={{ height: 36, fontSize: 13, padding: '0 16px' }}
                      onClick={() => window.open(candidateFormUrl, '_blank')}
                    >
                      <IconCheck size={14} />
                      测试打开
                    </SecondaryButton>
                  </ButtonGroup>
                </InfoBanner>
              </ModalBody>
            </ModalContent>
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* Domain Config Modal */}
      <AnimatePresence>
        {domainModalVisible && (
          <ModalOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDomainModalVisible(false)}
          >
            <ModalContent
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader>
                <ModalTitle>配置公网访问地址</ModalTitle>
                <ModalClose onClick={() => setDomainModalVisible(false)}>×</ModalClose>
              </ModalHeader>

              <ModalBody>
                <InfoText style={{ marginBottom: 24, color: colors.textMuted }}>
                  由于微信无法访问 localhost 地址，需要配置一个公网可访问的地址。
                </InfoText>

                <div style={{ marginBottom: 24 }}>
                  <InfoTitle style={{ marginBottom: 8 }}>公网访问地址</InfoTitle>
                  <Input
                    placeholder="例如：https://your-domain.com 或 https://abc123.ngrok.io"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                  />
                  <InfoText style={{ marginTop: 8, fontSize: 12 }}>
                    支持 ngrok、内网穿透等工具生成的公网地址
                  </InfoText>
                </div>

                <InfoBanner>
                  <BannerTitle>推荐方案</BannerTitle>
                  <FeatureList>
                    <li><strong>ngrok：</strong>下载 ngrok，运行 ngrok http 3000</li>
                    <li><strong>内网穿透：</strong>使用花生壳、natapp 等工具</li>
                    <li><strong>云服务器：</strong>部署到阿里云、腾讯云等</li>
                  </FeatureList>
                </InfoBanner>

                <ButtonGroup style={{ justifyContent: 'flex-end', marginTop: 24 }}>
                  <SecondaryButton onClick={() => setDomainModalVisible(false)}>
                    取消
                  </SecondaryButton>
                  <PrimaryButton
                    onClick={() => {
                      if (customDomain) {
                        generateQRCode();
                      }
                    }}
                  >
                    确认配置
                  </PrimaryButton>
                </ButtonGroup>
              </ModalBody>
            </ModalContent>
          </ModalOverlay>
        )}
      </AnimatePresence>

      <LoginPromptModal
        visible={loginPromptVisible}
        onClose={() => setLoginPromptVisible(false)}
        onLogin={() => {
          setLoginPromptVisible(false);
          navigate('/login');
        }}
      />
    </PageWrapper>
  );
};

export default ResumeUpload;
