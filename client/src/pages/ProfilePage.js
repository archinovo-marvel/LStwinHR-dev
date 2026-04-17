import React, { useState, useEffect } from 'react';
import { Card, Avatar, Typography, Button, Tag, message, Input, Form, Modal, Spin } from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  IdcardOutlined,
  EditOutlined,
  LockOutlined,
  CalendarOutlined,
  BankOutlined,
  CrownOutlined,
  PlusOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import serverDataSync from '../utils/serverDataSync';
import { getCandidateStats } from '../utils/candidateStats';

const { Title, Text, Paragraph } = Typography;

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
};

// 页面容器
const PageContainer = styled.div`
  padding: 24px;
  background: ${colors.background};
  min-height: 100vh;
`;

// 页面标题
const PageTitle = styled.div`
  margin-bottom: 24px;
  
  .title {
    font-size: 24px;
    font-weight: 600;
    color: ${colors.title};
    margin-bottom: 8px;
  }
  
  .subtitle {
    font-size: 14px;
    color: ${colors.muted};
  }
`;

// 主布局
const MainLayout = styled.div`
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

// 左侧用户卡片
const UserCard = styled(Card)`
  border-radius: 16px;
  border: 1px solid ${colors.border};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  
  .ant-card-body {
    padding: 0;
  }
`;

// 用户信息头部
const UserHeader = styled.div`
  padding: 32px 24px;
  background: linear-gradient(135deg, #3B82F6 0%, #6366F1 100%);
  text-align: center;
`;

// 头像
const UserAvatar = styled(Avatar)`
  width: 64px;
  height: 64px;
  background: rgba(255, 255, 255, 0.2);
  border: 3px solid rgba(255, 255, 255, 0.3);
  
  .anticon {
    font-size: 32px;
    color: white;
  }
`;

// 用户名
const UserName = styled.div`
  color: white;
  font-size: 20px;
  font-weight: 600;
  margin-top: 16px;
`;

// 会员等级徽章
const MemberBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  color: white;
  font-size: 12px;
  font-weight: 500;
  margin-top: 8px;
`;

// 用户信息内容
const UserContent = styled.div`
  padding: 24px;
`;

// 联系信息项
const ContactItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid ${colors.divider};
  
  &:last-child {
    border-bottom: none;
  }
  
  .anticon {
    font-size: 16px;
    color: ${colors.muted};
  }
  
  .label {
    font-size: 13px;
    color: ${colors.muted};
    min-width: 60px;
  }
  
  .value {
    font-size: 14px;
    color: ${colors.text};
    font-weight: 500;
  }
`;

// 按钮组
const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid ${colors.divider};
`;

// 主按钮
const PrimaryButton = styled(Button)`
  height: 40px;
  border-radius: 10px;
  font-weight: 500;
  background: ${colors.primary};
  border-color: ${colors.primary};
  
  &:hover {
    background: ${colors.primaryHover};
    border-color: ${colors.primaryHover};
  }
`;

// 次按钮
const SecondaryButton = styled(Button)`
  height: 40px;
  border-radius: 10px;
  font-weight: 500;
  border: 1px solid ${colors.border};
  color: ${colors.text};
  background: ${colors.cardBg};

  &:hover {
    border-color: ${colors.primary};
    color: ${colors.primary};
  }
`;

// 危险按钮（注销账户）
const DangerButton = styled(Button)`
  height: 40px;
  border-radius: 10px;
  font-weight: 500;
  border: 1px solid ${colors.danger};
  color: ${colors.danger};
  background: ${colors.cardBg};

  &:hover {
    border-color: ${colors.danger};
    color: ${colors.danger};
    background: #FEF2F2;
  }
`;

// 右侧内容区
const RightContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

// 统计卡片行
const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

// 统计卡片
const StatCard = styled(Card)`
  border-radius: 16px;
  border: 1px solid ${colors.border};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  text-align: center;
  padding: 16px;
  
  .ant-card-body {
    padding: 20px;
  }
  
  .stat-value {
    font-size: 28px;
    font-weight: 600;
    color: ${colors.primary};
    margin-bottom: 8px;
  }
  
  .stat-label {
    font-size: 13px;
    color: ${colors.muted};
  }
`;

// 信息卡片
const InfoCard = styled(Card)`
  border-radius: 16px;
  border: 1px solid ${colors.border};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  
  .ant-card-head {
    border-bottom: 1px solid ${colors.divider};
    padding: 16px 24px;
    
    .ant-card-head-title {
      font-size: 16px;
      font-weight: 600;
      color: ${colors.title};
    }
  }
  
  .ant-card-body {
    padding: 24px;
  }
`;

// 信息网格
const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: 120px 1fr;
  row-gap: 16px;
  column-gap: 16px;
  
  @media (max-width: 576px) {
    grid-template-columns: 1fr;
    row-gap: 12px;
  }
`;

// 信息项
const InfoItem = styled.div`
  display: contents;
  
  .label {
    color: ${colors.muted};
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
    
    .anticon {
      font-size: 14px;
    }
  }
  
  .value {
    color: ${colors.title};
    font-weight: 500;
    font-size: 14px;
  }
`;

// 安全设置项
const SecurityItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-radius: 12px;
  background: ${colors.background};
  margin-bottom: 12px;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  .security-left {
    flex: 1;
    
    .security-title {
      font-weight: 600;
      color: ${colors.title};
      margin-bottom: 4px;
    }
    
    .security-desc {
      font-size: 13px;
      color: ${colors.muted};
    }
  }
  
  .security-right {
    margin-left: 16px;
  }
`;

// 弹窗样式
const StyledModal = styled(Modal)`
  .ant-modal-content {
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  }
  
  .ant-modal-header {
    border-radius: 16px 16px 0 0;
    padding: 0 0 16px 0;
    border-bottom: 1px solid ${colors.divider};
  }
  
  .ant-modal-title {
    font-size: 18px;
    font-weight: 600;
    color: ${colors.title};
  }
  
  .ant-modal-body {
    padding: 24px 0;
  }
  
  .ant-modal-footer {
    border-top: 1px solid ${colors.divider};
    padding: 16px 0 0 0;
    margin-top: 24px;
  }
`;

// 弹窗表单网格
const ModalFormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  
  @media (max-width: 576px) {
    grid-template-columns: 1fr;
  }
`;

// 弹窗输入框
const ModalInput = styled(Input)`
  height: 40px;
  border-radius: 10px;
  border: 1px solid ${colors.border};
  transition: all 0.2s ease;
  
  &:hover, &:focus {
    border-color: ${colors.primary};
    box-shadow: 0 0 0 2px ${colors.primaryLight};
  }
  
  &.ant-input-affix-wrapper {
    padding: 0 12px;
    
    .ant-input {
      height: 38px;
    }
  }
`;

// 弹窗密码输入框
const ModalPasswordInput = styled(Input.Password)`
  height: 40px;
  border-radius: 10px;
  border: 1px solid ${colors.border};
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  padding: 0 12px;

  &:hover, &:focus, &.ant-input-affix-wrapper-focused {
    border-color: ${colors.primary};
    box-shadow: 0 0 0 2px ${colors.primaryLight};
  }

  .ant-input {
    height: 100%;
    line-height: normal;
    padding: 0;
    display: flex;
    align-items: center;
  }

  .ant-input-prefix {
    margin-right: 8px;
    color: ${colors.muted};
    display: flex;
    align-items: center;
  }

  .ant-input-suffix {
    margin-left: 8px;
    display: flex;
    align-items: center;
  }
`;

// 弹窗按钮
const ModalPrimaryButton = styled(Button)`
  height: 40px;
  border-radius: 10px;
  font-weight: 500;
  background: ${colors.primary};
  border-color: ${colors.primary};
  padding: 0 24px;
  
  &:hover {
    background: ${colors.primaryHover};
    border-color: ${colors.primaryHover};
  }
`;

const ModalSecondaryButton = styled(Button)`
  height: 40px;
  border-radius: 10px;
  font-weight: 500;
  border: 1px solid ${colors.border};
  color: ${colors.text};
  background: ${colors.cardBg};
  padding: 0 24px;
  
  &:hover {
    border-color: ${colors.primary};
    color: ${colors.primary};
  }
`;

const ProfileCard = styled(Card)`
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
`;

const AvatarWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px 16px 0 0;
`;

const InfoSection = styled.div`
  padding: 24px;
`;

const PositionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const EmptyPositionsText = styled.div`
  color: ${colors.muted};
  font-size: 14px;
  line-height: 1.8;
  padding: 4px 0;
`;

const PositionItem = styled.div`
  border: 1px solid ${colors.border};
  border-radius: 20px;
  padding: 20px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.04);

  .position-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 10px;
  }

  .position-name {
    font-size: 15px;
    font-weight: 600;
    color: ${colors.title};
    margin-bottom: 6px;
  }

  .position-desc {
    color: ${colors.text};
    font-size: 13px;
    line-height: 1.7;
  }

  .position-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
`;

const PositionToolbarButton = styled(Button)`
  && {
    height: 40px;
    border-radius: 14px;
    padding: 0 18px;
    font-weight: 600;
    border: none;
    background: linear-gradient(135deg, ${colors.primary} 0%, #5b8def 100%);
    box-shadow: 0 12px 24px rgba(47, 128, 237, 0.22);
  }

  &&:hover {
    background: linear-gradient(135deg, ${colors.primaryHover} 0%, ${colors.primary} 100%);
  }
`;

const PositionActionGroup = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const PositionEditButton = styled(Button)`
  && {
    height: 34px;
    border-radius: 12px;
    padding: 0 14px;
    border: 1px solid rgba(47, 128, 237, 0.14);
    background: rgba(47, 128, 237, 0.08);
    color: ${colors.primary};
    font-weight: 600;
    box-shadow: none;
  }

  &&:hover {
    border-color: rgba(47, 128, 237, 0.24);
    background: rgba(47, 128, 237, 0.14);
    color: ${colors.primaryHover};
  }
`;

const PositionDeleteButton = styled(Button)`
  && {
    height: 34px;
    border-radius: 12px;
    padding: 0 14px;
    border: 1px solid rgba(239, 68, 68, 0.14);
    background: rgba(239, 68, 68, 0.06);
    color: ${colors.danger};
    font-weight: 600;
    box-shadow: none;
  }

  &&:hover {
    border-color: rgba(239, 68, 68, 0.24);
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }
`;

const ModalHero = styled.div`
  padding: 22px 24px;
  margin-bottom: 22px;
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(47, 128, 237, 0.14), rgba(99, 102, 241, 0.08));
  border: 1px solid rgba(47, 128, 237, 0.12);
`;

const ModalHeroBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(47, 128, 237, 0.1);
  color: ${colors.primary};
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 14px;
`;

const ModalHeroTitle = styled.div`
  color: ${colors.title};
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 8px;
`;

const ModalHeroDesc = styled.div`
  color: ${colors.text};
  font-size: 14px;
  line-height: 1.7;
`;

const ModalTextArea = styled(Input.TextArea)`
  border-radius: 14px;
  border: 1px solid ${colors.border};
  transition: all 0.2s ease;

  &:hover,
  &:focus {
    border-color: ${colors.primary};
    box-shadow: 0 0 0 2px ${colors.primaryLight};
  }
`;

const PositionFormPanel = styled.div`
  padding: 22px;
  border-radius: 22px;
  background: linear-gradient(180deg, #ffffff 0%, #f9fbff 100%);
  border: 1px solid rgba(226, 232, 240, 0.9);

  .ant-form-item-label > label {
    color: ${colors.title};
    font-weight: 600;
  }
`;

const ModalActionBar = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid ${colors.divider};
`;

const ProfilePage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [userInfo, setUserInfo] = useState({
    name: '未设置',
    email: '未设置',
    phone: '未设置',
    company: '未设置',
    memberLevel: '普通会员',
    createTime: '-',
    updateTime: '-'
  });
  const [stats, setStats] = useState({
    resumeCount: 0,
    interviewCount: 0,
    interviewDuration: 0
  });

  useEffect(() => {
    fetchUserInfo();
    fetchUserStats();
    fetchPositions();
  }, []);
  const [positions, setPositions] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [positionModalVisible, setPositionModalVisible] = useState(false);
  const [positionSaving, setPositionSaving] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [positionForm] = Form.useForm();

  // 从数据库获取用户信息
  const fetchUserInfo = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/user/info', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.data.success && response.data.user) {
        const userData = response.data.user;
        setUserInfo({
          name: userData.username || '未设置',
          email: userData.email || '未设置',
          phone: userData.phone || '未设置',
          company: userData.company || '未设置',
          memberLevel: userData.memberLevel || '普通会员',
          createTime: userData.createdAt ? formatDate(userData.createdAt) : '-',
          updateTime: userData.updatedAt ? formatDate(userData.updatedAt) : '-'
        });
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      // 如果API失败，使用AuthContext中的用户信息
      if (user) {
        setUserInfo({
          name: user.name || '未设置',
          email: user.email || '未设置',
          phone: '未设置',
          company: '未设置',
          memberLevel: '普通会员',
          createTime: '-',
          updateTime: '-'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // 格式化日期
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // 获取用户统计数据
  const fetchUserStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const candidatesRes = await axios.get('/api/candidates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const candidates = Array.isArray(candidatesRes.data) ? candidatesRes.data : [];

      // 使用统一的统计计算函数
      const statsResult = getCandidateStats(candidates);

      setStats({
        resumeCount: statsResult.totalResumes,
        interviewCount: statsResult.interviewCount,
        interviewDuration: statsResult.interviewDuration
      });
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  const fetchPositions = async () => {
    setPositionsLoading(true);
    try {
      const result = await serverDataSync.getAvailablePositions();
      setPositions(result);
    } catch (error) {
      console.error('获取岗位列表失败:', error);
      message.error('获取岗位列表失败');
    } finally {
      setPositionsLoading(false);
    }
  };

  const toKeywordArray = (value) => (
    String(value || '').split(/[\n,，;；|、]+/).map(item => item.trim()).filter(Boolean)
  );

  const openPositionModal = (position = null) => {
    setEditingPosition(position);
    setPositionModalVisible(true);
    if (position) {
      positionForm.setFieldsValue({
        id: position.id,
        name: position.name,
        description: position.description || '',
        coreSkills: (position.config?.coreSkills || []).join('、'),
        businessSkills: (position.config?.businessSkills || []).join('、'),
        education: (position.config?.education || []).join('、'),
        experience: (position.config?.experience || []).join('、'),
        abilityKeywords: (position.config?.abilityKeywords || []).join('、'),
        projectKeywords: (position.config?.projectKeywords || []).join('、')
      });
    } else {
      positionForm.resetFields();
    }
  };

  const handleSavePosition = async () => {
    try {
      const values = await positionForm.validateFields();
      setPositionSaving(true);
      await serverDataSync.savePosition({
        id: values.id,
        name: values.name,
        description: values.description || '',
        config: {
          coreSkills: toKeywordArray(values.coreSkills),
          businessSkills: toKeywordArray(values.businessSkills),
          education: toKeywordArray(values.education),
          experience: toKeywordArray(values.experience),
          abilityKeywords: toKeywordArray(values.abilityKeywords),
          projectKeywords: toKeywordArray(values.projectKeywords)
        }
      });
      setPositionModalVisible(false);
      setEditingPosition(null);
      positionForm.resetFields();
      await fetchPositions();
      message.success(values.id ? '岗位更新成功' : '岗位新增成功');
    } catch (error) {
      if (error?.errorFields) return;
      console.error('保存岗位失败:', error);
      message.error(error.message || '保存岗位失败');
    } finally {
      setPositionSaving(false);
    }
  };

  const handleDeletePosition = async (positionId) => {
    try {
      await serverDataSync.deletePosition(positionId);
      setPositions(prev => prev.filter(item => item.id !== positionId));
      message.success('岗位删除成功');
    } catch (error) {
      console.error('删除岗位失败:', error);
      message.error(error.message || '删除岗位失败');
    }
  };

  const confirmDeletePosition = (position) => {
    Modal.confirm({
      title: null, icon: null, centered: true, width: 460,
      okText: '删除岗位', cancelText: '取消',
      okButtonProps: { danger: true, style: { height: 40, borderRadius: 12, padding: '0 18px', fontWeight: 600, boxShadow: 'none' } },
      cancelButtonProps: { style: { height: 40, borderRadius: 12, padding: '0 18px', fontWeight: 600 } },
      content: (
        <div style={{ paddingTop: 8 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, background: 'rgba(239, 68, 68, 0.08)', color: colors.danger }}>
            <ExclamationCircleOutlined style={{ fontSize: 24 }} />
          </div>
          <div style={{ color: colors.title, fontSize: 24, fontWeight: 700, marginBottom: 10 }}>删除岗位</div>
          <div style={{ color: colors.text, fontSize: 14, lineHeight: 1.8, marginBottom: 16 }}>删除后，该岗位的配置将无法继续用于新的简历分析，请确认是否继续。</div>
          <div style={{ padding: '14px 16px', borderRadius: 16, background: '#f8fbff', border: '1px solid rgba(226, 232, 240, 0.9)' }}>
            <div style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>岗位名称</div>
            <div style={{ color: colors.title, fontSize: 15, fontWeight: 600 }}>{position.name}</div>
          </div>
        </div>
      ),
      onOk: () => handleDeletePosition(position.id)
    });
  };

  // 打开编辑资料弹窗
  const handleEditProfile = () => {
    form.setFieldsValue({
      name: userInfo.name === '未设置' ? '' : userInfo.name,
      email: userInfo.email === '未设置' ? '' : userInfo.email,
      phone: userInfo.phone === '未设置' ? '' : userInfo.phone,
      company: userInfo.company === '未设置' ? '' : userInfo.company
    });
    setEditModalVisible(true);
  };

  // 保存用户资料
  const handleSaveProfile = async () => {
    try {
      const values = await form.validateFields();
      const token = localStorage.getItem('token');
      const response = await axios.put('/api/user/info', {
        username: values.name,
        phone: values.phone || null,
        company: values.company || null
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.data.success) {
        // 更新本地状态
        setUserInfo({
          ...userInfo,
          name: values.name,
          phone: values.phone || '未设置',
          company: values.company || '未设置'
        });
        setEditModalVisible(false);
        message.success('个人资料更新成功');
      }
    } catch (error) {
      console.error('保存失败:', error);
      message.error(error.response?.data?.message || '保存失败，请稍后重试');
    }
  };

  // 打开修改密码弹窗
  const handleChangePassword = () => {
    passwordForm.resetFields();
    setPasswordModalVisible(true);
  };

  // 保存新密码
  const handleSavePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      const token = localStorage.getItem('token');
      const response = await axios.put('/api/user/password', {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.data.success) {
        setPasswordModalVisible(false);
        message.success('密码修改成功');
      }
    } catch (error) {
      console.error('密码修改失败:', error);
      message.error(error.response?.data?.message || '密码修改失败');
    }
  };

  // 注销账户
  const handleDeleteAccount = () => {
    Modal.confirm({
      title: '注销账户',
      icon: <ExclamationCircleOutlined />,
      content: '确定要注销您的账户吗？此操作将删除您的所有数据，包括候选人信息、岗位信息等，且无法恢复。',
      okText: '确认注销',
      cancelText: '取消',
      okType: 'danger',
      async onOk() {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.delete('/api/user', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.data.success) {
            localStorage.removeItem('token');
            localStorage.removeItem('userInfo');
            message.success('账户已注销');
            window.location.href = '/login';
          }
        } catch (error) {
          console.error('注销失败:', error);
          message.error(error.response?.data?.message || '账户注销失败');
        }
      }
    });
  };

  // 获取会员等级标签颜色
  const getMemberLevelColor = (level) => {
    const colors = {
      'SSVIP': 'gold',
      'SVIP': 'purple',
      'VIP': 'blue',
      '普通会员': 'default'
    };
    return colors[level] || 'default';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <PageContainer>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <PageTitle>
          <div className="title">个人资料</div>
          <div className="subtitle">管理您的个人信息和账户设置</div>
        </PageTitle>
        <MainLayout>
          <UserCard>
            <UserHeader>
              <UserAvatar icon={<UserOutlined />} />
              <UserName>{userInfo.name}</UserName>
              <MemberBadge>
                <CrownOutlined />
                {userInfo.memberLevel}
              </MemberBadge>
            </UserHeader>
            <UserContent>
              <ButtonGroup>
                <PrimaryButton
                  type="primary"
                  icon={<EditOutlined />}
                  block
                  onClick={handleEditProfile}
                >
                  编辑资料
                </PrimaryButton>
                <SecondaryButton
                  icon={<LockOutlined />}
                  block
                  onClick={handleChangePassword}
                >
                  修改密码
                </SecondaryButton>
                <DangerButton
                  icon={<LogoutOutlined />}
                  block
                  onClick={handleDeleteAccount}
                >
                  注销账户
                </DangerButton>
              </ButtonGroup>
            </UserContent>
          </UserCard>
          <RightContent>
            <StatsRow>
              <StatCard>
                <div className="stat-value">{stats.resumeCount}</div>
                <div className="stat-label">处理简历数</div>
              </StatCard>
              <StatCard>
                <div className="stat-value">{stats.interviewCount}</div>
                <div className="stat-label">面试次数</div>
              </StatCard>
              <StatCard>
                <div className="stat-value">{stats.interviewDuration}</div>
                <div className="stat-label">面试时长(分钟)</div>
              </StatCard>
            </StatsRow>
            <InfoCard title="详细信息">
              <InfoGrid>
                <InfoItem>
                  <div className="label">
                    <IdcardOutlined />
                    姓名
                  </div>
                  <div className="value">{userInfo.name}</div>
                </InfoItem>
                <InfoItem>
                  <div className="label">
                    <MailOutlined />
                    邮箱
                  </div>
                  <div className="value">{userInfo.email}</div>
                </InfoItem>
                <InfoItem>
                  <div className="label">
                    <PhoneOutlined />
                    电话
                  </div>
                  <div className="value">{userInfo.phone}</div>
                </InfoItem>
                <InfoItem>
                  <div className="label">
                    <BankOutlined />
                    所属公司
                  </div>
                  <div className="value">{userInfo.company}</div>
                </InfoItem>
                <InfoItem>
                  <div className="label">
                    <CrownOutlined />
                    会员等级
                  </div>
                  <div className="value">
                    <Tag color={getMemberLevelColor(userInfo.memberLevel)}>
                      {userInfo.memberLevel}
                    </Tag>
                  </div>
                </InfoItem>
                <InfoItem>
                  <div className="label">
                    <CalendarOutlined />
                    注册时间
                  </div>
                  <div className="value">{userInfo.createTime}</div>
                </InfoItem>
                <InfoItem>
                  <div className="label">
                    <CalendarOutlined />
                    更新时间
                  </div>
                  <div className="value">{userInfo.updateTime}</div>
                </InfoItem>
              </InfoGrid>
            </InfoCard>
            <InfoCard
              title="岗位管理"
              extra={(
                <PositionToolbarButton type="primary" icon={<PlusOutlined />} onClick={() => openPositionModal()}>
                  新增岗位
                </PositionToolbarButton>
              )}
            >
              {positionsLoading ? (
                <Spin />
              ) : positions.length === 0 ? (
                <EmptyPositionsText>您还未设置任何招聘岗位</EmptyPositionsText>
              ) : (
                <PositionList>
                  {positions.map(position => (
                    <PositionItem key={position.id}>
                      <div className="position-head">
                        <div style={{ flex: 1 }}>
                          <div className="position-name">{position.name}</div>
                          {position.description ? <div className="position-desc">{position.description}</div> : null}
                        </div>
                        <PositionActionGroup>
                          <PositionEditButton size="small" icon={<EditOutlined />} onClick={() => openPositionModal(position)}>编辑</PositionEditButton>
                          <PositionDeleteButton size="small" danger icon={<DeleteOutlined />} onClick={() => confirmDeletePosition(position)}>删除</PositionDeleteButton>
                        </PositionActionGroup>
                      </div>
                      {(position.config?.coreSkills || []).length > 0 ? (
                        <div className="position-meta">
                          {(position.config.coreSkills || []).slice(0, 6).map((skill, index) => (
                            <Tag key={`${position.id}-${index}-${skill}`} color="blue">{skill}</Tag>
                          ))}
                        </div>
                      ) : null}
                    </PositionItem>
                  ))}
                </PositionList>
              )}
            </InfoCard>
          </RightContent>
        </MainLayout>
      </motion.div>
      {/* 编辑资料弹窗 */}
      <StyledModal
        title="编辑个人资料"
        open={editModalVisible}
        onOk={handleSaveProfile}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
        okButtonProps={{ style: { display: 'none' } }}
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <Form form={form} layout="vertical">
          <ModalFormGrid>
            <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
              <ModalInput prefix={<UserOutlined />} placeholder="请输入姓名" />
            </Form.Item>
            <Form.Item name="email" label="邮箱">
              <ModalInput prefix={<MailOutlined />} placeholder="邮箱不可修改" disabled />
            </Form.Item>
            <Form.Item name="phone" label="电话">
              <ModalInput prefix={<PhoneOutlined />} placeholder="请输入电话" />
            </Form.Item>
            <Form.Item name="company" label="所属公司">
              <ModalInput prefix={<BankOutlined />} placeholder="请输入所属公司" />
            </Form.Item>
          </ModalFormGrid>
        </Form>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <ModalSecondaryButton onClick={() => setEditModalVisible(false)}>
            取消
          </ModalSecondaryButton>
          <ModalPrimaryButton type="primary" onClick={handleSaveProfile}>
            保存
          </ModalPrimaryButton>
        </div>
      </StyledModal>
      {/* 岗位编辑弹窗 */}
      <StyledModal
        title={null}
        open={positionModalVisible}
        forceRender
        onCancel={() => { setPositionModalVisible(false); setEditingPosition(null); positionForm.resetFields(); }}
        okButtonProps={{ style: { display: 'none' } }}
        cancelButtonProps={{ style: { display: 'none' } }}
        footer={null}
      >
        <ModalHero>
          <ModalHeroBadge>
            {editingPosition?.id ? <EditOutlined /> : <PlusOutlined />}
            <span>{editingPosition?.id ? '编辑岗位配置' : '新增岗位配置'}</span>
          </ModalHeroBadge>
          <ModalHeroTitle>{editingPosition?.id ? '岗位编辑' : '岗位新增'}</ModalHeroTitle>
          <ModalHeroDesc>
            {editingPosition?.id ? '调整当前岗位的名称、描述与关键词，更新后简历分析将使用最新配置。' : '创建新的招聘岗位并配置画像关键词，后续可用于简历匹配与分析。'}
          </ModalHeroDesc>
        </ModalHero>

        <PositionFormPanel>
          <Form form={positionForm} layout="vertical">
            <Form.Item name="id" hidden><Input /></Form.Item>
            <Form.Item name="name" label="岗位名称" rules={[{ required: true, message: '请输入岗位名称' }]}>
              <ModalInput placeholder="例如：Java 开发实习生" />
            </Form.Item>
            <Form.Item name="description" label="岗位描述">
              <ModalTextArea rows={3} placeholder="可以填写岗位职责、招聘要求等" />
            </Form.Item>

            <ModalFormGrid>
              <Form.Item name="coreSkills" label="核心技能">
                <ModalTextArea rows={2} placeholder="用顿号、逗号分隔，如：Java、Spring Boot" />
              </Form.Item>
              <Form.Item name="businessSkills" label="业务技能">
                <ModalTextArea rows={2} placeholder="如：需求沟通、数据分析" />
              </Form.Item>
            </ModalFormGrid>

            <ModalFormGrid>
              <Form.Item name="education" label="对口专业">
                <ModalTextArea rows={2} placeholder="如：计算机、软件工程" />
              </Form.Item>
              <Form.Item name="experience" label="经历关键词">
                <ModalTextArea rows={2} placeholder="如：实习、项目、测试" />
              </Form.Item>
            </ModalFormGrid>

            <ModalFormGrid>
              <Form.Item name="abilityKeywords" label="能力关键词">
                <ModalTextArea rows={2} placeholder="如：沟通能力、执行力" />
              </Form.Item>
              <Form.Item name="projectKeywords" label="项目关键词">
                <ModalTextArea rows={2} placeholder="如：平台、系统、活动" />
              </Form.Item>
            </ModalFormGrid>
          </Form>
        </PositionFormPanel>

        <ModalActionBar>
          <ModalSecondaryButton onClick={() => { setPositionModalVisible(false); setEditingPosition(null); positionForm.resetFields(); }}>取消</ModalSecondaryButton>
          <ModalPrimaryButton type="primary" loading={positionSaving} onClick={handleSavePosition}>保存岗位</ModalPrimaryButton>
        </ModalActionBar>
      </StyledModal>
      {/* 修改密码弹窗 */}
      <StyledModal
        title="修改密码"
        open={passwordModalVisible}
        onOk={handleSavePassword}
        onCancel={() => setPasswordModalVisible(false)}
        okText="确认修改"
        cancelText="取消"
        okButtonProps={{ style: { display: 'none' } }}
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item 
            name="oldPassword" 
            label="原密码" 
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <ModalPasswordInput prefix={<LockOutlined />} placeholder="请输入原密码" />
          </Form.Item>
          <Form.Item 
            name="newPassword" 
            label="新密码" 
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6位' }
            ]}
          >
            <ModalPasswordInput prefix={<LockOutlined />} placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item 
            name="confirmPassword" 
            label="确认密码" 
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <ModalPasswordInput prefix={<LockOutlined />} placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <ModalSecondaryButton onClick={() => setPasswordModalVisible(false)}>
            取消
          </ModalSecondaryButton>
          <ModalPrimaryButton type="primary" onClick={handleSavePassword}>
            确认修改
          </ModalPrimaryButton>
        </div>
      </StyledModal>
    </PageContainer>
  );
};

export default ProfilePage;
