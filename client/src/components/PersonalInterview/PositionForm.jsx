/**
 * 岗位信息表单组件
 * 用于填写目标岗位信息
 */
import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Input, Select, Tag } from 'antd';
import { SolutionOutlined, EnvironmentOutlined, FileTextOutlined, ToolOutlined } from '@ant-design/icons';
import { colors } from '../../theme/colors';

const { TextArea } = Input;

// ============================================
// STYLED COMPONENTS
// ============================================
const FormWrapper = styled(motion.div)`
  background: ${colors.surface};
  border-radius: 16px;
  border: 1px solid ${colors.border};
  padding: 24px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.03);
`;

const FormHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid ${colors.border};
`;

const FormIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: ${colors.accentSub};
  display: flex;
  align-items: center;
  justify-content: center;

  .anticon {
    font-size: 16px;
    color: ${colors.accent};
  }
`;

const FormTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: ${colors.text};
`;

const FormBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const FormItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FormLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${colors.text};
  display: flex;
  align-items: center;
  gap: 6px;

  .required {
    color: ${colors.error};
  }
`;

const FormHint = styled.div`
  font-size: 12px;
  color: ${colors.textMuted};
`;

const StyledInput = styled(Input)`
  border-radius: 8px;
  border-color: ${colors.border};

  &:hover,
  &:focus {
    border-color: ${colors.accent};
  }
`;

const StyledTextArea = styled(TextArea)`
  border-radius: 8px;
  border-color: ${colors.border};

  &:hover,
  &:focus {
    border-color: ${colors.accent};
  }
`;

const SkillsInputWrapper = styled.div`
  .ant-select-selector {
    border-radius: 8px !important;
    border-color: ${colors.border} !important;
  }

  .ant-select:hover .ant-select-selector {
    border-color: ${colors.accent} !important;
  }

  .ant-select-focused .ant-select-selector {
    border-color: ${colors.accent} !important;
    box-shadow: 0 0 0 2px ${colors.accentSub} !important;
  }
`;

// ============================================
// COMPONENT
// ============================================
const PositionForm = ({
  value,
  onChange,
  disabled = false
}) => {
  const handleChange = (field, fieldValue) => {
    onChange?.({
      ...value,
      [field]: fieldValue
    });
  };

  const handleSkillsChange = (skills) => {
    onChange?.({
      ...value,
      skills
    });
  };

  // 常见技能选项
  const skillOptions = [
    // 技术类
    { value: 'JavaScript', label: 'JavaScript' },
    { value: 'TypeScript', label: 'TypeScript' },
    { value: 'React', label: 'React' },
    { value: 'Vue', label: 'Vue' },
    { value: 'Angular', label: 'Angular' },
    { value: 'Node.js', label: 'Node.js' },
    { value: 'Python', label: 'Python' },
    { value: 'Java', label: 'Java' },
    { value: 'Go', label: 'Go' },
    { value: 'C++', label: 'C++' },
    { value: 'SQL', label: 'SQL' },
    { value: 'MongoDB', label: 'MongoDB' },
    { value: 'Redis', label: 'Redis' },
    { value: 'Docker', label: 'Docker' },
    { value: 'Kubernetes', label: 'Kubernetes' },
    { value: 'AWS', label: 'AWS' },
    { value: 'Git', label: 'Git' },
    // 通用类
    { value: '项目管理', label: '项目管理' },
    { value: '团队协作', label: '团队协作' },
    { value: '沟通能力', label: '沟通能力' },
    { value: '数据分析', label: '数据分析' },
    { value: '产品思维', label: '产品思维' },
    { value: '用户研究', label: '用户研究' },
    { value: 'UI设计', label: 'UI设计' },
    { value: 'UX设计', label: 'UX设计' },
  ];

  return (
    <FormWrapper
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <FormHeader>
        <FormIcon>
          <SolutionOutlined />
        </FormIcon>
        <FormTitle>目标岗位信息</FormTitle>
      </FormHeader>

      <FormBody>
        {/* 第一行：岗位名称 + 公司名称 */}
        <FormRow>
          <FormItem>
            <FormLabel>
              <SolutionOutlined />
              岗位名称 <span className="required">*</span>
            </FormLabel>
            <StyledInput
              placeholder="例如：前端开发工程师"
              value={value?.positionName || ''}
              onChange={(e) => handleChange('positionName', e.target.value)}
              disabled={disabled}
            />
          </FormItem>

          <FormItem>
            <FormLabel>
              <EnvironmentOutlined />
              公司名称
            </FormLabel>
            <StyledInput
              placeholder="例如：阿里巴巴"
              value={value?.companyName || ''}
              onChange={(e) => handleChange('companyName', e.target.value)}
              disabled={disabled}
            />
          </FormItem>
        </FormRow>

        {/* 岗位描述 */}
        <FormItem>
          <FormLabel>
            <FileTextOutlined />
            岗位描述 <span className="required">*</span>
          </FormLabel>
          <FormHint>详细描述岗位的工作内容、职责范围等</FormHint>
          <StyledTextArea
            rows={4}
            placeholder="例如：负责公司前端产品的开发与维护，参与技术方案设计，优化用户体验..."
            value={value?.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            disabled={disabled}
          />
        </FormItem>

        {/* 技能要求 */}
        <FormItem>
          <FormLabel>
            <ToolOutlined />
            技能要求
          </FormLabel>
          <FormHint>选择或输入岗位需要的核心技能</FormHint>
          <SkillsInputWrapper>
            <Select
              mode="tags"
              placeholder="选择或输入技能标签"
              value={value?.skills || []}
              onChange={handleSkillsChange}
              options={skillOptions}
              disabled={disabled}
              style={{ width: '100%' }}
              tagRender={(props) => {
                const { label, closable, onClose } = props;
                return (
                  <Tag
                    color={colors.accent}
                    closable={closable}
                    onClose={onClose}
                    style={{ marginRight: 3 }}
                  >
                    {label}
                  </Tag>
                );
              }}
            />
          </SkillsInputWrapper>
        </FormItem>

        {/* 第二行：工作年限 + 薪资范围 */}
        <FormRow>
          <FormItem>
            <FormLabel>工作年限要求</FormLabel>
            <StyledInput
              placeholder="例如：3-5年"
              value={value?.workYears || ''}
              onChange={(e) => handleChange('workYears', e.target.value)}
              disabled={disabled}
            />
          </FormItem>

          <FormItem>
            <FormLabel>薪资范围</FormLabel>
            <StyledInput
              placeholder="例如：20-30K"
              value={value?.salaryRange || ''}
              onChange={(e) => handleChange('salaryRange', e.target.value)}
              disabled={disabled}
            />
          </FormItem>
        </FormRow>
      </FormBody>
    </FormWrapper>
  );
};

export default PositionForm;