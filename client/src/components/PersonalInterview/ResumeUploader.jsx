/**
 * 简历上传组件
 * 支持拖拽上传和点击上传
 */
import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, message } from 'antd';
import { InboxOutlined, FileTextOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { colors } from '../../theme/colors';

const { Dragger } = Upload;

// ============================================
// STYLED COMPONENTS
// ============================================
const UploadWrapper = styled.div`
  .ant-upload-drag {
    border: 2px dashed ${colors.border};
    border-radius: 12px;
    background: ${colors.frost};
    transition: all 0.3s ease;
    padding: 32px 24px;

    &:hover {
      border-color: ${colors.accent};
      background: ${colors.accentSub};
    }

    &.ant-upload-drag-hover {
      border-color: ${colors.accent};
      background: ${colors.accentSub};
    }
  }

  .ant-upload-drag-icon .anticon {
    font-size: 40px;
    color: ${colors.accent};
  }

  .ant-upload-text {
    font-size: 15px;
    font-weight: 500;
    color: ${colors.text};
    margin-top: 12px;
  }

  .ant-upload-hint {
    color: ${colors.textMuted};
    font-size: 13px;
    margin-top: 8px;
  }
`;

const UploadedFileCard = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: ${colors.surface};
  border: 1px solid ${colors.border};
  border-radius: 10px;
  margin-top: 16px;
`;

const FileIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: ${colors.accentSub};
  display: flex;
  align-items: center;
  justify-content: center;

  .anticon {
    font-size: 20px;
    color: ${colors.accent};
  }
`;

const FileInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const FileName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${colors.text};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FileSize = styled.div`
  font-size: 12px;
  color: ${colors.textMuted};
  margin-top: 4px;
`;

const FileStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: ${colors.success};
`;

const DeleteBtn = styled.button`
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: ${colors.textMuted};
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: ${colors.frost};
    color: ${colors.error};
  }
`;

// ============================================
// COMPONENT
// ============================================
const ResumeUploader = ({
  value,
  onChange,
  maxSize = 10,
  accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png'
}) => {
  const [file, setFile] = useState(value || null);

  // 上传前校验 - 返回 Upload.LIST_IGNORE 阻止自动上传但仍然处理文件
  const beforeUpload = (file) => {
    const isValidType = accept.split(',').some(ext =>
      file.name.toLowerCase().endsWith(ext.trim())
    );

    if (!isValidType) {
      message.error('只支持 PDF、Word、JPG、PNG 格式文件');
      return Upload.LIST_IGNORE;
    }

    const isValidSize = file.size / 1024 / 1024 < maxSize;
    if (!isValidSize) {
      message.error(`文件大小不能超过 ${maxSize}MB`);
      return Upload.LIST_IGNORE;
    }

    // 手动设置文件
    setFile(file);
    onChange?.(file);

    // 阻止自动上传
    return false;
  };

  // 删除文件
  const handleRemove = () => {
    setFile(null);
    onChange?.(null);
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div>
      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div
            key="uploader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <UploadWrapper>
              <Dragger
                name="resume"
                multiple={false}
                accept={accept}
                beforeUpload={beforeUpload}
                showUploadList={false}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽上传简历</p>
                <p className="ant-upload-hint">
                  支持 PDF、Word、JPG、PNG 格式，最大 {maxSize}MB
                </p>
              </Dragger>
            </UploadWrapper>
          </motion.div>
        ) : (
          <motion.div
            key="file"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <UploadedFileCard>
              <FileIcon>
                <FileTextOutlined />
              </FileIcon>
              <FileInfo>
                <FileName>{file.name}</FileName>
                <FileSize>{formatFileSize(file.size)}</FileSize>
              </FileInfo>
              <FileStatus>
                <CheckCircleOutlined />
                已选择
              </FileStatus>
              <DeleteBtn onClick={handleRemove}>
                <DeleteOutlined />
              </DeleteBtn>
            </UploadedFileCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResumeUploader;
