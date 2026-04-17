import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Select, 
  Input, 
  Row, 
  Col, 
  Image, 
  message,
  Typography,
  Space,
  Tag
} from 'antd';
import { 
  UserOutlined, 
  PlusOutlined,
  DownloadOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import axios from 'axios';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

const AvatarCard = styled(Card)`
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  }
`;

const AvatarImage = styled.div`
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #f0f0f0;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const AvatarGenerator = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [style, setStyle] = useState('professional');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [avatars, setAvatars] = useState([]);
  const [previewAvatar, setPreviewAvatar] = useState(null);

  useEffect(() => {
    fetchCompanies();
    fetchAvatars();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await axios.get('/api/companies');
      setCompanies(response.data.companies);
    } catch (error) {
      console.error('获取公司列表失败:', error);
    }
  };

  const fetchAvatars = async () => {
    try {
      const response = await axios.get('/api/avatars');
      setAvatars(response.data.avatars);
    } catch (error) {
      console.error('获取头像列表失败:', error);
    }
  };

  const generateAvatar = async () => {
    if (!selectedCompany) {
      message.error('请选择公司');
      return;
    }

    setGenerating(true);
    try {
      const response = await axios.post('/api/generate-avatar', {
        companyId: selectedCompany,
        style: style,
        customPrompt: customPrompt
      });

      const newAvatar = response.data.avatar;
      setAvatars(prev => [newAvatar, ...prev]);
      setPreviewAvatar(newAvatar);
      message.success('头像生成成功！');
    } catch (error) {
      message.error('头像生成失败：' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadAvatar = (avatar) => {
    const link = document.createElement('a');
    link.href = avatar.imageUrl;
    link.download = `avatar-${avatar.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const styleOptions = [
    { value: 'professional', label: '专业商务', description: '正式、专业的商务风格' },
    { value: 'friendly', label: '友好亲和', description: '温暖、亲切的沟通风格' },
    { value: 'modern', label: '现代时尚', description: '年轻、时尚的现代风格' },
    { value: 'creative', label: '创意艺术', description: '富有创意和艺术感' },
    { value: 'tech', label: '科技感', description: '科技、未来感的风格' }
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
      <Card 
        title={
          <div style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#1890ff',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <UserOutlined />
            AI拟人模型生成
          </div>
        } 
        style={{ 
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          marginBottom: '24px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}
        bodyStyle={{ 
          padding: '32px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Row gutter={[32, 24]} style={{ flex: 1 }}>
          <Col xs={24} lg={12}>
            <div style={{ marginBottom: '24px' }}>
              <Text strong style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>选择公司：</Text>
              <Select
                style={{ width: '100%', borderRadius: '8px' }}
                placeholder="选择要生成头像的公司"
                value={selectedCompany}
                onChange={setSelectedCompany}
                size="large"
              >
                {companies.map(company => (
                  <Option key={company.id} value={company.id}>
                    {company.name}
                  </Option>
                ))}
              </Select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <Text strong style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>头像风格：</Text>
              <Select
                style={{ width: '100%', borderRadius: '8px' }}
                value={style}
                onChange={setStyle}
                size="large"
              >
                {styleOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    <div>
                      <div>{option.label}</div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {option.description}
                      </Text>
                    </div>
                  </Option>
                ))}
              </Select>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <Text strong style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>自定义描述（可选）：</Text>
              <TextArea
                placeholder="描述您希望的头像特征，如：年轻女性、戴眼镜、微笑等"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={4}
                style={{ 
                  borderRadius: '8px',
                  border: '2px solid #f0f0f0',
                  fontSize: '16px'
                }}
              />
            </div>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={generateAvatar}
              loading={generating}
              size="large"
              style={{ 
                width: '100%', 
                borderRadius: '12px',
                height: '48px',
                fontSize: '16px',
                background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
                border: 'none',
                boxShadow: '0 4px 15px rgba(24, 144, 255, 0.3)'
              }}
            >
              {generating ? '生成中...' : '生成头像'}
            </Button>
          </Col>

          <Col xs={24} lg={12}>
            <AvatarCard 
              title="预览区域"
              style={{ height: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <AvatarImage style={{ flex: 1, minHeight: '350px' }}>
                  {previewAvatar ? (
                    <Image
                      src={previewAvatar.imageUrl}
                      alt="生成的头像"
                      style={{ width: '100%', height: 'auto', maxHeight: '300px', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#999' }}>
                      <UserOutlined style={{ fontSize: '4rem', marginBottom: 16 }} />
                      <div>点击生成按钮创建头像</div>
                    </div>
                  )}
                </AvatarImage>
                
                {previewAvatar && (
                  <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <Space size="middle">
                      <Button 
                        icon={<DownloadOutlined />}
                        onClick={() => downloadAvatar(previewAvatar)}
                        size="large"
                        style={{ borderRadius: '8px' }}
                      >
                        下载头像
                      </Button>
                      <Button 
                        icon={<EyeOutlined />}
                        onClick={() => window.open(previewAvatar.imageUrl, '_blank')}
                        size="large"
                        style={{ borderRadius: '8px' }}
                      >
                        查看大图
                      </Button>
                    </Space>
                  </div>
                )}
              </div>
            </AvatarCard>
          </Col>
        </Row>
      </Card>

      {/* 历史生成的头像 */}
      <Card 
        title={
          <div style={{ 
            fontSize: '20px', 
            fontWeight: '600', 
            color: '#1890ff'
          }}>
            历史头像
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
          <Row gutter={[20, 20]}>
            {avatars.map((avatar, index) => (
              <Col xs={24} sm={12} md={8} lg={6} key={avatar.id}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <AvatarCard
                    hoverable
                    cover={
                      <AvatarImage style={{ minHeight: '200px' }}>
                        <Image
                          src={avatar.imageUrl}
                          alt={`头像 ${avatar.id}`}
                          style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                        />
                      </AvatarImage>
                    }
                    actions={[
                      <DownloadOutlined key="download" onClick={() => downloadAvatar(avatar)} />,
                      <EyeOutlined key="view" onClick={() => window.open(avatar.imageUrl, '_blank')} />
                    ]}
                  >
                    <div>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="blue">{avatar.style}</Tag>
                        <Tag color="green">{companies.find(c => c.id === avatar.companyId)?.name}</Tag>
                      </div>
                      <Text type="secondary">
                        {new Date(avatar.createdAt).toLocaleDateString()}
                      </Text>
                    </div>
                  </AvatarCard>
                </motion.div>
              </Col>
            ))}
          </Row>
          
          {avatars.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
              <UserOutlined style={{ fontSize: '4rem', marginBottom: 16 }} />
              <div>暂无生成的头像</div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AvatarGenerator; 