import React, { useState, useEffect } from 'react';
import { Modal, Select, Input, Button, Card, Tag, Space, Typography, message } from 'antd';
import { UserOutlined, SearchOutlined } from '@ant-design/icons';
import serverDataSync from '../utils/serverDataSync';

const { Option } = Select;
const { Search } = Input;
const { Text } = Typography;

const CandidateSelector = ({ visible, onSelect, onCancel }) => {
  const [candidates, setCandidates] = useState([]);
  const [filteredCandidates, setFilteredCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');

  useEffect(() => {
    if (visible) {
      fetchCandidates();
    }
  }, [visible]);

  useEffect(() => {
    filterCandidates();
  }, [candidates, searchText, selectedPosition]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const serverCandidates = await serverDataSync.getAllCandidates();
      setCandidates(Array.isArray(serverCandidates) ? serverCandidates : []);
    } catch (error) {
      console.error('获取候选人列表失败:', error);
      message.error('获取候选人列表失败');
    } finally {
      setLoading(false);
    }
  };

  const filterCandidates = () => {
    let filtered = candidates;

    // 按姓名搜索
    if (searchText) {
      filtered = filtered.filter(candidate => 
        candidate.name.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // 按岗位筛选
    if (selectedPosition) {
      filtered = filtered.filter(candidate => 
        candidate.position === selectedPosition
      );
    }

    setFilteredCandidates(filtered);
  };

  const handleSelect = (candidate) => {
    onSelect(candidate);
  };

  const getPositionOptions = () => {
    const positions = [...new Set(candidates.map(c => c.position))];
    return positions;
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'green';
    if (score >= 80) return 'blue';
    if (score >= 70) return 'orange';
    return 'red';
  };

  const getScoreText = (score) => {
    if (score >= 90) return '优秀';
    if (score >= 80) return '良好';
    if (score >= 70) return '中等';
    if (score >= 60) return '及格';
    return '待提升';
  };

  return (
    <Modal
      title="选择候选人进行面试"
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
      style={{ top: 20 }}
    >
      <div style={{ marginBottom: '16px' }}>
        <Space size="middle" style={{ width: '100%' }}>
          <Search
            placeholder="搜索候选人姓名"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="选择岗位"
            value={selectedPosition}
            onChange={setSelectedPosition}
            style={{ width: 150 }}
            allowClear
          >
            {getPositionOptions().map(position => (
              <Option key={position} value={position}>
                {position}
              </Option>
            ))}
          </Select>
        </Space>
      </div>

      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Text>加载中...</Text>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Text type="secondary">没有找到候选人</Text>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {filteredCandidates.map(candidate => (
              <Card
                key={candidate.id}
                size="small"
                hoverable
                style={{ cursor: 'pointer' }}
                onClick={() => handleSelect(candidate)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <UserOutlined style={{ color: '#1890ff' }} />
                      <Text strong style={{ fontSize: '16px' }}>{candidate.name}</Text>
                      <Tag color="blue">{candidate.position}</Tag>
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                      <Text>电话: {candidate.phone}</Text>
                      <Text style={{ marginLeft: '16px' }}>邮箱: {candidate.email}</Text>
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      <Text>MBTI: {candidate.mbti}</Text>
                      <Text style={{ marginLeft: '16px' }}>提交时间: {candidate.submitTime}</Text>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ marginBottom: '4px' }}>
                      <Tag color={getScoreColor(parseInt(candidate.matchScore))}>
                        简历评分: {candidate.matchScore}分
                      </Tag>
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      <Text>{getScoreText(parseInt(candidate.matchScore))}</Text>
                    </div>
                    {candidate.interviewScore && (
                      <div style={{ marginTop: '4px' }}>
                        <Tag color={getScoreColor(candidate.interviewScore)}>
                          面试评分: {candidate.interviewScore}分
                        </Tag>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <Text type="secondary">
          共找到 {filteredCandidates.length} 位候选人
        </Text>
      </div>
    </Modal>
  );
};

export default CandidateSelector;



