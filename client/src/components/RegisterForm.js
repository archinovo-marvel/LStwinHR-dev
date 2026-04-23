import React from 'react';
import { message } from 'antd';
import AuthCard from './AuthCard';
import { useAuth } from '../context/AuthContext';

const RegisterForm = () => {
  const { loginCorp, loginPersonal } = useAuth();

  const handleCorpRegister = async ({ userId, phone, email, verificationCode, password }) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('/api/corp/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          phone,
          email,
          password,
          verificationCode
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('prefillUsername', userId);
        sessionStorage.setItem('prefillPassword', password);
        return data;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || '注册失败');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('注册请求超时，请稍后重试');
      }
      throw error;
    }
  };

  const handlePersonalRegister = async ({ userId, email, verificationCode, password }) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('/api/personal/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userId,
          email,
          password,
          verificationCode
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('prefillUsername', userId);
        sessionStorage.setItem('prefillPassword', password);
        return data;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || '注册失败');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('注册请求超时，请稍后重试');
      }
      throw error;
    }
  };

  return (
    <AuthCard
      mode="register"
      onCorpRegister={handleCorpRegister}
      onPersonalRegister={handlePersonalRegister}
    />
  );
};

export default RegisterForm;