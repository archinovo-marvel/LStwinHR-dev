import React from 'react';
import { Layout as AntLayout, Menu, Button, Avatar } from 'antd';
import {
  HomeOutlined,
  MessageOutlined,
  UploadOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LoginOutlined,
  DownOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import styled, { keyframes, css } from 'styled-components';
import { useAuth } from '../context/AuthContext';
import LoginPromptModal from './LoginPromptModal';

const { Header, Sider, Content } = AntLayout;

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
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  hoverBg: '#F3F4F6',
  menuShadow: '0 10px 40px rgba(0, 0, 0, 0.08)'
};

const StyledLayout = styled(AntLayout)`
  height: 100vh;
  display: flex;
  flex-direction: row;
  background: ${colors.background};
`;

// 侧边栏样式
const StyledSider = styled(Sider)`
  && {
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    height: 100vh !important;
    z-index: 1001 !important;
    transform: none !important;
    background: ${colors.cardBg} !important;
    border-right: 1px solid ${colors.border};
    box-shadow: none;
    transition: all 0.3s ease;
  }
  
  .ant-layout-sider-children {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  &.ant-layout-sider-collapsed {
    .ant-layout-sider-children {
      width: 80px;
    }
  }
`;

// 品牌区域
const BrandSection = styled.div`
  padding: 24px 16px;
  border-bottom: 1px solid ${colors.border};
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 108px;
  transition: all 0.3s ease;
  
  .ant-layout-sider-collapsed & {
    padding: 10px;
    justify-content: center;
    min-height: 80px;
    height: 80px;
  }
`;

const LogoImage = styled.img`
  width: 60px;
  height: 60px;
  object-fit: contain;
  border-radius: 12px;
  flex-shrink: 0;
  transition: all 0.3s ease;
`;

const BrandText = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  .brand-name {
    font-size: 20px;
    font-weight: 600;
    color: ${colors.title};
    white-space: nowrap;
    letter-spacing: -0.5px;
  }
  
  .brand-desc {
    font-size: 12px;
    color: ${colors.muted};
    white-space: nowrap;
    margin-top: 2px;
  }
`;

// 菜单容器
const MenuContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px 8px;
  
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${colors.border};
    border-radius: 2px;
  }
  
  .ant-menu {
    background: transparent;
    border: none;
  }
  
  .ant-menu-item {
    height: 44px;
    line-height: 44px;
    margin: 4px 0;
    padding: 0 16px !important;
    border-radius: 10px;
    color: ${colors.text};
    font-weight: 500;
    transition: all 0.2s ease;
    
    .anticon {
      font-size: 18px;
      color: ${colors.muted};
      transition: color 0.2s ease;
    }
    
    &:hover {
      background: ${colors.primaryLight};
      color: ${colors.primary};
      
      .anticon {
        color: ${colors.primary};
      }
    }
  }
  
  .ant-menu-item-selected {
    background: ${colors.primaryLight} !important;
    color: ${colors.primary} !important;
    font-weight: 600;
    
    .anticon {
      color: ${colors.primary} !important;
    }
    
    &::after {
      display: none;
    }
  }
  
  .ant-layout-sider-collapsed & {
    .ant-menu-item {
      padding: 0 !important;
      display: flex;
      align-items: center;
      justify-content: center;
      
      .anticon {
        font-size: 18px;
        margin-right: 0;
      }
      
      span:not(.anticon) {
        display: none;
      }
    }
  }
`;

// 底部用户区域
const SidebarFooter = styled.div`
  padding: 16px;
  border-top: 1px solid ${colors.border};
  background: ${colors.cardBg};
`;

// ========== 顶部导航栏优化 ==========

const StyledHeader = styled(Header)`
  background: ${colors.cardBg};
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${colors.divider};
  position: fixed;
  top: 0;
  left: 260px;
  right: 0;
  z-index: 1000;
  height: 60px;
  transition: left 0.3s ease;
  
  &.collapsed {
    left: 80px;
  }
`;

// 折叠按钮
const CollapseButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: ${colors.muted};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${colors.hoverBg};
    color: ${colors.title};
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

// 顶部右侧区域 - 统一图标组
const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

// ========== 用户头像区域优化 ==========

const UserArea = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 10px 4px 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: 4px;
  height: 40px;
  
  &:hover {
    background: ${colors.hoverBg};
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

const UserAvatar = styled.div`
  position: relative;
`;

const UserText = styled.div`
  display: flex;
  flex-direction: column;
  
  .user-name {
    font-size: 14px;
    font-weight: 500;
    color: ${colors.title};
    line-height: 1.2;
  }
  
  .user-greeting {
    font-size: 12px;
    color: ${colors.muted};
    line-height: 1.2;
  }
`;

const DropdownArrow = styled.span`
  font-size: 10px;
  color: ${colors.muted};
  margin-left: 2px;
  transition: transform 0.2s ease;
  
  ${props => props.$isOpen && css`
    transform: rotate(180deg);
  `}
`;

// ========== 下拉菜单优化 ==========

const DropdownMenu = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 200px;
  background: ${colors.cardBg};
  border: 1px solid ${colors.divider};
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  padding: 6px;
  z-index: 1002;
  opacity: 0;
  transform: translateY(-4px);
  animation: ${keyframes`
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  `} 0.15s ease forwards;
`;

const MenuItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: ${colors.text};
  font-size: 14px;
  
  .anticon {
    font-size: 16px;
    color: ${colors.muted};
    transition: color 0.15s ease;
  }
  
  &:hover {
    background: ${colors.hoverBg};
    color: ${colors.title};
    
    .anticon {
      color: ${colors.title};
    }
  }
  
  ${props => props.$danger && css`
    color: ${colors.danger};
    
    .anticon {
      color: ${colors.danger};
    }
    
    &:hover {
      background: #FEF2F2;
    }
  `}
`;

const MenuDivider = styled.div`
  height: 1px;
  background: ${colors.divider};
  margin: 6px 4px;
`;

// 用户信息头部 - 紧凑横向布局
const MenuHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
`;

const MenuHeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  
  .menu-header-name {
    font-size: 14px;
    font-weight: 500;
    color: ${colors.title};
    line-height: 1.2;
  }
  
  .menu-header-email {
    font-size: 12px;
    color: ${colors.muted};
    line-height: 1.2;
  }
`;

// 内容区域
const StyledContent = styled(Content)`
  margin: 0;
  padding: 0;
  background: ${colors.background};
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
`;

const MainContentWrapper = styled.div`
  margin-left: 260px;
  width: calc(100% - 260px);
  transition: all 0.3s ease;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding-top: 60px;
  box-sizing: border-box;
  
  &.collapsed {
    margin-left: 80px;
    width: calc(100% - 80px);
  }
`;

// 下拉菜单容器
const DropdownContainer = styled.div`
  position: relative;
`;

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [loginPromptVisible, setLoginPromptVisible] = React.useState(false);
  const [pendingRoute, setPendingRoute] = React.useState(null);
  const menuRef = React.useRef(null);

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: '首页',
    },
    {
      key: '/resume',
      icon: <UploadOutlined />,
      label: '简历初筛',
    },
    {
      key: '/chat',
      icon: <MessageOutlined />,
      label: '面试访谈',
    },
  ];

  const handleMenuClick = ({ key }) => {
    if (!user && key !== '/') {
      setPendingRoute(key);
      setLoginPromptVisible(true);
      return;
    }
    navigate(key);
  };

  const handleLoginPromptClose = () => {
    setLoginPromptVisible(false);
    setPendingRoute(null);
  };

  const handleLoginPromptConfirm = () => {
    setLoginPromptVisible(false);
    navigate('/login');
  };

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/');
  };

  const handleProfile = () => {
    setMenuOpen(false);
    navigate('/profile');
  };

  const handleCandidateManagement = () => {
    setMenuOpen(false);
    navigate('/resume-analysis');
  };

  // 点击外部关闭菜单
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <StyledLayout>
      <StyledSider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        width={260}
        collapsedWidth={80}
      >
        <BrandSection>
          <LogoImage src="/logo.png" alt="logo" />
          {!collapsed && (
            <BrandText>
              <span className="brand-name">招聘灵犀</span>
              <span className="brand-desc">AI智能招聘平台</span>
            </BrandText>
          )}
        </BrandSection>
        
        <MenuContainer>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </MenuContainer>
        
        {!collapsed && user && (
          <SidebarFooter>
            <UserArea onClick={() => navigate('/profile')}>
              <Avatar 
                size={36}
                icon={<UserOutlined />} 
                style={{ background: colors.primary }}
              />
              <UserText>
                <span className="user-name">{user.name || '用户'}</span>
                <span className="user-role">{user.memberLevel || '普通会员'}</span>
              </UserText>
            </UserArea>
          </SidebarFooter>
        )}
      </StyledSider>
      
      <MainContentWrapper className={collapsed ? 'collapsed' : ''}>
        <StyledHeader className={collapsed ? 'collapsed' : ''}>
          <CollapseButton onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </CollapseButton>
          
          <HeaderRight>
            {user ? (
              <DropdownContainer ref={menuRef}>
                <UserArea onClick={() => setMenuOpen(!menuOpen)}>
                  <UserAvatar>
                    <Avatar 
                      size={32}
                      icon={<UserOutlined />} 
                      style={{ background: colors.primary }}
                    />
                  </UserAvatar>
                  <UserText>
                    <span className="user-name">{user.name || '用户'}</span>
                    <span className="user-greeting">欢迎回来</span>
                  </UserText>
                  <DropdownArrow $isOpen={menuOpen}>
                    <DownOutlined />
                  </DropdownArrow>
                </UserArea>
                
                {menuOpen && (
                  <DropdownMenu>
                    <MenuHeader>
                      <Avatar 
                        size={32}
                        icon={<UserOutlined />} 
                        style={{ background: colors.primary }}
                      />
                      <MenuHeaderInfo>
                        <div className="menu-header-name">{user.name || '用户'}</div>
                        <div className="menu-header-email">{user.email || 'user@example.com'}</div>
                      </MenuHeaderInfo>
                    </MenuHeader>
                    
                    <MenuDivider />
                    
                    <MenuItem onClick={handleProfile}>
                      <UserOutlined />
                      <span>个人资料</span>
                    </MenuItem>
                    
                    <MenuItem onClick={handleCandidateManagement}>
                      <FileTextOutlined />
                      <span>候选管理</span>
                    </MenuItem>
                    
                    <MenuDivider />
                    
                    <MenuItem $danger onClick={handleLogout}>
                      <LogoutOutlined />
                      <span>退出登录</span>
                    </MenuItem>
                  </DropdownMenu>
                )}
              </DropdownContainer>
            ) : (
              <Button 
                type="primary" 
                icon={<LoginOutlined />}
                onClick={() => navigate('/login')}
                style={{
                  background: colors.primary,
                  borderColor: colors.primary,
                  borderRadius: 8,
                  height: 36,
                  fontWeight: 500
                }}
              >
                登录
              </Button>
            )}
          </HeaderRight>
        </StyledHeader>
        
        <StyledContent>
          {children}
        </StyledContent>
      </MainContentWrapper>
      <LoginPromptModal
        visible={loginPromptVisible}
        onClose={handleLoginPromptClose}
        onLogin={handleLoginPromptConfirm}
      />
    </StyledLayout>
  );
};

export default Layout;
