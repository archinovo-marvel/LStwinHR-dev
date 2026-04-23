import React from 'react';
import AuthCard from './AuthCard';
import { useAuth } from '../context/AuthContext';

const LoginForm = () => {
  const { loginCorp, loginPersonal } = useAuth();

  const handleCorpLogin = async ({ username, password }) => {
    try {
      await loginCorp({ email: username, password });
      message.success('登录成功');
    } catch (e) {
      message.error(e.message || '登录失败');
    }
  };

  const handlePersonalLogin = async ({ username, password }) => {
    try {
      await loginPersonal({ email: username, password });
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