import React, { useState, useEffect } from 'react';
import { Layout as AntLayout } from 'antd';
import styled from 'styled-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import { colors } from '../theme/colors';

const { Content } = AntLayout;

const StyledLayout = styled(AntLayout)`
  min-height: 100vh;
  background: ${colors.bg};
`;

const Nav = styled.nav`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: 72px;
  padding: 0 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: ${props => props.$scrolled
    ? 'rgba(248, 250, 252, 0.92)'
    : 'transparent'};
  backdrop-filter: ${props => props.$scrolled ? 'blur(16px)' : 'none'};
  border-bottom: 1px solid ${props => props.$scrolled ? colors.border : 'transparent'};
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
`;

const NavLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 36px;
`;

const NavLinksLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 36px;
  margin-right: 48px;
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
`;

const LogoImg = styled.img`
  height: 64px;
  width: auto;
  transition: opacity 0.3s ease;
`;

const LogoText = styled.span`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 17px;
  font-weight: 500;
  color: ${props => props.$scrolled ? colors.text : '#FFFFFF'};
  letter-spacing: 0.05em;
  transition: color 0.3s ease;
`;

const NavRight = styled.div`
  display: flex;
  align-items: center;
  gap: 36px;
`;

const NavLink = styled.button`
  background: none;
  border: none;
  padding: 8px 0;
  font-size: 14px;
  color: ${props => props.$scrolled ? colors.text : '#FFFFFF'};
  cursor: pointer;
  position: relative;
  transition: color 0.3s ease;
  font-family: inherit;
  font-weight: 400;
  text-shadow: ${props => props.$scrolled ? 'none' : '0 1px 3px rgba(0,0,0,0.4)'};

  &::after {
    content: '';
    position: absolute;
    bottom: 4px;
    left: 0;
    width: ${props => props.$active ? '100%' : '0'};
    height: 1px;
    background: ${props => props.$scrolled ? colors.accent : 'rgba(255,255,255,0.8)'};
    transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  &:hover {
    color: ${colors.text};
    text-shadow: none;
  }

  &:hover::after {
    width: 100%;
  }

  &:active {
    transform: scale(0.98);
  }
`;

const StyledContent = styled(Content)`
  margin: 0;
  padding: 0;
  background: ${colors.bg};
`;

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isHomePage = location.pathname === '/';
  const [scrolled, setScrolled] = useState(!isHomePage);

  useEffect(() => {
    if (!isHomePage) {
      setScrolled(true);
      return;
    }
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHomePage]);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const viewportHeight = window.innerHeight;
      const targetY = top - (viewportHeight / 2) + (el.offsetHeight / 2);
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    }
  };

  const guestNavLinks = [
    { label: '关于我们', action: () => scrollToSection('statement') },
    { label: '了解我们', action: () => scrollToSection('services') },
    { label: '加入我们', action: () => scrollToSection('footer') },
  ];

  // Get userType from user object (stored in localStorage via AuthContext)
  const userType = user?.userType || 'CORP';

  // Left side links — change based on userType
  const leftLinks = userType === 'PERSONAL' ? [
    { label: '关于我们', action: () => scrollToSection('statement') },
    { label: '了解我们', action: () => scrollToSection('services') },
    { label: '加入我们', action: () => scrollToSection('footer') },
    { label: '简历优化', action: () => navigate('/personal/resume') },
  ] : [
    { label: '关于我们', action: () => scrollToSection('statement') },
    { label: '了解我们', action: () => scrollToSection('services') },
    { label: '加入我们', action: () => scrollToSection('footer') },
    { label: '简历初筛', action: () => navigate('/resume') },
    { label: '候选管理', action: () => navigate('/resume-analysis') },
    { label: '面试访谈', action: () => navigate('/chat') },
  ];

  // Right side links — always these (except for guest)
  const rightLinks = user ? [
    { label: '个人资料', action: () => navigate('/profile') },
    { label: `${user.name}欢迎回来`, action: () => {} },
    { label: '退出登录', action: () => { logout(); navigate('/'); } },
  ] : [];

  return (
    <StyledLayout>
      <Nav $scrolled={scrolled}>
        <NavLeft>
          <Logo onClick={() => navigate(user ? '/dashboard' : '/')}>
            <LogoImg src="/logo.png" alt="LStwin" />
            <LogoText $scrolled={scrolled}>招聘灵犀</LogoText>
          </Logo>
          <NavLinksLeft>
            {leftLinks.map(link => (
              <NavLink
                key={link.label}
                $scrolled={scrolled}
                onClick={link.action}
              >
                {link.label}
              </NavLink>
            ))}
          </NavLinksLeft>
        </NavLeft>
        <NavRight>
          {rightLinks.map(link => (
            <NavLink
              key={link.label}
              $scrolled={scrolled}
              onClick={link.action}
            >
              {link.label}
            </NavLink>
          ))}
        </NavRight>
      </Nav>
      <StyledContent>
        {children}
      </StyledContent>
    </StyledLayout>
  );
};

export default Layout;
