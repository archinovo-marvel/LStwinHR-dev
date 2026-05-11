import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import CandidateDetailModal from './CandidateDetailModal';

jest.mock('../../pages/ResumeAnalysis', () => ({
  calculateResumeScore: jest.fn((scores = {}) => {
    const total = ['educationScore', 'workScore', 'projectScore', 'skillScore', 'expressionScore']
      .reduce((sum, key) => sum + Number(scores[key] || 0), 0);
    return Math.max(0, total - Number(scores.riskPenalty || 0));
  }),
}));

describe('CandidateDetailModal interview report', () => {
  beforeAll(() => {
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
    }
  });

  it('renders comprehensive interview summary, strengths, weaknesses and dimension analysis', () => {
    const candidate = {
      id: 'candidate-1',
      name: '张三',
      position: '前端工程师',
      phone: '13800138000',
      email: 'zhangsan@example.com',
      submitTime: '2026-05-08 10:00',
      hasInterview: true,
      interviewScore: 82,
      recommendation: '建议进入下一轮。',
      resumeAnalysisResult: {
        scores: {
          educationScore: 16,
          workScore: 18,
          projectScore: 24,
          skillScore: 20,
          expressionScore: 4,
          riskPenalty: 0,
        },
        status: {
          state: 'ready',
          title: '简历分析完成',
          message: '已生成结构化解析',
        },
        summary: {
          matchLevel: 'high',
          recommendation: '推荐',
          reasons: ['项目经验匹配岗位'],
          interviewSuggestions: [],
        },
        risks: {
          level: 'low',
          items: [],
        },
        extractedContent: {
          education: [{ school: '某大学', major: '计算机科学', degree: '本科' }],
          workExperience: [{ company: '某科技公司', position: '前端工程师', description: '负责业务前端开发' }],
          projectExperience: [{ projectName: '招聘平台', role: '负责人', description: '主导招聘平台重构' }],
          campusExperience: [],
          skills: ['React', 'Node.js'],
        },
        education: [],
        workExperience: [],
        projectExperience: [],
        campusExperience: [],
      },
      interviewDetails: {
        totalScore: 78.5,
        report: [
          '整体评价：候选人与目标岗位的基本匹配度较高，回答节奏稳定，能清楚说明关键经历。',
          'IQ分析：专业能力基础较扎实，对项目背景和实现路径表达清楚。',
          'EQ分析：沟通比较自然，能回应协作与反馈场景。',
          'AQ分析：遇到问题时能给出基本拆解思路，但复盘深度仍可加强。',
          'MQ分析：责任意识较稳定，价值判断没有明显偏差。',
          '核心优势：项目经验贴近岗位；表达清晰；学习意愿较强。',
          '待提升项：复杂场景下的技术深挖还不够；部分成果缺少量化结果。',
          '录用建议：建议进入下一轮，重点追问项目复杂度与个人贡献边界。',
        ].join('\n'),
        categoryScores: {
          iq: { score: 41.7 },
          eq: { score: 17.3 },
          aq: { score: 12.5 },
          mq: { score: 7 },
        },
        questionScores: [],
      },
      interviewRecords: [],
    };

    render(
      <CandidateDetailModal
        visible
        candidate={candidate}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('综合评价')).toBeInTheDocument();
    expect(screen.getByText('候选人优势')).toBeInTheDocument();
    expect(screen.getByText('候选人短板')).toBeInTheDocument();
    expect(screen.getByText('IQ分析')).toBeInTheDocument();
    expect(screen.getByText('EQ分析')).toBeInTheDocument();
    expect(screen.getByText('AQ分析')).toBeInTheDocument();
    expect(screen.getByText('MQ分析')).toBeInTheDocument();
    expect(screen.getByText('项目经验贴近岗位')).toBeInTheDocument();
    expect(screen.getByText('复杂场景下的技术深挖还不够')).toBeInTheDocument();
  });
});