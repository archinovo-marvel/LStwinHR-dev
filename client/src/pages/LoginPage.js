import React from 'react';
import LoginForm from '../components/LoginForm';
import AuthLayout from '../components/AuthLayout';

const LoginPage = () => {
  return (
    <AuthLayout title="欢迎回来" subtitle="请登录您的账号继续使用">
      <LoginForm />
    </AuthLayout>
  );
};

export default LoginPage;
