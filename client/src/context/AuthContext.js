import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // 从localStorage恢复用户信息
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = (userData) => {
    // 存储token到localStorage
    if (userData.token) {
      localStorage.setItem('token', userData.token);
    }
    // 存储用户类型到localStorage
    const userType = userData.userType || 'CORP';
    localStorage.setItem('userType', userType);
    // 存储用户信息到localStorage
    const userInfo = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      company: userData.company,
      memberLevel: userData.memberLevel || '普通会员',
      role: userData.role,
      userType
    };
    localStorage.setItem('user', JSON.stringify(userInfo));
    setUser(userInfo);
  };

  const loginCorp = async ({ email, password }) => {
    const res = await fetch('/api/corp/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    localStorage.setItem('token', data.token);
    localStorage.setItem('userType', 'CORP');
    const userInfo = { id: data.user.id, name: data.user.name, email: data.user.email, phone: data.user.phone, company: data.user.company, memberLevel: data.user.memberLevel, role: data.user.role, userType: 'CORP' };
    localStorage.setItem('user', JSON.stringify(userInfo));
    setUser(userInfo);
    return data;
  };

  const loginPersonal = async ({ email, password }) => {
    const res = await fetch('/api/personal/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    localStorage.setItem('token', data.token);
    localStorage.setItem('userType', 'PERSONAL');
    const userInfo = { id: data.user.id, name: data.user.name, email: data.user.email, memberLevel: data.user.memberLevel, role: data.user.role, userType: 'PERSONAL' };
    localStorage.setItem('user', JSON.stringify(userInfo));
    setUser(userInfo);
    return data;
  };

  const logout = () => {
    // 清除localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loginCorp, loginPersonal }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
