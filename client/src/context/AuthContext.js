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
    // 存储用户信息到localStorage
    const userInfo = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      company: userData.company,
      memberLevel: userData.memberLevel || '普通会员',
      role: userData.role
    };
    localStorage.setItem('user', JSON.stringify(userInfo));
    setUser(userInfo);
  };

  const logout = () => {
    // 清除localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
