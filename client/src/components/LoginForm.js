import React from 'react';
import { Form, Input, Button, Checkbox, message, Modal, Space } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';

// 主色调定义
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
};

// 表单容器 - 确保所有元素宽度一致
const FormWrapper = styled.div`
  width: 100%;
  
  & > * {
    width: 100%;
  }
`;

// 样式化表单 - 统一间距
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

// 输入框统一样式 - 宽度100%
const StyledInput = styled(Input)`
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
    color: ${colors.muted};
  }
  
  .ant-input-prefix {
    color: ${colors.muted};
    margin-right: 10px;
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
    color: ${colors.muted};
  }
  
  .ant-input-prefix {
    color: ${colors.muted};
    margin-right: 10px;
  }
  
  .ant-input-suffix {
    color: ${colors.muted};
  }
`;

// 主按钮 - 宽度100%与输入框对齐
const PrimaryButton = styled(Button)`
  width: 100%;
  height: 44px;
  border-radius: 10px;
  font-weight: 500;
  font-size: 15px;
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
  
  &:active {
    transform: translateY(0);
  }
`;

// 记住我 + 忘记密码行
const FormRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  width: 100%;
`;

const ForgotLink = styled.a`
  font-size: 13px;
  color: ${colors.primary};
  cursor: pointer;
  
  &:hover {
    color: ${colors.primaryHover};
  }
`;

// 分隔线
const DividerLine = styled.div`
  display: flex;
  align-items: center;
  margin: 24px 0;
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
    color: ${colors.muted};
  }
`;

// 注册链接
const RegisterLink = styled.div`
  text-align: center;
  font-size: 14px;
  color: ${colors.text};
  width: 100%;
  
  a {
    color: ${colors.primary};
    font-weight: 500;
    margin-left: 4px;
    
    &:hover {
      color: ${colors.primaryHover};
    }
  }
`;

// 忘记密码弹窗样式
const ModalInput = styled(Input)`
  width: 100%;
  height: 44px;
  border-radius: 10px;
  border: 1px solid ${colors.border};
  
  &:hover,
  &:focus {
    border-color: ${colors.primary};
  }
  
  .ant-input-prefix {
    color: ${colors.muted};
    margin-right: 10px;
  }
`;

const ModalPasswordInput = styled(Input.Password)`
  width: 100%;
  height: 44px;
  border-radius: 10px;
  border: 1px solid ${colors.border};
  
  &:hover,
  &:focus {
    border-color: ${colors.primary};
  }
  
  .ant-input-prefix {
    color: ${colors.muted};
    margin-right: 10px;
  }
`;

const CodeButton = styled(Button)`
  height: 44px;
  border-radius: 10px;
  min-width: 110px;
  font-weight: 500;
`;

const LoginForm = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [isForgotModalVisible, setIsForgotModalVisible] = React.useState(false);
  const [forgotForm] = Form.useForm();
  const [countdown, setCountdown] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const prefillUsername = sessionStorage.getItem('prefillUsername');
    const prefillPassword = sessionStorage.getItem('prefillPassword');
    if (prefillUsername || prefillPassword) {
      form.setFieldsValue({
        username: prefillUsername || '',
        password: prefillPassword || ''
      });
      sessionStorage.removeItem('prefillUsername');
      sessionStorage.removeItem('prefillPassword');
    }
  }, [form]);

  React.useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    try {
      const values = await forgotForm.validateFields(['username', 'email']);
      const response = await fetch('/api/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: values.email, 
          userId: values.username, 
          type: 'reset' 
        }),
      });

      const data = await response.json();
      if (response.ok) {
        message.success('验证码已发送至您的邮箱');
        setCountdown(60);
      } else {
        message.error(data.message || '发送失败');
      }
    } catch (error) {
      if (error.errorFields) return;
      message.error('发送验证码失败，请重试');
    }
  };

  const handleResetPassword = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: values.username,
          email: values.email,
          verificationCode: values.verificationCode,
          newPassword: values.newPassword,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        message.success('密码重置成功，请使用新密码登录');
        setIsForgotModalVisible(false);
        forgotForm.resetFields();
      } else {
        message.error(data.message || '重置失败');
      }
    } catch (error) {
      message.error('请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values) => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: values.username, password: values.password }),
      });

      if (response.ok) {
        const data = await response.json();
        message.success('登录成功');
        login({ 
          id: data.user.id,
          name: data.user.name, 
          email: data.user.email,
          phone: data.user.phone,
          role: data.user.role,
          token: data.token 
        });
        navigate('/');
      } else {
        const errorData = await response.json();
        console.error('Login failed:', errorData.message);
        message.error(errorData.message || '登录失败，请检查用户名和密码');
      }
    } catch (error) {
      console.error('An error occurred during login:', error);
      message.error('登录请求发生错误，请稍后重试');
    }
  };

  return (
    <>
      <FormWrapper>
        <StyledForm
          form={form}
          name="normal_login"
          initialValues={{ remember: true }}
          onFinish={onFinish}
        >
          {/* 用户名输入框 */}
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入您的用户名!' }]}
          >
            <StyledInput 
              prefix={<UserOutlined />} 
              placeholder="用户名" 
            />
          </Form.Item>
          
          {/* 密码输入框 */}
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入您的密码!' }]}
          >
            <StyledPasswordInput 
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          {/* 记住我 + 忘记密码 */}
          <FormRow>
            <Checkbox style={{ fontSize: '13px', color: colors.text }}>
              记住我
            </Checkbox>
            <ForgotLink onClick={() => setIsForgotModalVisible(true)}>
              忘记密码?
            </ForgotLink>
          </FormRow>

          {/* 登录按钮 */}
          <Form.Item style={{ marginBottom: 0 }}>
            <PrimaryButton type="primary" htmlType="submit">
              登录
            </PrimaryButton>
          </Form.Item>

          {/* 分隔线 */}
          <DividerLine>
            <span>或</span>
          </DividerLine>

          {/* 注册链接 */}
          <RegisterLink>
            还没有账号?<Link to="/register">立即注册</Link>
          </RegisterLink>
        </StyledForm>
      </FormWrapper>

      {/* 忘记密码弹窗 */}
      <Modal
        title="重置密码"
        open={isForgotModalVisible}
        onCancel={() => setIsForgotModalVisible(false)}
        footer={null}
        width={440}
        centered
      >
        <Form
          form={forgotForm}
          layout="vertical"
          onFinish={handleResetPassword}
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <ModalInput prefix={<UserOutlined />} placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            name="email"
            label="注册邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱格式' }
            ]}
          >
            <ModalInput prefix={<MailOutlined />} placeholder="请输入注册邮箱" />
          </Form.Item>

          <Form.Item label="验证码" required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="verificationCode"
                noStyle
                rules={[{ required: true, message: '请输入验证码' }]}
              >
                <ModalInput prefix={<SafetyCertificateOutlined />} placeholder="6位验证码" style={{ width: '100%' }} />
              </Form.Item>
              <CodeButton 
                onClick={handleSendCode} 
                disabled={countdown > 0}
                type="primary"
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </CodeButton>
            </Space.Compact>
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[{ required: true, message: '请输入新密码' }]}
          >
            <ModalPasswordInput prefix={<LockOutlined />} placeholder="请输入新密码" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            rules={[{ required: true, message: '请再次输入新密码' }]}
          >
            <ModalPasswordInput prefix={<LockOutlined />} placeholder="请再次输入新密码" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <PrimaryButton type="primary" htmlType="submit" loading={loading}>
              重置密码
            </PrimaryButton>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default LoginForm;
