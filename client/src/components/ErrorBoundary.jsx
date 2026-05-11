import React from 'react';
import { Button, message } from 'antd';

/**
 * P1-2: React 错误边界 — 包裹面试关键区域
 * 防止子组件渲染异常导致整个页面白屏，面试数据全部丢失。
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] 捕获到渲染错误:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          retry: this.handleRetry,
        });
      }

      return (
        <div style={{
          padding: '40px 24px',
          textAlign: 'center',
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #f0f0f0',
          margin: '24px 0',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#9888;</div>
          <h3 style={{ marginBottom: 8, color: '#333' }}>页面出现异常</h3>
          <p style={{ color: '#999', marginBottom: 20, fontSize: 13 }}>
            {this.state.error?.message || '渲染过程中发生了未知错误'}
          </p>
          <Button type="primary" onClick={this.handleRetry}>
            重试
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
