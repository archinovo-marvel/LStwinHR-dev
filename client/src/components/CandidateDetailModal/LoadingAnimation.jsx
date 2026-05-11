import React, { useState, useEffect, useRef } from 'react';
import './CandidateDetailModal.css';

const STAGE_META = {
  'local-VL排队中': { step: 0, color: '#D97706', label: '等待队列' },
  'Qwen3.5-9B排队中': { step: 0, color: '#D97706', label: '等待队列' },
  'local-VL分析准备中': { step: 0, color: '#2563EB', label: '初始化模型' },
  'Qwen3.5-9B分析准备中': { step: 0, color: '#2563EB', label: '初始化模型' },
  'PDF解析中': { step: 1, color: '#4F46E5', label: '文件解析' },
  'local-VL OCR分析中': { step: 1, color: '#0891B2', label: '视觉识别' },
  'Qwen3.5-9B OCR分析中': { step: 1, color: '#0891B2', label: '视觉识别' },
  'OCR融合分析中': { step: 1, color: '#0D9488', label: '信息融合' },
  'DeepSeek分析中': { step: 2, color: '#7C3AED', label: '智能分析' },
  'local-VL文本分析中': { step: 2, color: '#2563EB', label: '结构化提取' },
  'Qwen3.5-9B文本分析中': { step: 2, color: '#2563EB', label: '结构化提取' },
  '分析中': { step: 0, color: '#2563EB', label: '处理中' },
  '待分析': { step: 0, color: '#EA580C', label: '等待中' }
};

const STEPS = ['文件解析', 'AI分析', '报告生成'];

const TechLoadingAnimation = ({ mode, liveStatus }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [dots] = useState([0, 1, 2]);
  const [bars, setBars] = useState([20, 45, 70, 35, 80, 55, 90, 40, 65, 50]);
  const barRef = useRef(null);

  const stageKey = String(liveStatus?.title || '分析中');
  const normalizedKey = stageKey
    .replace('Qwen3.5-9B排队中', 'Qwen3.5-9B排队中')
    .replace('Qwen3.5-9B分析准备中', 'Qwen3.5-9B分析准备中')
    .replace('Qwen3.5-9B OCR分析中', 'Qwen3.5-9B OCR分析中')
    .replace('Qwen3.5-9B文本分析中', 'Qwen3.5-9B文本分析中')
    .replace('local-VL排队中', 'Qwen3.5-9B排队中')
    .replace('local-VL分析准备中', 'Qwen3.5-9B分析准备中')
    .replace('local-VL OCR分析中', 'Qwen3.5-9B OCR分析中')
    .replace('local-VL文本分析中', 'Qwen3.5-9B文本分析中');

  const meta = STAGE_META[normalizedKey] || STAGE_META['分析中'];
  const modeLabel = mode === 'local-vl' ? 'Qwen3.5-9B 多模态' : mode === 'deepseek' ? 'DeepSeek API' : '默认模式';

  useEffect(() => {
    setActiveStep(meta.step);
  }, [meta.step]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBars(prev => prev.map((h, i) => {
        const base = 20 + (i * 7);
        const variation = Math.sin(Date.now() / 300 + i * 0.8) * 25;
        return Math.max(15, Math.min(95, base + variation));
      }));
    }, 180);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="tech-loading-container">
      <div className="tech-loading-header">
        <div className="tech-ring-wrapper">
          <svg className="tech-ring" viewBox="0 0 120 120" fill="none">
            <circle cx="60" cy="60" r="52" stroke="#E2E8F0" strokeWidth="6" />
            <circle
              cx="60" cy="60" r="52"
              stroke={meta.color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="82 245"
              className="tech-ring-arc"
              style={{ '--ring-color': meta.color }}
            />
            <circle cx="60" cy="60" r="38" fill="none" stroke={meta.color} strokeWidth="1.5" opacity="0.25" />
            <circle cx="60" cy="60" r="4" fill={meta.color} className="tech-ring-core" />
          </svg>
          <div className="tech-ring-step-num" style={{ color: meta.color }}>
            {activeStep + 1}
          </div>
        </div>

        <div className="tech-loading-text">
          <div className="tech-loading-stage" style={{ color: meta.color }}>
            {meta.label}
          </div>
          <div className="tech-loading-status">
            {liveStatus?.message || liveStatus?.title || '简历分析进行中...'}
          </div>
          <div className="tech-loading-mode">{modeLabel}</div>
        </div>
      </div>

      <div className="tech-steps-row">
        {STEPS.map((step, i) => (
          <div key={i} className={`tech-step-item ${i < activeStep ? 'done' : i === activeStep ? 'active' : ''}`}>
            <div className="tech-step-dot" style={i <= activeStep ? { background: meta.color, boxShadow: `0 0 8px ${meta.color}` } : {}} />
            <span className="tech-step-label">{step}</span>
            {i < STEPS.length - 1 && (
              <div className={`tech-step-line ${i < activeStep ? 'done' : ''}`} style={i < activeStep ? { background: meta.color } : {}} />
            )}
          </div>
        ))}
      </div>

      <div className="tech-bars-wrapper">
        <div className="tech-bars-grid">
          {bars.map((height, i) => (
            <div key={i} className="tech-bar-slot">
              <div
                className="tech-bar"
                style={{
                  height: `${height}%`,
                  background: i <= activeStep ? meta.color : '#CBD5E1',
                  opacity: i <= activeStep ? 1 : 0.4,
                  transition: 'height 0.25s ease, background 0.4s ease'
                }}
              />
            </div>
          ))}
        </div>
        <div className="tech-bars-label">数据处理中</div>
      </div>

      <div className="tech-loading-dots">
        {dots.map(i => (
          <span
            key={i}
            className="tech-dot"
            style={{
              background: i <= activeStep ? meta.color : '#CBD5E1',
              transition: 'background 0.4s ease'
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default TechLoadingAnimation;
