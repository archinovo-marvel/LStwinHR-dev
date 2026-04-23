import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Checkbox, message, Spin } from 'antd';
import { BankOutlined, UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, SafetyCertificateOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { colors } from '../theme/colors';

// ============================================
// STYLED COMPONENTS
// ============================================

const FlipContainer = styled.div`
  perspective: 1000px;
  width: 100%;
  height: 480px;
  position: relative;
`;

const Flipper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
  transform-style: preserve-3d;

  &.flipped {
    transform: rotateY(180deg);
  }
`;

const CardFace = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 16px;
  background: ${colors.surface};
  box-shadow: 0 4px 24px ${colors.shadow};
  overflow: hidden;
`;

const FrontCard = styled(CardFace)`
  // front is default
`;

const BackCard = styled(CardFace)`
  transform: rotateY(180deg);
`;

// Corp (Front) Card Styling - Blue
const CorpCard = styled.div`
  width: 100%;
  height: 100%;
  padding: 32px;
  background: linear-gradient(135deg, ${colors.accentSub} 0%, ${colors.surface} 100%);
  border-top: 3px solid ${colors.highlight};
  display: flex;
  flex-direction: column;
`;

// Personal (Back) Card Styling - Green
const PersonalCard = styled.div`
  width: 100%;
  height: 100%;
  padding: 32px;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, ${colors.surface} 100%);
  border-top: 3px solid ${colors.success};
  display: flex;
  flex-direction: column;
`;

// Card Header with Icon
const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
`;

const CorpIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${colors.highlight};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
`;

const PersonalIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${colors.success};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
`;

const CardTitle = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: ${colors.text};
`;

// Tab Buttons Container
const TabContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  background: ${colors.frost};
  padding: 4px;
  border-radius: 10px;
`;

const TabButton = styled.button`
  flex: 1;
  height: 40px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  background: transparent;
  color: ${colors.textMuted};

  &:hover {
    color: ${colors.text};
  }

  &.active {
    background: ${props => props.accentColor || colors.highlight};
    color: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
`;

// Form Styles
const StyledForm = styled(Form)`
  flex: 1;
  width: 100%;

  .ant-form-item {
    margin-bottom: 14px;
    width: 100%;
  }

  .ant-form-item-control-input {
    min-height: 44px;
  }

  .ant-form-item-control-input-content {
    width: 100%;
  }
`;

const StyledInput = styled(Input)`
  width: 100%;
  height: 44px;
  border-radius: 8px;
  border: 1px solid ${colors.border};
  padding: 0 14px;
  font-size: 14px;
  transition: all 0.25s ease;
  background: ${colors.cardBg};

  &:hover {
    border-color: ${props => props.accentColor || colors.highlight};
  }

  &:focus,
  &.ant-input-focused {
    border-color: ${props => props.accentColor || colors.highlight};
    box-shadow: 0 0 0 3px ${props => props.accentColor ? `${props.accentColor}20` : 'rgba(37,99,235,0.12)'};
  }

  &::placeholder {
    color: ${colors.textMuted};
  }

  .ant-input-prefix {
    color: ${colors.textMuted};
    margin-right: 10px;
  }
`;

const StyledPasswordInput = styled(Input.Password)`
  width: 100%;
  height: 44px;
  border-radius: 8px;
  border: 1px solid ${colors.border};
  padding: 0 14px;
  font-size: 14px;
  transition: all 0.25s ease;
  background: ${colors.cardBg};

  &:hover {
    border-color: ${props => props.accentColor || colors.highlight};
  }

  &:focus,
  &.ant-input-focused {
    border-color: ${props => props.accentColor || colors.highlight};
    box-shadow: 0 0 0 3px ${props => props.accentColor ? `${props.accentColor}20` : 'rgba(37,99,235,0.12)'};
  }

  &::placeholder {
    color: ${colors.textMuted};
  }

  .ant-input-prefix {
    color: ${colors.textMuted};
    margin-right: 10px;
  }

  .ant-input-suffix {
    color: ${colors.textMuted};
  }
`;

const CodeInputWrapper = styled.div`
  display: flex;
  width: 100%;
  gap: 12px;
`;

const CodeInput = styled(Input)`
  flex: 1;
  height: 44px;
  border-radius: 8px;
  border: 1px solid ${colors.border};
  padding: 0 14px;
  font-size: 14px;
  transition: all 0.25s ease;

  &:hover {
    border-color: ${props => props.accentColor || colors.highlight};
  }

  &:focus {
    border-color: ${props => props.accentColor || colors.highlight};
  }

  &::placeholder {
    color: ${colors.textMuted};
  }

  .ant-input-prefix {
    color: ${colors.textMuted};
    margin-right: 10px;
  }
`;

const CodeButton = styled(Button)`
  height: 44px;
  border-radius: 8px;
  min-width: 110px;
  font-weight: 500;
  font-size: 13px;
  border: 1px solid ${props => props.accentColor || colors.border};
  color: ${props => props.accentColor || colors.text};
  background: transparent;

  &:hover {
    background: ${props => props.accentColor ? `${props.accentColor}15` : colors.frost} !important;
    border-color: ${props => props.accentColor || colors.primary} !important;
    color: ${props => props.accentColor || colors.primary} !important;
  }

  &:disabled {
    border-color: ${colors.border};
    color: ${colors.textMuted};
    background: transparent;
  }
`;

const PrimaryButton = styled(Button)`
  width: 100%;
  height: 48px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  letter-spacing: 0.05em;
  background: ${props => props.accentColor || colors.primary};
  border-color: ${props => props.accentColor || colors.primary};
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  margin-top: 8px;

  &:hover {
    background: ${props => props.accentColor || colors.highlight} !important;
    border-color: ${props => props.accentColor || colors.highlight} !important;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    background: ${colors.border};
    border-color: ${colors.border};
  }
`;

const DividerLine = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16px 0;
  width: 100%;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${colors.divider};
  }

  span {
    padding: 0 16px;
    font-size: 13px;
    color: ${colors.textMuted};
  }
`;

const FormFooter = styled.div`
  text-align: center;
  font-size: 14px;
  color: ${colors.textMuted};
  margin-top: auto;

  a {
    color: ${colors.text};
    font-weight: 500;
    margin-left: 4px;
    position: relative;

    &::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 100%;
      height: 1px;
      background: ${props => props.accentColor || colors.accent};
      transform: scaleX(0);
      transform-origin: right;
      transition: transform 0.3s ease;
    }

    &:hover {
      color: ${props => props.accentColor || colors.text};
    }

    &:hover::after {
      transform: scaleX(1);
      transform-origin: left;
    }
  }
`;

const FormSection = styled.div`
  margin-bottom: 16px;
`;

const SectionTitle = styled.div`
  font-size: 11px;
  font-weight: 500;
  color: ${colors.textMuted};
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 10px;
`;

const ValidationStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: -6px;
  margin-bottom: 6px;
  padding-left: 4px;
  font-size: 12px;
  color: ${props => props.valid ? '#52c41a' : '#ff4d4f'};
`;

const CheckingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: -6px;
  margin-bottom: 6px;
  padding-left: 4px;
  font-size: 12px;
  color: ${colors.textMuted};
`;

const StatusIcon = styled.span`
  display: inline-flex;
  align-items: center;
`;

// ============================================
// AUTH CARD COMPONENT
// ============================================

const AuthCard = ({
  mode = 'login',
  onCorpLogin,
  onPersonalLogin,
  onCorpRegister,
  onPersonalRegister,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('corp');
  const [corpForm] = Form.useForm();
  const [personalForm] = Form.useForm();

  // Register specific states
  const [corpCountdown, setCorpCountdown] = useState(0);
  const [personalCountdown, setPersonalCountdown] = useState(0);
  const [sendingCorpCode, setSendingCorpCode] = useState(false);
  const [sendingPersonalCode, setSendingPersonalCode] = useState(false);

  // Corp register validation states
  const [checkingCorpUserId, setCheckingCorpUserId] = useState(false);
  const [corpUserIdStatus, setCorpUserIdStatus] = useState(null);
  const [checkingCorpEmail, setCheckingCorpEmail] = useState(false);
  const [corpEmailStatus, setCorpEmailStatus] = useState(null);
  const [checkingCorpPhone, setCheckingCorpPhone] = useState(false);
  const [corpPhoneStatus, setCorpPhoneStatus] = useState(null);

  // Personal register validation states
  const [checkingPersonalUserId, setCheckingPersonalUserId] = useState(false);
  const [personalUserIdStatus, setPersonalUserIdStatus] = useState(null);
  const [checkingPersonalEmail, setCheckingPersonalEmail] = useState(false);
  const [personalEmailStatus, setPersonalEmailStatus] = useState(null);

  // Refs for debounce timers
  const corpUserIdTimer = useRef(null);
  const corpEmailTimer = useRef(null);
  const corpPhoneTimer = useRef(null);
  const personalUserIdTimer = useRef(null);
  const personalEmailTimer = useRef(null);

  // Check duplicate utility
  const checkDuplicate = async (field, value, setStatus, setChecking) => {
    if (!value || value.trim() === '') {
      setStatus(null);
      setChecking(false);
      return;
    }

    if (field === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        setStatus(null);
        setChecking(false);
        return;
      }
    }
    if (field === 'phone') {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(value)) {
        setStatus(null);
        setChecking(false);
        return;
      }
    }

    setChecking(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch('/api/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value: value.trim() }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        setStatus(null);
        setChecking(false);
        return;
      }

      const data = await response.json();

      if (data.success && data.exists) {
        setStatus({ valid: false, message: data.message });
      } else if (data.success) {
        setStatus({ valid: true, message: '可用' });
      } else {
        setStatus(null);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('检查重复失败:', error);
      }
      setStatus(null);
    }
    setChecking(false);
  };

  const debouncedCheck = (field, value, setStatus, setChecking, timerRef) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      checkDuplicate(field, value, setStatus, setChecking);
    }, 500);
  };

  // Effects for countdowns
  useEffect(() => {
    let timer;
    if (corpCountdown > 0) {
      timer = setTimeout(() => setCorpCountdown(corpCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [corpCountdown]);

  useEffect(() => {
    let timer;
    if (personalCountdown > 0) {
      timer = setTimeout(() => setPersonalCountdown(personalCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [personalCountdown]);

  // Send verification code
  const handleSendCorpCode = async () => {
    try {
      const email = corpForm.getFieldValue('email');
      if (!email) {
        message.error('请先填写邮箱地址');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        message.error('请填写正确的邮箱地址');
        return;
      }
      setSendingCorpCode(true);
      const response = await fetch('/api/corp/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'register' }),
      });
      const data = await response.json();
      if (response.ok) {
        message.success(data.message || '验证码已发送');
        setCorpCountdown(60);
      } else {
        message.error(data.message || '发送验证码失败');
      }
    } catch (error) {
      message.error('网络错误');
    } finally {
      setSendingCorpCode(false);
    }
  };

  const handleSendPersonalCode = async () => {
    try {
      const email = personalForm.getFieldValue('email');
      if (!email) {
        message.error('请先填写邮箱地址');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        message.error('请填写正确的邮箱地址');
        return;
      }
      setSendingPersonalCode(true);
      const response = await fetch('/api/personal/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'register' }),
      });
      const data = await response.json();
      if (response.ok) {
        message.success(data.message || '验证码已发送');
        setPersonalCountdown(60);
      } else {
        message.error(data.message || '发送验证码失败');
      }
    } catch (error) {
      message.error('网络错误');
    } finally {
      setSendingPersonalCode(false);
    }
  };

  // Login handlers
  const handleCorpLogin = async ({ username, password }) => {
    try {
      await onCorpLogin({ email: username, password });
      message.success('企业账号登录成功');
    } catch (e) {
      message.error(e.message || '登录失败');
    }
  };

  const handlePersonalLogin = async ({ username, password }) => {
    try {
      await onPersonalLogin({ email: username, password });
      message.success('个人账号登录成功');
    } catch (e) {
      message.error(e.message || '登录失败');
    }
  };

  // Register handlers
  const handleCorpRegister = async ({ userId, phone, email, verificationCode, password }) => {
    // Validation check
    if (corpUserIdStatus && !corpUserIdStatus.valid) {
      message.error(corpUserIdStatus.message);
      return;
    }
    if (corpEmailStatus && !corpEmailStatus.valid) {
      message.error(corpEmailStatus.message);
      return;
    }
    if (corpPhoneStatus && !corpPhoneStatus.valid) {
      message.error(corpPhoneStatus.message);
      return;
    }
    if (checkingCorpUserId || checkingCorpEmail || checkingCorpPhone) {
      message.warning('正在检查信息，请稍候...');
      return;
    }

    try {
      await onCorpRegister({ userId, phone, email, verificationCode, password });
      message.success('注册成功，请登录');
      navigate('/login');
    } catch (e) {
      message.error(e.message || '注册失败');
    }
  };

  const handlePersonalRegister = async ({ userId, email, verificationCode, password }) => {
    // Validation check
    if (personalUserIdStatus && !personalUserIdStatus.valid) {
      message.error(personalUserIdStatus.message);
      return;
    }
    if (personalEmailStatus && !personalEmailStatus.valid) {
      message.error(personalEmailStatus.message);
      return;
    }
    if (checkingPersonalUserId || checkingPersonalEmail) {
      message.warning('正在检查信息，请稍候...');
      return;
    }

    try {
      await onPersonalRegister({ userId, email, verificationCode, password });
      message.success('注册成功，请登录');
      navigate('/login');
    } catch (e) {
      message.error(e.message || '注册失败');
    }
  };

  // Tab click handlers
  const handleCorpTabClick = () => {
    setActiveTab('corp');
    corpForm.resetFields();
    setCorpCountdown(0);
  };

  const handlePersonalTabClick = () => {
    setActiveTab('personal');
    personalForm.resetFields();
    setPersonalCountdown(0);
  };

  // ============================================
  // CORP FORM (FRONT - BLUE)
  // ============================================
  const renderCorpLoginForm = () => (
    <CorpCard>
      <CardHeader>
        <CorpIcon><BankOutlined /></CorpIcon>
        <CardTitle>企业账号</CardTitle>
      </CardHeader>

      <StyledForm
        form={corpForm}
        onFinish={handleCorpLogin}
        scrollToFirstError
      >
        <Form.Item
          name="username"
          rules={[{ required: true, message: '请输入用户名!' }]}
        >
          <StyledInput
            prefix={<UserOutlined />}
            placeholder="用户名 / 邮箱"
            accentColor={colors.highlight}
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: '请输入密码!' }]}
        >
          <StyledPasswordInput
            prefix={<LockOutlined />}
            placeholder="密码"
            accentColor={colors.highlight}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <PrimaryButton type="primary" htmlType="submit" accentColor={colors.highlight}>
            登录
          </PrimaryButton>
        </Form.Item>
      </StyledForm>

      <DividerLine><span>或</span></DividerLine>

      <FormFooter accentColor={colors.highlight}>
        {mode === 'login' ? (
          <>还没有账号?<Link to="/register">立即注册</Link></>
        ) : (
          <>已有账号?<Link to="/login">立即登录</Link></>
        )}
      </FormFooter>
    </CorpCard>
  );

  const renderCorpRegisterForm = () => (
    <CorpCard>
      <CardHeader>
        <CorpIcon><BankOutlined /></CorpIcon>
        <CardTitle>企业账号注册</CardTitle>
      </CardHeader>

      <StyledForm
        form={corpForm}
        onFinish={handleCorpRegister}
        scrollToFirstError
      >
        <FormSection>
          <SectionTitle>基础信息</SectionTitle>

          <Form.Item
            name="userId"
            rules={[{ required: true, message: '请输入用户ID!' }]}
            validateTrigger="onBlur"
          >
            <StyledInput
              prefix={<UserOutlined />}
              placeholder="用户ID"
              accentColor={colors.highlight}
              onChange={(e) => {
                const value = e.target.value;
                if (value.trim()) {
                  setCheckingCorpUserId(true);
                  setCorpUserIdStatus(null);
                  debouncedCheck('userId', value, setCorpUserIdStatus, setCheckingCorpUserId, corpUserIdTimer);
                } else {
                  setCheckingCorpUserId(false);
                  setCorpUserIdStatus(null);
                }
              }}
            />
          </Form.Item>
          {checkingCorpUserId && (
            <CheckingIndicator><Spin size="small" /> 检查中...</CheckingIndicator>
          )}
          {corpUserIdStatus && !checkingCorpUserId && (
            <ValidationStatus valid={corpUserIdStatus.valid}>
              <StatusIcon>{corpUserIdStatus.valid ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}</StatusIcon>
              {corpUserIdStatus.message}
            </ValidationStatus>
          )}

          <Form.Item
            name="phone"
            rules={[
              { required: true, message: '请输入手机号!' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入有效11位手机号!' }
            ]}
            validateTrigger="onBlur"
          >
            <StyledInput
              prefix={<PhoneOutlined />}
              placeholder="手机号码"
              accentColor={colors.highlight}
              onChange={(e) => {
                const value = e.target.value;
                if (/^1[3-9]\d{9}$/.test(value)) {
                  setCheckingCorpPhone(true);
                  setCorpPhoneStatus(null);
                  debouncedCheck('phone', value, setCorpPhoneStatus, setCheckingCorpPhone, corpPhoneTimer);
                } else {
                  setCheckingCorpPhone(false);
                  setCorpPhoneStatus(null);
                }
              }}
            />
          </Form.Item>
          {checkingCorpPhone && (
            <CheckingIndicator><Spin size="small" /> 检查中...</CheckingIndicator>
          )}
          {corpPhoneStatus && !checkingCorpPhone && (
            <ValidationStatus valid={corpPhoneStatus.valid}>
              <StatusIcon>{corpPhoneStatus.valid ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}</StatusIcon>
              {corpPhoneStatus.message}
            </ValidationStatus>
          )}

          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱!' },
              { type: 'email', message: '请输入有效邮箱!' }
            ]}
            validateTrigger="onBlur"
          >
            <StyledInput
              prefix={<MailOutlined />}
              placeholder="邮箱地址"
              accentColor={colors.highlight}
              onChange={(e) => {
                const value = e.target.value;
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (emailRegex.test(value)) {
                  setCheckingCorpEmail(true);
                  setCorpEmailStatus(null);
                  debouncedCheck('email', value, setCorpEmailStatus, setCheckingCorpEmail, corpEmailTimer);
                } else {
                  setCheckingCorpEmail(false);
                  setCorpEmailStatus(null);
                }
              }}
            />
          </Form.Item>
          {checkingCorpEmail && (
            <CheckingIndicator><Spin size="small" /> 检查中...</CheckingIndicator>
          )}
          {corpEmailStatus && !checkingCorpEmail && (
            <ValidationStatus valid={corpEmailStatus.valid}>
              <StatusIcon>{corpEmailStatus.valid ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}</StatusIcon>
              {corpEmailStatus.message}
            </ValidationStatus>
          )}
        </FormSection>

        <FormSection>
          <SectionTitle>验证信息</SectionTitle>
          <Form.Item
            name="verificationCode"
            rules={[
              { required: true, message: '请输入验证码!' },
              { len: 6, message: '验证码为6位!' }
            ]}
          >
            <CodeInputWrapper>
              <CodeInput
                prefix={<SafetyCertificateOutlined />}
                placeholder="6位验证码"
                maxLength={6}
                accentColor={colors.highlight}
              />
              <CodeButton
                onClick={handleSendCorpCode}
                disabled={corpCountdown > 0 || sendingCorpCode}
                loading={sendingCorpCode}
                accentColor={colors.highlight}
              >
                {corpCountdown > 0 ? `${corpCountdown}s` : '获取验证码'}
              </CodeButton>
            </CodeInputWrapper>
          </Form.Item>
        </FormSection>

        <FormSection>
          <SectionTitle>安全信息</SectionTitle>
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码!' },
              { min: 6, message: '密码至少6位!' }
            ]}
          >
            <StyledPasswordInput
              prefix={<LockOutlined />}
              placeholder="密码"
              accentColor={colors.highlight}
            />
          </Form.Item>
          <Form.Item
            name="confirm"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次密码不一致!'));
                },
              }),
            ]}
          >
            <StyledPasswordInput
              prefix={<LockOutlined />}
              placeholder="确认密码"
              accentColor={colors.highlight}
            />
          </Form.Item>
        </FormSection>

        <Form.Item name="agreement" valuePropName="checked" style={{ marginBottom: 16 }}>
          <Checkbox>我已阅读并同意 <a href="">服务协议</a></Checkbox>
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <PrimaryButton type="primary" htmlType="submit" accentColor={colors.highlight}>
            注册
          </PrimaryButton>
        </Form.Item>
      </StyledForm>

      <DividerLine><span>或</span></DividerLine>

      <FormFooter accentColor={colors.highlight}>
        已有账号?<Link to="/login">立即登录</Link>
      </FormFooter>
    </CorpCard>
  );

  // ============================================
  // PERSONAL FORM (BACK - GREEN)
  // ============================================
  const renderPersonalLoginForm = () => (
    <PersonalCard>
      <CardHeader>
        <PersonalIcon><UserOutlined /></PersonalIcon>
        <CardTitle>个人账号</CardTitle>
      </CardHeader>

      <StyledForm
        form={personalForm}
        onFinish={handlePersonalLogin}
        scrollToFirstError
      >
        <Form.Item
          name="username"
          rules={[{ required: true, message: '请输入用户名!' }]}
        >
          <StyledInput
            prefix={<UserOutlined />}
            placeholder="用户名 / 邮箱"
            accentColor={colors.success}
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: '请输入密码!' }]}
        >
          <StyledPasswordInput
            prefix={<LockOutlined />}
            placeholder="密码"
            accentColor={colors.success}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <PrimaryButton type="primary" htmlType="submit" accentColor={colors.success}>
            登录
          </PrimaryButton>
        </Form.Item>
      </StyledForm>

      <DividerLine><span>或</span></DividerLine>

      <FormFooter accentColor={colors.success}>
        {mode === 'login' ? (
          <>还没有账号?<Link to="/register">立即注册</Link></>
        ) : (
          <>已有账号?<Link to="/login">立即登录</Link></>
        )}
      </FormFooter>
    </PersonalCard>
  );

  const renderPersonalRegisterForm = () => (
    <PersonalCard>
      <CardHeader>
        <PersonalIcon><UserOutlined /></PersonalIcon>
        <CardTitle>个人账号注册</CardTitle>
      </CardHeader>

      <StyledForm
        form={personalForm}
        onFinish={handlePersonalRegister}
        scrollToFirstError
      >
        <FormSection>
          <SectionTitle>基础信息</SectionTitle>

          <Form.Item
            name="userId"
            rules={[{ required: true, message: '请输入用户ID!' }]}
            validateTrigger="onBlur"
          >
            <StyledInput
              prefix={<UserOutlined />}
              placeholder="用户ID"
              accentColor={colors.success}
              onChange={(e) => {
                const value = e.target.value;
                if (value.trim()) {
                  setCheckingPersonalUserId(true);
                  setPersonalUserIdStatus(null);
                  debouncedCheck('userId', value, setPersonalUserIdStatus, setCheckingPersonalUserId, personalUserIdTimer);
                } else {
                  setCheckingPersonalUserId(false);
                  setPersonalUserIdStatus(null);
                }
              }}
            />
          </Form.Item>
          {checkingPersonalUserId && (
            <CheckingIndicator><Spin size="small" /> 检查中...</CheckingIndicator>
          )}
          {personalUserIdStatus && !checkingPersonalUserId && (
            <ValidationStatus valid={personalUserIdStatus.valid}>
              <StatusIcon>{personalUserIdStatus.valid ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}</StatusIcon>
              {personalUserIdStatus.message}
            </ValidationStatus>
          )}

          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱!' },
              { type: 'email', message: '请输入有效邮箱!' }
            ]}
            validateTrigger="onBlur"
          >
            <StyledInput
              prefix={<MailOutlined />}
              placeholder="邮箱地址"
              accentColor={colors.success}
              onChange={(e) => {
                const value = e.target.value;
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (emailRegex.test(value)) {
                  setCheckingPersonalEmail(true);
                  setPersonalEmailStatus(null);
                  debouncedCheck('email', value, setPersonalEmailStatus, setCheckingPersonalEmail, personalEmailTimer);
                } else {
                  setCheckingPersonalEmail(false);
                  setPersonalEmailStatus(null);
                }
              }}
            />
          </Form.Item>
          {checkingPersonalEmail && (
            <CheckingIndicator><Spin size="small" /> 检查中...</CheckingIndicator>
          )}
          {personalEmailStatus && !checkingPersonalEmail && (
            <ValidationStatus valid={personalEmailStatus.valid}>
              <StatusIcon>{personalEmailStatus.valid ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}</StatusIcon>
              {personalEmailStatus.message}
            </ValidationStatus>
          )}
        </FormSection>

        <FormSection>
          <SectionTitle>验证信息</SectionTitle>
          <Form.Item
            name="verificationCode"
            rules={[
              { required: true, message: '请输入验证码!' },
              { len: 6, message: '验证码为6位!' }
            ]}
          >
            <CodeInputWrapper>
              <CodeInput
                prefix={<SafetyCertificateOutlined />}
                placeholder="6位验证码"
                maxLength={6}
                accentColor={colors.success}
              />
              <CodeButton
                onClick={handleSendPersonalCode}
                disabled={personalCountdown > 0 || sendingPersonalCode}
                loading={sendingPersonalCode}
                accentColor={colors.success}
              >
                {personalCountdown > 0 ? `${personalCountdown}s` : '获取验证码'}
              </CodeButton>
            </CodeInputWrapper>
          </Form.Item>
        </FormSection>

        <FormSection>
          <SectionTitle>安全信息</SectionTitle>
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码!' },
              { min: 6, message: '密码至少6位!' }
            ]}
          >
            <StyledPasswordInput
              prefix={<LockOutlined />}
              placeholder="密码"
              accentColor={colors.success}
            />
          </Form.Item>
          <Form.Item
            name="confirm"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次密码不一致!'));
                },
              }),
            ]}
          >
            <StyledPasswordInput
              prefix={<LockOutlined />}
              placeholder="确认密码"
              accentColor={colors.success}
            />
          </Form.Item>
        </FormSection>

        <Form.Item name="agreement" valuePropName="checked" style={{ marginBottom: 16 }}>
          <Checkbox>我已阅读并同意 <a href="">服务协议</a></Checkbox>
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <PrimaryButton type="primary" htmlType="submit" accentColor={colors.success}>
            注册
          </PrimaryButton>
        </Form.Item>
      </StyledForm>

      <DividerLine><span>或</span></DividerLine>

      <FormFooter accentColor={colors.success}>
        已有账号?<Link to="/login">立即登录</Link>
      </FormFooter>
    </PersonalCard>
  );

  return (
    <FlipContainer>
      <Flipper className={activeTab === 'personal' ? 'flipped' : ''}>
        <FrontCard>
          {/* Corp Tab Buttons */}
          <TabContainer style={{ marginTop: 0 }}>
            <TabButton
              className={activeTab === 'corp' ? 'active' : ''}
              onClick={handleCorpTabClick}
              accentColor={colors.highlight}
            >
              企业账号
            </TabButton>
            <TabButton
              className={activeTab === 'personal' ? 'active' : ''}
              onClick={handlePersonalTabClick}
              accentColor={colors.success}
            >
              个人账号
            </TabButton>
          </TabContainer>

          {/* Corp Content */}
          {activeTab === 'corp' && mode === 'login' && renderCorpLoginForm()}
          {activeTab === 'corp' && mode === 'register' && renderCorpRegisterForm()}
          {activeTab === 'personal' && mode === 'login' && renderPersonalLoginForm()}
          {activeTab === 'personal' && mode === 'register' && renderPersonalRegisterForm()}
        </FrontCard>

        <BackCard>
          {/* Same structure mirrored - Personal is the "back" */}
          <TabContainer style={{ marginTop: 0 }}>
            <TabButton
              className={activeTab === 'corp' ? 'active' : ''}
              onClick={handleCorpTabClick}
              accentColor={colors.highlight}
            >
              企业账号
            </TabButton>
            <TabButton
              className={activeTab === 'personal' ? 'active' : ''}
              onClick={handlePersonalTabClick}
              accentColor={colors.success}
            >
              个人账号
            </TabButton>
          </TabContainer>

          {/* Same content, but this side shows Personal by default (rotated 180deg) */}
          {activeTab === 'corp' && mode === 'login' && renderCorpLoginForm()}
          {activeTab === 'corp' && mode === 'register' && renderCorpRegisterForm()}
          {activeTab === 'personal' && mode === 'login' && renderPersonalLoginForm()}
          {activeTab === 'personal' && mode === 'register' && renderPersonalRegisterForm()}
        </BackCard>
      </Flipper>
    </FlipContainer>
  );
};

export default AuthCard;