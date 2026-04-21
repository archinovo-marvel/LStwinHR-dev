import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  Progress,
  Select,
  Input,
  message
} from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  TrophyOutlined,
  MessageOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import axios from 'axios';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

const AdminDashboard = () => {
  const [resumes, setResumes] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({
    totalResumes: 0,
    totalInterviews: 0,
    totalCompanies: 0,
    avgScore: 0,
    avgInterviewScore: 0
  });
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 只获取候选人数据
      const candidatesRes = await axios.get('/api/candidates');
      const candidates = candidatesRes.data;

      setResumes(candidates);
      setInterviews([]); // 暂时设为空数组
      setCompanies([]); // 暂时设为空数组

      // 计算统计数据
      const totalResumes = candidates.length;
      const totalInterviews = candidates.filter(c => c.hasInterview).length;
      const totalCompanies = 0; // 暂时设为0
      
      // 计算平均分
      const avgResumeScore = candidates.length > 0 ? 
        Math.round(candidates.reduce((sum, c) => sum + (parseInt(c.matchScore) || 0), 0) / candidates.length) : 0;
      
      const interviewedCandidates = candidates.filter(c => c.hasInterview && c.interviewScore);
      const avgInterviewScore = interviewedCandidates.length > 0 ?
        Math.round(interviewedCandidates.reduce((sum, c) => sum + c.interviewScore, 0) / interviewedCandidates.length) : 0;
      
      setStats({
        totalResumes,
        totalInterviews,
        totalCompanies,
        avgScore: avgResumeScore,
        avgInterviewScore: avgInterviewScore
      });

      console.log('候选人数据加载成功:', candidates);
      console.log('统计数据:', {
        totalResumes,
        totalInterviews,
        avgResumeScore,
        avgInterviewScore
      });
      
      // 调试：检查前几个候选人的面试分
      const firstFew = candidates.slice(0, 3);
      console.log('前3个候选人的面试分:', firstFew.map(c => ({
        name: c.name,
        interviewScore: c.interviewScore,
        finalScore: c.finalScore,
        hasInterview: c.hasInterview
      })));
    } catch (error) {
      console.error('获取数据失败:', error);
      message.error('获取候选人数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 监听面试分数保存事件，自动刷新数据
  useEffect(() => {
    const handleInterviewScoreSaved = () => {
      console.log('收到面试分数保存事件，刷新候选人数据');
      fetchData();
    };

    window.addEventListener('interviewScoreSaved', handleInterviewScoreSaved);

    // 监听窗口焦点事件，当用户返回页面时刷新数据
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('窗口重新激活，刷新候选人数据');
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('interviewScoreSaved', handleInterviewScoreSaved);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData]);

  const resumeColumns = [
    {
      title: '候选人',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '应聘职位',
      dataIndex: 'position',
      key: 'position',
    },
    {
      title: '简历评分',
      dataIndex: 'matchScore',
      key: 'matchScore',
      render: (score) => (
        <Tag color={score >= 80 ? 'green' : score >= 60 ? 'orange' : 'red'}>
          {score}分
        </Tag>
      ),
    },
    {
      title: '面试评分',
      dataIndex: 'interviewScore',
      key: 'interviewScore',
      render: (score, record) => {
        if (record.hasInterview) {
          return (
            <Tag color={score >= 80 ? 'green' : score >= 60 ? 'orange' : 'red'}>
              {score}分
            </Tag>
          );
        }
        return <Tag color="default">未面试</Tag>;
      },
    },
    {
      title: '综合评分',
      dataIndex: 'finalScore',
      key: 'finalScore',
      render: (score, record) => {
        if (record.hasInterview && score) {
          return (
            <Tag color={score >= 80 ? 'green' : score >= 60 ? 'orange' : 'red'}>
              {score}分
            </Tag>
          );
        }
        return <Tag color="default">-</Tag>;
      },
    },
    {
      title: '提交时间',
      dataIndex: 'submitTime',
      key: 'submitTime',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" size="small">查看详情</Button>
          <Button type="link" size="small">下载简历</Button>
          {!record.hasInterview && (
            <Button type="link" size="small" style={{ color: '#1890ff' }}>
              开始面试
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const interviewColumns = [
    {
      title: '候选人',
      dataIndex: 'candidateId',
      key: 'candidateId',
      render: () => '张三',
    },
    {
      title: '面试职位',
      dataIndex: 'companyId',
      key: 'companyId',
      render: (companyId) => companies.find(c => c.id === companyId)?.name || '未知公司',
    },
    {
      title: '面试时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: '评估状态',
      key: 'status',
      render: () => <Tag color="blue">已完成</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" size="small">查看报告</Button>
          <Button type="link" size="small">导出PDF</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ 
      height: '100%',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      flex: 1,
      boxSizing: 'border-box'
    }}>
      <div style={{ 
        background: 'white', 
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        marginBottom: '24px',
        flex: 1,
        overflow: 'auto'
      }}>
        <Title level={2} style={{ 
          color: '#1890ff',
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <TrophyOutlined />
          管理后台
        </Title>

        {/* 统计卡片 */}
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} lg={6}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Card 
                style={{ 
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  border: 'none'
                }}
                bodyStyle={{ padding: '24px' }}
                styles={{ header: { borderRadius: '12px 12px 0 0' } }}
              >
                <Statistic
                  title="总简历数"
                  value={stats.totalResumes}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#1890ff', fontSize: '28px' }}
                />
              </Card>
            </motion.div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card 
                style={{ 
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  border: 'none'
                }}
                bodyStyle={{ padding: '24px' }}
                styles={{ header: { borderRadius: '12px 12px 0 0' } }}
              >
                <Statistic
                  title="面试次数"
                  value={stats.totalInterviews}
                  prefix={<VideoCameraOutlined />}
                  valueStyle={{ color: '#52c41a', fontSize: '28px' }}
                />
              </Card>
            </motion.div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card 
                style={{ 
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  border: 'none'
                }}
                bodyStyle={{ padding: '24px' }}
                styles={{ header: { borderRadius: '12px 12px 0 0' } }}
              >
                <Statistic
                  title="简历评分"
                  value={stats.avgScore}
                  prefix={<TrophyOutlined />}
                  suffix="/100"
                  valueStyle={{ color: '#722ed1', fontSize: '28px' }}
                />
              </Card>
            </motion.div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Card 
                style={{ 
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  border: 'none'
                }}
                bodyStyle={{ padding: '24px' }}
                styles={{ header: { borderRadius: '12px 12px 0 0' } }}
              >
                <Statistic
                  title="面试评分"
                  value={stats.avgInterviewScore}
                  prefix={<MessageOutlined />}
                  suffix="/100"
                  valueStyle={{ color: '#f5222d', fontSize: '28px' }}
                />
              </Card>
            </motion.div>
          </Col>
        </Row>
      </div>

      {/* 简历管理 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <Card 
          title={
            <div style={{ 
              fontSize: '20px', 
              fontWeight: '600', 
              color: '#1890ff'
            }}>
              候选管理
            </div>
          } 
          style={{ 
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column'
          }}
          bodyStyle={{ 
            padding: '24px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}
          styles={{ header: { borderRadius: '16px 16px 0 0' } }}
          extra={
            <Space size="middle">
              <Search 
                placeholder="搜索候选人" 
                style={{ width: 200 }}
                size="large"
              />
              <Select defaultValue="all" style={{ width: 140 }} size="large">
                <Option value="all">全部职位</Option>
                <Option value="frontend">前端开发</Option>
                <Option value="backend">后端开发</Option>
                <Option value="pm">产品经理</Option>
              </Select>
            </Space>
          }
        >
          <div style={{ flex: 1 }}>
            <Table
              columns={resumeColumns}
              dataSource={resumes}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="middle"
              scroll={{ y: 400 }}
            />
          </div>
        </Card>
      </motion.div>

      {/* 面试管理 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <Card 
          title={
            <div style={{ 
              fontSize: '20px', 
              fontWeight: '600', 
              color: '#1890ff'
            }}>
              面试管理
            </div>
          }
          style={{ 
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column'
          }}
          bodyStyle={{ 
            padding: '24px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}
          styles={{ header: { borderRadius: '16px 16px 0 0' } }}
          extra={
            <Space size="middle">
              <Search 
                placeholder="搜索面试记录" 
                style={{ width: 200 }}
                size="large"
              />
              <Select defaultValue="all" style={{ width: 140 }} size="large">
                <Option value="all">全部状态</Option>
                <Option value="completed">已完成</Option>
                <Option value="pending">进行中</Option>
              </Select>
            </Space>
          }
        >
          <div style={{ flex: 1 }}>
            <Table
              columns={interviewColumns}
              dataSource={interviews}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="middle"
              scroll={{ y: 400 }}
            />
          </div>
        </Card>
      </motion.div>

      {/* 数据概览 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <Card 
          title={
            <div style={{ 
              fontSize: '20px', 
              fontWeight: '600', 
              color: '#1890ff'
            }}>
              数据概览
            </div>
          }
          style={{ 
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}
          bodyStyle={{ 
            padding: '24px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ flex: 1 }}>
            <Row gutter={[32, 24]}>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: '24px' }}>
                  <Text strong style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>简历分析完成率</Text>
                  <Progress percent={95} strokeColor="#1890ff" strokeWidth={8} />
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <Text strong style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>面试完成率</Text>
                  <Progress percent={88} strokeColor="#52c41a" strokeWidth={8} />
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: '24px' }}>
                  <Text strong style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>平均面试时长</Text>
                  <Progress percent={75} strokeColor="#fa8c16" strokeWidth={8} />
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <Text strong style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>用户满意度</Text>
                  <Progress percent={92} strokeColor="#722ed1" strokeWidth={8} />
                </div>
              </Col>
            </Row>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;

