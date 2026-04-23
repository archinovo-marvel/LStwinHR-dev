import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Checkbox, message, Spin } from 'antd';
import { BankOutlined, UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, SafetyCertificateOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { colors } from '../theme/colors';

// ============================================
// WRAPPER
// ============================================
const AuthWrapper = styled.div`
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
`;

// ============================================
// CARD
// ============================================
const AuthCard = styled.div`
  background: ${colors.surface};
  border-radius: 16px;
  border: 1px solid ${colors.border};
  box-shadow: 0 1px 4px rgba(15,23,42,0.04);
  overflow: hidden;
`;

// ============================================
// TAB BAR
// ============================================
const TabBar = styled.div`
  display: flex;
  border-bottom: 1px solid ${colors.border};
  background: ${colors.frost};
`;

const Tab = styled.button`
  flex: 1;
  height: 52px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.$active ? colors.primary : colors.muted};
  cursor: pointer;
  position: relative;
  transition: color 0.2s ease;

  &:hover {
    color: ${colors.text};
  }

  ${props => props.$active && `
    color: ${colors.primary};
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: ${colors.primary};
      border-radius: 2px 2px 0 0;
    }
  `}
`;

// ============================================
// CARD BODY
// ============================================
const CardBody = styled.div`
  padding: 28px 32px 24px;
`;

// ============================================
// ICON BADGE
// ============================================
const IconBadge = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: ${props => props.$variant === 'corp' ? colors.primary : colors.success}18;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.$variant === 'corp' ? colors.primary : colors.success};
  font-size: 20px;
  margin-bottom: 20px;
`;

// ============================================
// FORM
// ============================================
const StyledForm = styled(Form)`
  .ant-form-item {
    margin-bottom: 16px;
  }
`;

const StyledInput = styled(Input)`
  height: 44px;
  border-radius: 10px;
  border-color: ${colors.border};
  font-size: 14px;

  &:hover {
    border-color: #94A3BB;
  }

  &:focus, &.ant-input-focused {
    border-color: ${colors.primary};
    box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
  }

  .ant-input-prefix {
    color: ${colors.muted};
    margin-right: 10px;
  }
`;

const StyledPassword = styled(Input.Password)`
  height: 44px;
  border-radius: 10px;
  border-color: ${colors.border};
  font-size: 14px;

  &:hover {
    border-color: #94A3BB;
  }

  &:focus, &.ant-input-affix-wrapper-focused {
    border-color: ${colors.primary};
    box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
  }

  .ant-input-prefix {
    color: ${colors.muted};
    margin-right: 10px;
  }
`;

const CodeRow = styled.div`
  display: flex;
  gap: 10px;
`;

const CodeInput = styled(Input)`
  flex: 1;
  height: 44px;
  border-radius: 10px;
  border-color: ${colors.border};
  font-size: 14px;

  &:focus {
    border-color: ${colors.primary};
    box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
  }

  .ant-input-prefix {
    color: ${colors.muted};
    margin-right: 10px;
  }
`;

const CodeBtn = styled(Button)`
  height: 44px;
  border-radius: 10px;
  min-width: 108px;
  font-size: 13px;
  font-weight: 500;
  border-color: ${colors.border};
  color: ${colors.text};

  &:hover:not(:disabled) {
    border-color: ${colors.primary};
    color: ${colors.primary};
    background: ${colors.primaryLight};
  }

  &:disabled {
    color: ${colors.muted};
    border-color: ${colors.border};
  }
`;

const SubmitBtn = styled(Button)`
  width: 100%;
  height: 46px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  background: ${colors.primary};
  border-color: ${colors.primary};
  box-shadow: 0 2px 8px rgba(37,99,235,0.2);
  margin-top: 4px;

  &:hover {
    background: ${colors.primaryDark} !important;
    border-color: ${colors.primaryDark} !important;
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(37,99,235,0.25) !important;
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    background: ${colors.border};
    border-color: ${colors.border};
    box-shadow: none;
  }
`;

// ============================================
// SECTION
// ============================================
const FieldSection = styled.div`
  margin-bottom: 16px;
`;

const SectionLabel = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: ${colors.muted};
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 12px;
`;

// ============================================
// VALIDATION STATUS
// ============================================
const ValidationRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-top: -10px;
  margin-bottom: 6px;
  padding-left: 2px;
  color: ${props => props.$valid === true ? '#22c55e' : props.$valid === false ? '#ef4444' : colors.muted};
`;

// ============================================
// FOOTER
// ============================================
const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 16px 32px 20px;
  font-size: 14px;
  color: ${colors.muted};
  border-top: 1px solid ${colors.border};
  background: ${colors.frost};

  a {
    color: ${colors.primary};
    font-weight: 500;
    text-decoration: none;
    margin-left: 4px;

    &:hover {
      text-decoration: underline;
    }
  }
`;

// ============================================
// CHECKBOX
// ============================================
const StyledCheckbox = styled(Checkbox)`
  font-size: 13px;
  color: ${colors.muted};

  a {
    color: ${colors.primary};
  }
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

  const [corpCountdown, setCorpCountdown] = useState(0);
  const [personalCountdown, setPersonalCountdown] = useState(0);
  const [sendingCorpCode, setSendingCorpCode] = useState(false);
  const [sendingPersonalCode, setSendingPersonalCode] = useState(false);

  const [checkingCorpUserId, setCheckingCorpUserId] = useState(false);
  const [corpUserIdStatus, setCorpUserIdStatus] = useState(null);
  const [checkingCorpEmail, setCheckingCorpEmail] = useState(false);
  const [corpEmailStatus, setCorpEmailStatus] = useState(null);
  const [checkingCorpPhone, setCheckingCorpPhone] = useState(false);
  const [corpPhoneStatus, setCorpPhoneStatus] = useState(null);

  const [checkingPersonalUserId, setCheckingPersonalUserId] = useState(false);
  const [personalUserIdStatus, setPersonalUserIdStatus] = useState(null);
  const [checkingPersonalEmail, setCheckingPersonalEmail] = useState(false);
  const [personalEmailStatus, setPersonalEmailStatus] = useState(null);

  const corpUserIdTimer = useRef(null);
  const corpEmailTimer = useRef(null);
  const corpPhoneTimer = useRef(null);
  const personalUserIdTimer = useRef(null);
  const personalEmailTimer = useRef(null);

  const checkDuplicate = async (field, value, setStatus, setChecking) => {
    if (!value || value.trim() === '') {
      setStatus(null);
      setChecking(false);
      return;
    }
    if (field === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) { setStatus(null); setChecking(false); return; }
    }
    if (field === 'phone') {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(value)) { setStatus(null); setChecking(false); return; }
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
      if (!response.ok) { setStatus(null); setChecking(false); return; }
      const data = await response.json();
      if (data.success && data.exists) {
        setStatus({ valid: false, message: data.message });
      } else if (data.success) {
        setStatus({ valid: true, message: '可用' });
      } else {
        setStatus(null);
      }
    } catch (error) {
      if (error.name !== 'AbortError') console.error('检查重复失败:', error);
      setStatus(null);
    }
    setChecking(false);
  };

  const debouncedCheck = (field, value, setStatus, setChecking, timerRef) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      checkDuplicate(field, value, setStatus, setChecking);
    }, 500);
  };

  useEffect(() => {
    let timer;
    if (corpCountdown > 0) timer = setTimeout(() => setCorpCountdown(corpCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [corpCountdown]);

  useEffect(() => {
    let timer;
    if (personalCountdown > 0) timer = setTimeout(() => setPersonalCountdown(personalCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [personalCountdown]);

  const handleSendCorpCode = async () => {
    const email = corpForm.getFieldValue('email');
    if (!email) { message.error('请先填写邮箱地址'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { message.error('请填写正确的邮箱地址'); return; }
    setSendingCorpCode(true);
    try {
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
    } catch { message.error('网络错误'); }
    finally { setSendingCorpCode(false); }
  };

  const handleSendPersonalCode = async () => {
    const email = personalForm.getFieldValue('email');
    if (!email) { message.error('请先填写邮箱地址'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { message.error('请填写正确的邮箱地址'); return; }
    setSendingPersonalCode(true);
    try {
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
    } catch { message.error('网络错误'); }
    finally { setSendingPersonalCode(false); }
  };

  const handleCorpLogin = async ({ username, password }) => {
    try {
      await onCorpLogin({ email: username, password });
      message.success('企业账号登录成功');
    } catch (e) { message.error(e.message || '登录失败'); }
  };

  const handlePersonalLogin = async ({ username, password }) => {
    try {
      await onPersonalLogin({ email: username, password });
      message.success('个人账号登录成功');
    } catch (e) { message.error(e.message || '登录失败'); }
  };

  const handleCorpRegister = async ({ userId, phone, email, verificationCode, password }) => {
    if (corpUserIdStatus && !corpUserIdStatus.valid) { message.error(corpUserIdStatus.message); return; }
    if (corpEmailStatus && !corpEmailStatus.valid) { message.error(corpEmailStatus.message); return; }
    if (corpPhoneStatus && !corpPhoneStatus.valid) { message.error(corpPhoneStatus.message); return; }
    if (checkingCorpUserId || checkingCorpEmail || checkingCorpPhone) { message.warning('正在检查信息，请稍候...'); return; }
    try {
      await onCorpRegister({ userId, phone, email, verificationCode, password });
      message.success('注册成功，请登录');
      navigate('/login');
    } catch (e) { message.error(e.message || '注册失败'); }
  };

  const handlePersonalRegister = async ({ userId, email, verificationCode, password }) => {
    if (personalUserIdStatus && !personalUserIdStatus.valid) { message.error(personalUserIdStatus.message); return; }
    if (personalEmailStatus && !personalEmailStatus.valid) { message.error(personalEmailStatus.message); return; }
    if (checkingPersonalUserId || checkingPersonalEmail) { message.warning('正在检查信息，请稍候...'); return; }
    try {
      await onPersonalRegister({ userId, email, verificationCode, password });
      message.success('注册成功，请登录');
      navigate('/login');
    } catch (e) { message.error(e.message || '注册失败'); }
  };

  // ============ CORP LOGIN ============
  const renderCorpLogin = () => (
    <>
      <CardBody>
        <IconBadge $variant="corp"><BankOutlined /></IconBadge>
        <StyledForm form={corpForm} onFinish={handleCorpLogin} scrollToFirstError>
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名!' }]}>
            <StyledInput prefix={<UserOutlined />} placeholder="用户名 / 邮箱" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码!' }]}>
            <StyledPassword prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <SubmitBtn type="primary" htmlType="submit">登录</SubmitBtn>
          </Form.Item>
        </StyledForm>
      </CardBody>
      <CardFooter>
        {mode === 'login' ? (
          <>还没有账号?<Link to="/register">立即注册</Link></>
        ) : (
          <>已有账号?<Link to="/login">立即登录</Link></>
        )}
      </CardFooter>
    </>
  );

  // ============ CORP REGISTER ============
  const renderCorpRegister = () => (
    <>
      <CardBody>
        <IconBadge $variant="corp"><BankOutlined /></IconBadge>
        <StyledForm form={corpForm} onFinish={handleCorpRegister} scrollToFirstError>
          <FieldSection>
            <SectionLabel>基础信息</SectionLabel>
            <Form.Item name="userId" rules={[{ required: true, message: '请输入用户ID!' }]} validateTrigger="onBlur">
              <StyledInput
                prefix={<UserOutlined />}
                placeholder="用户ID"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.trim()) {
                    setCheckingCorpUserId(true);
                    setCorpUserIdStatus(null);
                    debouncedCheck('userId', v, setCorpUserIdStatus, setCheckingCorpUserId, corpUserIdTimer);
                  } else {
                    setCheckingCorpUserId(false);
                    setCorpUserIdStatus(null);
                  }
                }}
              />
            </Form.Item>
            {checkingCorpUserId && <ValidationRow><Spin size="small" />检查中...</ValidationRow>}
            {corpUserIdStatus && !checkingCorpUserId && (
              <ValidationRow $valid={corpUserIdStatus.valid}>
                {corpUserIdStatus.valid ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
                {corpUserIdStatus.message}
              </ValidationRow>
            )}

            <Form.Item name="phone" rules={[{ required: true, message: '请输入手机号!' }, { pattern: /^1[3-9]\d{9}$/, message: '请输入有效11位手机号!' }]} validateTrigger="onBlur">
              <StyledInput
                prefix={<PhoneOutlined />}
                placeholder="手机号码"
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^1[3-9]\d{9}$/.test(v)) {
                    setCheckingCorpPhone(true);
                    setCorpPhoneStatus(null);
                    debouncedCheck('phone', v, setCorpPhoneStatus, setCheckingCorpPhone, corpPhoneTimer);
                  } else {
                    setCheckingCorpPhone(false);
                    setCorpPhoneStatus(null);
                  }
                }}
              />
            </Form.Item>
            {checkingCorpPhone && <ValidationRow><Spin size="small" />检查中...</ValidationRow>}
            {corpPhoneStatus && !checkingCorpPhone && (
              <ValidationRow $valid={corpPhoneStatus.valid}>
                {corpPhoneStatus.valid ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
                {corpPhoneStatus.message}
              </ValidationRow>
            )}

            <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱!' }, { type: 'email', message: '请输入有效邮箱!' }]} validateTrigger="onBlur">
              <StyledInput
                prefix={<MailOutlined />}
                placeholder="邮箱地址"
                onChange={(e) => {
                  const v = e.target.value;
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (emailRegex.test(v)) {
                    setCheckingCorpEmail(true);
                    setCorpEmailStatus(null);
                    debouncedCheck('email', v, setCorpEmailStatus, setCheckingCorpEmail, corpEmailTimer);
                  } else {
                    setCheckingCorpEmail(false);
                    setCorpEmailStatus(null);
                  }
                }}
              />
            </Form.Item>
            {checkingCorpEmail && <ValidationRow><Spin size="small" />检查中...</ValidationRow>}
            {corpEmailStatus && !checkingCorpEmail && (
              <ValidationRow $valid={corpEmailStatus.valid}>
                {corpEmailStatus.valid ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
                {corpEmailStatus.message}
              </ValidationRow>
            )}
          </FieldSection>

          <FieldSection>
            <SectionLabel>验证信息</SectionLabel>
            <Form.Item name="verificationCode" rules={[{ required: true, message: '请输入验证码!' }, { len: 6, message: '验证码为6位!' }]}>
              <CodeRow>
                <CodeInput prefix={<SafetyCertificateOutlined />} placeholder="6位验证码" maxLength={6} />
                <CodeBtn onClick={handleSendCorpCode} disabled={corpCountdown > 0 || sendingCorpCode} loading={sendingCorpCode}>
                  {corpCountdown > 0 ? `${corpCountdown}s` : '获取验证码'}
                </CodeBtn>
              </CodeRow>
            </Form.Item>
          </FieldSection>

          <FieldSection>
            <SectionLabel>安全信息</SectionLabel>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码!' }, { min: 6, message: '密码至少6位!' }]}>
              <StyledPassword prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            <Form.Item
              name="confirm"
              dependencies={['password']}
              rules={[{ required: true, message: '请确认密码!' }, ({ getFieldValue }) => ({ validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error('两次密码不一致!'));
              }})]}
            >
              <StyledPassword prefix={<LockOutlined />} placeholder="确认密码" />
            </Form.Item>
          </FieldSection>

          <Form.Item name="agreement" valuePropName="checked" style={{ marginBottom: 16 }}>
            <StyledCheckbox>我已阅读并同意<a href="">服务协议</a></StyledCheckbox>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <SubmitBtn type="primary" htmlType="submit">注册</SubmitBtn>
          </Form.Item>
        </StyledForm>
      </CardBody>
      <CardFooter>
        已有账号?<Link to="/login">立即登录</Link>
      </CardFooter>
    </>
  );

  // ============ PERSONAL LOGIN ============
  const renderPersonalLogin = () => (
    <>
      <CardBody>
        <IconBadge $variant="personal"><UserOutlined /></IconBadge>
        <StyledForm form={personalForm} onFinish={handlePersonalLogin} scrollToFirstError>
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名!' }]}>
            <StyledInput prefix={<UserOutlined />} placeholder="用户名 / 邮箱" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码!' }]}>
            <StyledPassword prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <SubmitBtn type="primary" htmlType="submit">登录</SubmitBtn>
          </Form.Item>
        </StyledForm>
      </CardBody>
      <CardFooter>
        {mode === 'login' ? (
          <>还没有账号?<Link to="/register">立即注册</Link></>
        ) : (
          <>已有账号?<Link to="/login">立即登录</Link></>
        )}
      </CardFooter>
    </>
  );

  // ============ PERSONAL REGISTER ============
  const renderPersonalRegister = () => (
    <>
      <CardBody>
        <IconBadge $variant="personal"><UserOutlined /></IconBadge>
        <StyledForm form={personalForm} onFinish={handlePersonalRegister} scrollToFirstError>
          <FieldSection>
            <SectionLabel>基础信息</SectionLabel>
            <Form.Item name="userId" rules={[{ required: true, message: '请输入用户ID!' }]} validateTrigger="onBlur">
              <StyledInput
                prefix={<UserOutlined />}
                placeholder="用户ID"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.trim()) {
                    setCheckingPersonalUserId(true);
                    setPersonalUserIdStatus(null);
                    debouncedCheck('userId', v, setPersonalUserIdStatus, setCheckingPersonalUserId, personalUserIdTimer);
                  } else {
                    setCheckingPersonalUserId(false);
                    setPersonalUserIdStatus(null);
                  }
                }}
              />
            </Form.Item>
            {checkingPersonalUserId && <ValidationRow><Spin size="small" />检查中...</ValidationRow>}
            {personalUserIdStatus && !checkingPersonalUserId && (
              <ValidationRow $valid={personalUserIdStatus.valid}>
                {personalUserIdStatus.valid ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
                {personalUserIdStatus.message}
              </ValidationRow>
            )}

            <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱!' }, { type: 'email', message: '请输入有效邮箱!' }]} validateTrigger="onBlur">
              <StyledInput
                prefix={<MailOutlined />}
                placeholder="邮箱地址"
                onChange={(e) => {
                  const v = e.target.value;
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (emailRegex.test(v)) {
                    setCheckingPersonalEmail(true);
                    setPersonalEmailStatus(null);
                    debouncedCheck('email', v, setPersonalEmailStatus, setCheckingPersonalEmail, personalEmailTimer);
                  } else {
                    setCheckingPersonalEmail(false);
                    setPersonalEmailStatus(null);
                  }
                }}
              />
            </Form.Item>
            {checkingPersonalEmail && <ValidationRow><Spin size="small" />检查中...</ValidationRow>}
            {personalEmailStatus && !checkingPersonalEmail && (
              <ValidationRow $valid={personalEmailStatus.valid}>
                {personalEmailStatus.valid ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
                {personalEmailStatus.message}
              </ValidationRow>
            )}
          </FieldSection>

          <FieldSection>
            <SectionLabel>验证信息</SectionLabel>
            <Form.Item name="verificationCode" rules={[{ required: true, message: '请输入验证码!' }, { len: 6, message: '验证码为6位!' }]}>
              <CodeRow>
                <CodeInput prefix={<SafetyCertificateOutlined />} placeholder="6位验证码" maxLength={6} />
                <CodeBtn onClick={handleSendPersonalCode} disabled={personalCountdown > 0 || sendingPersonalCode} loading={sendingPersonalCode}>
                  {personalCountdown > 0 ? `${personalCountdown}s` : '获取验证码'}
                </CodeBtn>
              </CodeRow>
            </Form.Item>
          </FieldSection>

          <FieldSection>
            <SectionLabel>安全信息</SectionLabel>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码!' }, { min: 6, message: '密码至少6位!' }]}>
              <StyledPassword prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            <Form.Item
              name="confirm"
              dependencies={['password']}
              rules={[{ required: true, message: '请确认密码!' }, ({ getFieldValue }) => ({ validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error('两次密码不一致!'));
              }})]}
            >
              <StyledPassword prefix={<LockOutlined />} placeholder="确认密码" />
            </Form.Item>
          </FieldSection>

          <Form.Item name="agreement" valuePropName="checked" style={{ marginBottom: 16 }}>
            <StyledCheckbox>我已阅读并同意<a href="">服务协议</a></StyledCheckbox>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <SubmitBtn type="primary" htmlType="submit">注册</SubmitBtn>
          </Form.Item>
        </StyledForm>
      </CardBody>
      <CardFooter>
        已有账号?<Link to="/login">立即登录</Link>
      </CardFooter>
    </>
  );

  return (
    <AuthWrapper>
      <AuthCard>
        <TabBar>
          <Tab $active={activeTab === 'corp'} onClick={() => setActiveTab('corp')}>
            企业账号
          </Tab>
          <Tab $active={activeTab === 'personal'} onClick={() => setActiveTab('personal')}>
            个人账号
          </Tab>
        </TabBar>

        {activeTab === 'corp' && mode === 'login' && renderCorpLogin()}
        {activeTab === 'corp' && mode === 'register' && renderCorpRegister()}
        {activeTab === 'personal' && mode === 'login' && renderPersonalLogin()}
        {activeTab === 'personal' && mode === 'register' && renderPersonalRegister()}
      </AuthCard>
    </AuthWrapper>
  );
};

export default AuthCard;
