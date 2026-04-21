import React, { useState, useEffect } from 'react';
import { LoadingOutlined, ScanOutlined, CloudOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { Progress, Typography } from 'antd';
import './CandidateDetailModal.css';

const { Title, Text } = Typography;

const ANALYSIS_STAGE_META = {
  'local-VL排队中': {
    stepIndex: 0,
    progressFloor: 4,
    progressCeiling: 12,
    title: '正在等待串行处理',
    tip: '当前服务器仅串行执行一个local-VL任务，请稍候...',
    accent: '#D97706'
  },
  'Qwen3.5-9B排队中': {
    stepIndex: 0,
    progressFloor: 4,
    progressCeiling: 12,
    title: '正在等待串行处理',
    tip: '当前服务器仅串行执行一个Qwen3.5-9B任务，请稍候...',
    accent: '#D97706'
  },
  'local-VL分析准备中': {
    stepIndex: 0,
    progressFloor: 8,
    progressCeiling: 18,
    title: '正在准备重新分析',
    tip: '正在初始化local-VL分析任务，请稍候...',
    accent: '#2563EB'
  },
  'Qwen3.5-9B分析准备中': {
    stepIndex: 0,
    progressFloor: 8,
    progressCeiling: 18,
    title: '正在准备重新分析',
    tip: '正在初始化Qwen3.5-9B分析任务，请稍候...',
    accent: '#2563EB'
  },
  'PDF解析中': {
    stepIndex: 0,
    progressFloor: 18,
    progressCeiling: 38,
    title: '正在解析简历文件',
    tip: '正在提取PDF中的图像与文本内容...',
    accent: '#4F46E5'
  },
  'local-VL OCR分析中': {
    stepIndex: 1,
    progressFloor: 38,
    progressCeiling: 68,
    title: '正在执行local-VL OCR',
    tip: '正在通过local-VL识别简历版面与正文...',
    accent: '#0891B2'
  },
  'Qwen3.5-9B OCR分析中': {
    stepIndex: 1,
    progressFloor: 38,
    progressCeiling: 68,
    title: '正在执行Qwen3.5-9B OCR',
    tip: '正在通过Qwen3.5-9B识别简历版面与正文...',
    accent: '#0891B2'
  },
  'OCR融合分析中': {
    stepIndex: 1,
    progressFloor: 46,
    progressCeiling: 74,
    title: '正在执行OCR融合',
    tip: '正在融合Tesseract OCR与local-VL OCR结果...',
    accent: '#0D9488'
  },
  'DeepSeek分析中': {
    stepIndex: 2,
    progressFloor: 72,
    progressCeiling: 94,
    title: '正在执行DeepSeek分析',
    tip: '正在使用备用分析链路生成结构化结果...',
    accent: '#7C3AED'
  },
  'local-VL文本分析中': {
    stepIndex: 2,
    progressFloor: 68,
    progressCeiling: 92,
    title: '正在执行local-VL文本分析',
    tip: '正在生成结构化结果与综合评估...',
    accent: '#2563EB'
  },
  'Qwen3.5-9B文本分析中': {
    stepIndex: 2,
    progressFloor: 68,
    progressCeiling: 92,
    title: '正在执行Qwen3.5-9B文本分析',
    tip: '正在生成结构化结果与综合评估...',
    accent: '#2563EB'
  },
  '分析中': {
    stepIndex: 0,
    progressFloor: 8,
    progressCeiling: 18,
    title: '正在分析简历',
    tip: '正在进行简历分析...',
    accent: '#2563EB'
  },
  '待分析': {
    stepIndex: 0,
    progressFloor: 0,
    progressCeiling: 5,
    title: '等待分析',
    tip: '简历已上传，等待分析...',
    accent: '#EA580C'
  }
};

/**
 * 分析进度动画组件
 * 显示简历分析过程中的加载状态、进度条和分析步骤
 */
const AnalysisLoadingProgress = ({ mode, liveStatus }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const steps = [
    { icon: <ScanOutlined />, title: '解析简历', desc: '正在提取简历关键信息...' },
    { icon: <CloudOutlined />, title: 'AI分析', desc: '正在进行智能匹配分析...' },
    { icon: <CheckCircleOutlined />, title: '生成报告', desc: '正在生成评估结果...' }
  ];

  const modeLabel = mode === 'local-vl' ? 'Qwen3.5-9B多模态模型' : mode === 'deepseek' ? 'DeepSeek API' : '默认模式';
  const normalizedStageTitle = String(liveStatus?.title || '')
    .replace('Qwen3.5-9B排队中', 'Qwen3.5-9B排队中')
    .replace('Qwen3.5-9B分析准备中', 'Qwen3.5-9B分析准备中')
    .replace('Qwen3.5-9B OCR分析中', 'Qwen3.5-9B OCR分析中')
    .replace('Qwen3.5-9B文本分析中', 'Qwen3.5-9B文本分析中')
    .replace('local-VL排队中', 'Qwen3.5-9B排队中')
    .replace('local-VL分析准备中', 'Qwen3.5-9B分析准备中')
    .replace('local-VL OCR分析中', 'Qwen3.5-9B OCR分析中')
    .replace('local-VL文本分析中', 'Qwen3.5-9B文本分析中');
  const stageMeta = ANALYSIS_STAGE_META[normalizedStageTitle] || ANALYSIS_STAGE_META['Qwen3.5-9B分析准备中'];

  useEffect(() => {
    setCurrentStep(stageMeta.stepIndex);
    setProgress(prev => {
      const nextProgress = Math.max(prev, stageMeta.progressFloor);
      return Math.min(nextProgress, stageMeta.progressCeiling);
    });
  }, [stageMeta]);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= stageMeta.progressCeiling) {
          return prev;
        }
        const delta = stageMeta.stepIndex === 2 ? Math.random() * 1.8 + 0.6 : Math.random() * 3 + 1.2;
        return Math.min(prev + delta, stageMeta.progressCeiling);
      });
    }, 220);

    return () => {
      clearInterval(progressInterval);
    };
  }, [stageMeta]);

  return (
    <div className="analysis-loading-container">
      <div className="analysis-loading-header">
        <LoadingOutlined className="analysis-loading-spinner" />
        <Title level={4} className="analysis-loading-title">{stageMeta.title}</Title>
        <Text className="analysis-loading-mode">当前模式：{modeLabel}</Text>
        {liveStatus?.message && <Text className="analysis-loading-mode">{liveStatus.message}</Text>}
      </div>

      <div className="analysis-progress-wrapper">
        <Progress
          percent={Math.min(Math.round(progress), 95)}
          status="active"
          strokeColor={{
            '0%': stageMeta.accent || '#2F80ED',
            '100%': '#10B981'
          }}
          trailColor="#E8F2FF"
          strokeWidth={12}
          className="analysis-progress-bar"
        />
      </div>

      <div className="analysis-steps-container">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`analysis-step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
          >
            <div className="analysis-step-icon">
              {index < currentStep ? <CheckCircleOutlined /> : step.icon}
            </div>
            <div className="analysis-step-content">
              <Text strong className="analysis-step-title">{step.title}</Text>
              <Text className="analysis-step-desc">
                {index === currentStep
                  ? (liveStatus?.message || step.desc)
                  : index < currentStep
                    ? '已完成'
                    : '等待中'}
              </Text>
            </div>
            {index < steps.length - 1 && (
              <div className={`analysis-step-line ${index < currentStep ? 'completed' : ''}`} />
            )}
          </div>
        ))}
      </div>

      <div className="analysis-loading-footer">
        <div className="analysis-loading-pulse">
          <span className="pulse-dot"></span>
          <span className="pulse-dot"></span>
          <span className="pulse-dot"></span>
        </div>
        <Text className="analysis-loading-tip">{stageMeta.tip}</Text>
      </div>
    </div>
  );
};

export default AnalysisLoadingProgress;
