import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Steps, 
  Button, 
  Typography, 
  Row, 
  Col,
  Space
} from 'antd';
import { 
  PlayCircleOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import axios from 'axios';
import styled from 'styled-components';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

const WorkflowCard = styled(Card)`
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  margin-bottom: 24px;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  }
`;

const WorkflowPage = () => {
  const [workflows, setWorkflows] = useState([]);
  const [currentWorkflow, setCurrentWorkflow] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const response = await axios.get('/api/workflows');
      setWorkflows(response.data.workflows);
    } catch (error) {
      console.error('获取工作流失败:', error);
    }
  };

  const startWorkflow = (workflow) => {
    setCurrentWorkflow(workflow);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (currentStep < currentWorkflow.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getStepStatus = (stepIndex) => {
    if (stepIndex < currentStep) return 'finish';
    if (stepIndex === currentStep) return 'process';
    return 'wait';
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <Title level={2}>工作流程</Title>

      {!currentWorkflow ? (
        <Row gutter={[24, 24]}>
          {workflows.map((workflow, index) => (
            <Col xs={24} md={12} key={workflow.id}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <WorkflowCard
                  title={
                    <Space>
                      <PlayCircleOutlined style={{ color: '#1890ff' }} />
                      {workflow.title}
                    </Space>
                  }
                  extra={
                    <Button 
                      type="primary" 
                      onClick={() => startWorkflow(workflow)}
                    >
                      开始流程
                    </Button>
                  }
                >
                  <Paragraph>{workflow.description}</Paragraph>
                  <div style={{ marginTop: 16 }}>
                    <Text type="secondary">步骤数量：{workflow.steps.length}</Text>
                  </div>
                </WorkflowCard>
              </motion.div>
            </Col>
          ))}
        </Row>
      ) : (
        <div>
          <Card 
            title={`${currentWorkflow.title} - 进行中`}
            extra={
              <Button onClick={() => setCurrentWorkflow(null)}>
                返回列表
              </Button>
            }
            style={{ marginBottom: 24 }}
            styles={{ header: { borderRadius: '8px 8px 0 0' } }}
          >
            <Steps current={currentStep} status={getStepStatus(currentStep)}>
              {currentWorkflow.steps.map((step, index) => (
                <Step 
                  key={index} 
                  title={step}
                  status={getStepStatus(index)}
                />
              ))}
            </Steps>

            <div style={{ marginTop: 32, textAlign: 'center' }}>
              <Title level={3}>当前步骤：{currentWorkflow.steps[currentStep]}</Title>
              <Paragraph>
                请按照提示完成当前步骤，完成后点击下一步继续。
              </Paragraph>

              <Space size="large" style={{ marginTop: 24 }}>
                <Button 
                  onClick={prevStep}
                  disabled={currentStep === 0}
                >
                  上一步
                </Button>
                <Button 
                  type="primary"
                  onClick={nextStep}
                  disabled={currentStep === currentWorkflow.steps.length - 1}
                >
                  下一步
                </Button>
              </Space>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default WorkflowPage;
