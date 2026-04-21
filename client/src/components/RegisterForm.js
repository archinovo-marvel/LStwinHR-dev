import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Checkbox, message, Spin } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, SafetyCertificateOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { colors } from '../../theme/colors';

// 表单容器
const FormWrapper = styled.div`
  width: 100%;
`;

// 样式化表单
const StyledForm = styled(Form)`
  width: 100%;
  .ant-form-item {
    margin-bottom: 16px;
    width: 100%;
  }
  .ant-form-item-control-input {
    min-height: 44px;
  }
  .ant-form-item-control-input-content {
    width: 100%;
  }
`;

// 表单分组
const FormSection = styled.div`
  margin-bottom: 24px;
  width: 100%;
`;

// 分组标题 - 轻量级样式
const SectionTitle = styled.div`
  font-size: 11px;
  font-weight: 500;
  color: ${colors.textMuted};
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 12px;
`;

// 输入框统一样式 - 与登录页一致
const StyledInput = styled(Input)`
  width: 100%;
  height: 48px;
  border-radius: 8px;
  border: 1px solid ${colors.border};
  padding: 0 16px;
  font-size: 14px;
  transition: all 0.25s ease;
  background: ${colors.cardBg};

  &:hover {
    border-color: ${colors.highlight};
  }

  &:focus,
  &.ant-input-focused {
    border-color: ${colors.highlight};
    box-shadow: 0 0 0 3px rgba(139, 115, 85, 0.1);
  }

  &::placeholder {
    color: ${colors.textMuted};
  }

  .ant-input-prefix {
    color: ${colors.textMuted};
    margin-right: 12px;
  }
`;

const StyledPasswordInput = styled(Input.Password)`
  width: 100%;
  height: 44px;
  border-radius: 10px;
  border: 1px solid ${colors.border};
  padding: 0 14px;
  font-size: 14px;
  transition: all 0.2s ease;
  &:hover {
    border-color: ${colors.primary};
  }
  &:focus,
  &.ant-input-focused {
    border-color: ${colors.primary};
    box-shadow: 0 0 0 3px ${colors.primaryLight};
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

// 验证码区域容器
const CodeInputWrapper = styled.div`
  display: flex;
  width: 100%;
  gap: 12px;
`;

// 验证码输入框
const CodeInput = styled(Input)`
  flex: 1;
  height: 44px;
  border-radius: 10px;
  border: 1px solid ${colors.border};
  padding: 0 14px;
  font-size: 14px;
  transition: all 0.2s ease;
  &:hover {
    border-color: ${colors.primary};
  }
  &:focus,
  &.ant-input-focused {
    border-color: ${colors.primary};
    box-shadow: 0 0 0 3px ${colors.primaryLight};
  }
  &::placeholder {
    color: ${colors.textMuted};
  }
  .ant-input-prefix {
    color: ${colors.textMuted};
    margin-right: 10px;
  }
`;

// 验证码按钮 - 与登录页一致
const CodeButton = styled(Button)`
  height: 44px;
  border-radius: 10px;
  min-width: 110px;
  font-weight: 500;
  border: 1px solid ${colors.primary};
  color: ${colors.primary};
  &:hover {
    background: ${colors.primaryLight};
    border-color: ${colors.primary};
    color: ${colors.primary};
  }
  &:disabled {
    border-color: ${colors.border};
    color: ${colors.textMuted};
    background: transparent;
  }
`;

// 主按钮 - 与登录页一致
const PrimaryButton = styled(Button)`
  width: 100%;
  height: 48px;
  border-radius: 8px;
  font-weight: 400;
  font-size: 14px;
  letter-spacing: 0.05em;
  background: ${colors.primary};
  border-color: ${colors.primary};
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    background: ${colors.highlight} !important;
    border-color: ${colors.highlight} !important;
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

// 协议行 - 居中对齐
const AgreementRow = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
  width: 100%;
`;

const AgreementText = styled.div`
  font-size: 13px;
  color: ${colors.text};
  a {
    color: ${colors.primary};
    &:hover {
      color: ${colors.primaryHover};
    }
  }
`;

// 分隔线 - 与登录页一致
const DividerLine = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 20px 0;
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
    white-space: nowrap;
  }
`;

// 登录链接 - 与登录页一致
const LoginLink = styled.div`
  text-align: center;
  font-size: 14px;
  color: ${colors.textMuted};
  width: 100%;

  a {
    color: ${colors.text};
    font-weight: 400;
    margin-left: 4px;
    position: relative;

    &::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 100%;
      height: 1px;
      background: ${colors.accent};
      transform: scaleX(0);
      transform-origin: right;
      transition: transform 0.3s ease;
    }

    &:hover {
      color: ${colors.text};
    }

    &:hover::after {
      transform: scaleX(1);
      transform-origin: left;
    }
  }
`;

// 验证状态提示样式
const ValidationStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: -8px;
  margin-bottom: 8px;
  padding-left: 14px;
  font-size: 12px;
  color: ${props => props.valid ? '#52c41a' : '#ff4d4f'};
`;

const CheckingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: -8px;
  margin-bottom: 8px;
  padding-left: 14px;
  font-size: 12px;
  color: ${colors.textMuted};
`;

// 验证状态图标样式
const StatusIcon = styled.span`
  display: inline-flex;
  align-items: center;
`;

const RegisterForm = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);

  // 实时验证状态
  const [checkingUserId, setCheckingUserId] = useState(false);
  const [userIdStatus, setUserIdStatus] = useState(null); // null | { valid: boolean, message: string }
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [phoneStatus, setPhoneStatus] = useState(null);

  // 防抖定时器
  const userIdTimer = useRef(null);
  const emailTimer = useRef(null);
  const phoneTimer = useRef(null);

  // 检查重复信息的函数
  const checkDuplicate = async (field, value, setStatus, setChecking) => {
    if (!value || value.trim() === '') {
      setStatus(null);
      setChecking(false);
      return;
    }

    // 先进行格式验证
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
        console.error('检查重复API返回错误:', response.status);
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
      console.error('检查重复失败:', error);
      if (error.name === 'AbortError') {
        message.warning('检查超时，已跳过');
      }
      setStatus(null);
    }
    setChecking(false);
  };

  // 带防抖的检查函数
  const debouncedCheck = (field, value, setStatus, setChecking, timerRef) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      checkDuplicate(field, value, setStatus, setChecking);
    }, 500); // 500ms 防抖
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async () => {
    try {
      const email = form.getFieldValue('email');
      if (!email) {
        message.error('请先填写邮箱地址');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        message.error('请填写正确的邮箱地址');
        return;
      }
      setSendingCode(true);
      const response = await fetch('/api/send-verification-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, type: 'register' }),
      });
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (response.ok) {
          message.success(data.message || '验证码已发送，请查收邮件');
          setCountdown(60);
        } else if (response.status === 429) {
          message.warning(data.message);
          if (data.waitTime) {
            setCountdown(data.waitTime);
          }
        } else {
          message.error(data.message || '发送验证码失败');
        }
      } else {
        const text = await response.text();
        console.error('非JSON响应:', text);
        if (response.status === 504) {
          message.error('请求超时，请检查后端服务是否正常运行');
        } else {
          message.error('服务器响应异常，请稍后重试');
        }
      }
    } catch (error) {
      console.error('发送验证码错误:', error);
      message.error('网络错误，请检查网络连接或后端服务状态');
    } finally {
      setSendingCode(false);
    }
  };

  const onFinish = async (values) => {
    // 检查实时验证状态，如果有重复信息则阻止提交
    if (userIdStatus && !userIdStatus.valid) {
      message.error(userIdStatus.message);
      return;
    }
    if (emailStatus && !emailStatus.valid) {
      message.error(emailStatus.message);
      return;
    }
    if (phoneStatus && !phoneStatus.valid) {
      message.error(phoneStatus.message);
      return;
    }

    // 如果正在检查中，等待检查完成
    if (checkingUserId || checkingEmail || checkingPhone) {
      message.warning('正在检查信息，请稍候...');
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: values.userId,
          phone: values.phone,
          email: values.email,
          password: values.password,
          verificationCode: values.verificationCode
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        message.success('注册成功，请使用新账号登录');
        sessionStorage.setItem('prefillUsername', values.userId);
        sessionStorage.setItem('prefillPassword', values.password);
        navigate('/login');
      } else {
        const errorData = await response.json();
        if (errorData.field) {
          form.setFields([
            {
              name: errorData.field,
              errors: [errorData.message]
            }
          ]);
        } else {
          message.error(errorData.message || '注册失败，请稍后重试');
        }
      }
    } catch (error) {
      console.error('注册错误:', error);
      if (error.name === 'AbortError') {
        message.error('注册请求超时，请稍后重试');
      } else {
        message.error('注册请求发生错误，请检查网络');
      }
    }
  };

  return (
    <FormWrapper>
      <StyledForm
        form={form}
        name="register"
        onFinish={onFinish}
        scrollToFirstError
      >
        {/* 基础信息 */}
        <FormSection>
          <SectionTitle>基础信息</SectionTitle>
          {/* 用户ID */}
          <Form.Item
            name="userId"
            rules={[{ required: true, message: '请输入您的用户ID!' }]}
            validateTrigger="onBlur"
          >
            <StyledInput
              prefix={<UserOutlined />}
              placeholder="请输入用户名/ID"
              onChange={(e) => {
                const value = e.target.value;
                if (value.trim()) {
                  setCheckingUserId(true);
                  setUserIdStatus(null);
                  debouncedCheck('userId', value, setUserIdStatus, setCheckingUserId, userIdTimer);
                } else {
                  setCheckingUserId(false);
                  setUserIdStatus(null);
                }
              }}
            />
          </Form.Item>
          {checkingUserId && (
            <CheckingIndicator>
              <Spin size="small" /> 检查中...
            </CheckingIndicator>
          )}
          {userIdStatus && !checkingUserId && (
            <ValidationStatus valid={userIdStatus.valid}>
              {userIdStatus.valid ? (
                <StatusIcon><CheckCircleOutlined /></StatusIcon>
              ) : (
                <StatusIcon><ExclamationCircleOutlined /></StatusIcon>
              )}
              {userIdStatus.message}
            </ValidationStatus>
          )}
          {/* 手机号 */}
          <Form.Item
            name="phone"
            rules={[
              { required: true, message: '请输入您的手机号!' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的11位手机号码!' }
            ]}
            validateTrigger="onBlur"
          >
            <StyledInput
              prefix={<PhoneOutlined />}
              placeholder="请输入11位手机号码"
              onChange={(e) => {
                const value = e.target.value;
                if (/^1[3-9]\d{9}$/.test(value)) {
                  setCheckingPhone(true);
                  setPhoneStatus(null);
                  debouncedCheck('phone', value, setPhoneStatus, setCheckingPhone, phoneTimer);
                } else {
                  setCheckingPhone(false);
                  setPhoneStatus(null);
                }
              }}
            />
          </Form.Item>
          {checkingPhone && (
            <CheckingIndicator>
              <Spin size="small" /> 检查中...
            </CheckingIndicator>
          )}
          {phoneStatus && !checkingPhone && (
            <ValidationStatus valid={phoneStatus.valid}>
              {phoneStatus.valid ? (
                <StatusIcon><CheckCircleOutlined /></StatusIcon>
              ) : (
                <StatusIcon><ExclamationCircleOutlined /></StatusIcon>
              )}
              {phoneStatus.message}
            </ValidationStatus>
          )}
          {/* 邮箱 */}
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入您的邮箱!' },
              { type: 'email', message: '请输入有效的邮箱地址!' }
            ]}
            validateTrigger="onBlur"
          >
            <StyledInput
              prefix={<MailOutlined />}
              placeholder="请输入邮箱地址"
              onChange={(e) => {
                const value = e.target.value;
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (emailRegex.test(value)) {
                  setCheckingEmail(true);
                  setEmailStatus(null);
                  debouncedCheck('email', value, setEmailStatus, setCheckingEmail, emailTimer);
                } else {
                  setCheckingEmail(false);
                  setEmailStatus(null);
                }
              }}
            />
          </Form.Item>
          {checkingEmail && (
            <CheckingIndicator>
              <Spin size="small" /> 检查中...
            </CheckingIndicator>
          )}
          {emailStatus && !checkingEmail && (
            <ValidationStatus valid={emailStatus.valid}>
              {emailStatus.valid ? (
                <StatusIcon><CheckCircleOutlined /></StatusIcon>
              ) : (
                <StatusIcon><ExclamationCircleOutlined /></StatusIcon>
              )}
              {emailStatus.message}
            </ValidationStatus>
          )}
        </FormSection>

        {/* 验证信息 */}
        <FormSection>
          <SectionTitle>验证信息</SectionTitle>
          {/* 验证码 */}
          <Form.Item
            name="verificationCode"
            rules={[
              { required: true, message: '请输入邮箱验证码!' },
              { len: 6, message: '验证码为6位数字!' }
            ]}
          >
            <CodeInputWrapper>
              <CodeInput 
                prefix={<SafetyCertificateOutlined />}
                placeholder="请输入6位验证码" 
                maxLength={6}
              />
              <CodeButton 
                onClick={handleSendCode}
                disabled={countdown > 0 || sendingCode}
                loading={sendingCode}
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </CodeButton>
            </CodeInputWrapper>
          </Form.Item>
        </FormSection>

        {/* 安全信息 */}
        <FormSection>
          <SectionTitle>安全信息</SectionTitle>
          {/* 密码 */}
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入您的密码!' },
              { min: 6, message: '密码至少6位!' }
            ]}
          >
            <StyledPasswordInput 
              prefix={<LockOutlined />}
              placeholder="请输入密码" 
            />
          </Form.Item>
          {/* 确认密码 */}
          <Form.Item
            name="confirm"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认您的密码!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('您输入的两个密码不匹配!'));
                },
              }),
            ]}
          >
            <StyledPasswordInput 
              prefix={<LockOutlined />}
              placeholder="请再次输入密码" 
            />
          </Form.Item>
        </FormSection>

        {/* 协议 */}
        <Form.Item
          name="agreement"
          valuePropName="checked"
          rules={[
            {
              validator: (_, value) =>
                value ? Promise.resolve() : Promise.reject(new Error('请接受协议')),
            },
          ]}
          style={{ marginBottom: 0 }}
        >
          <AgreementRow>
            <Checkbox>
              <AgreementText>
                我已经阅读并同意 <a href="">服务协议</a>
              </AgreementText>
            </Checkbox>
          </AgreementRow>
        </Form.Item>

        {/* 注册按钮 */}
        <Form.Item style={{ marginBottom: 0 }}>
          <PrimaryButton type="primary" htmlType="submit">
            注册
          </PrimaryButton>
        </Form.Item>

        {/* 分隔线 */}
        <DividerLine>
          <span>或</span>
        </DividerLine>

        {/* 登录链接 */}
        <LoginLink>
          已有账号?<Link to="/login">立即登录</Link>
        </LoginLink>
      </StyledForm>
    </FormWrapper>
  );
};

export default RegisterForm;
