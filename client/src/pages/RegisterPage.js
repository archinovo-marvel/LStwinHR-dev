import React from 'react';
import RegisterForm from '../components/RegisterForm';
import AuthLayout from '../components/AuthLayout';

const RegisterPage = () => {
  return (
    <AuthLayout title="创建账号" subtitle="注册您的账号开始使用">
      <RegisterForm />
    </AuthLayout>
  );
};

export default RegisterPage;
