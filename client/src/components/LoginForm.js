import React from 'react';
import { App } from 'antd';
import AuthCard from './AuthCard';
import { useAuth } from '../context/AuthContext';

const LoginForm = () => {
  const { message } = App.useApp();
  const { loginCorp, loginPersonal } = useAuth();

  const handleCorpLogin = async ({ email, password }) => {
    try {
      await loginCorp({ email, password });
      message.success('登录成功');
    } catch (e) {
      message.error(e.message || '登录失败');
    }
  };

  const handlePersonalLogin = async ({ email, password }) => {
    try {
      await loginPersonal({ email, password });
      message.success('登录成功');
    } catch (e) {
      message.error(e.message || '登录失败');
    }
  };

  return (
    <AuthCard
      mode="login"
      onCorpLogin={handleCorpLogin}
      onPersonalLogin={handlePersonalLogin}
    />
  );
};

export default LoginForm;