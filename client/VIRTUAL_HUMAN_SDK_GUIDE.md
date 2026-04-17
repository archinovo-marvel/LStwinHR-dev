# 虚拟人SDK集成指南

## 概述

本项目已成功集成讯飞虚拟人SDK 3.1.2.1002版本，提供了完整的虚拟人交互功能，包括文本交互、语音交互、动作控制等。

## 文件结构

```
client/src/
├── components/
│   ├── VirtualHumanSDK.js          # 核心SDK集成组件
│   ├── VirtualHumanConfig.js       # 配置管理组件
│   ├── VirtualHumanController.js   # 交互控制组件
│   └── AnimeStyle3D.js            # 更新的3D动画组件（支持SDK切换）
├── pages/
│   └── VirtualHumanPage.js        # 虚拟人页面
└── sdk/
    └── 3.1.2.1002/
        └── avatar-sdk-web_3.1.2.1002/
            ├── index.js           # SDK主文件
            ├── index.d.ts         # TypeScript类型定义
            └── ...                # 其他SDK文件
```

## 主要功能

### 1. 虚拟人SDK组件 (VirtualHumanSDK.js)

**核心功能：**
- SDK初始化和连接管理
- 事件监听和处理
- 文本交互
- 语音交互（全双工模式）
- 动作控制
- 错误处理和状态管理

**主要方法：**
- `connectAvatar()` - 连接虚拟人
- `disconnectAvatar()` - 断开连接
- `sendText(text, options)` - 发送文本
- `startRecording(duration)` - 开始录音
- `stopRecording()` - 停止录音
- `executeAction(actionId)` - 执行动作
- `interrupt()` - 打断当前播报

### 2. 配置管理组件 (VirtualHumanConfig.js)

**配置项：**
- API配置：App ID、API Key、API Secret、Scene ID、服务器地址
- 虚拟人配置：虚拟人ID、声音ID
- 流配置：协议类型、透明背景、码率、帧率
- 虚拟人参数：尺寸、缩放、位置
- TTS配置：语速、语调、音量
- 交互配置：交互模式、情感分析
- 字幕配置：字体、颜色、位置
- 动作配置：自动动作、无指向性动作

### 3. 交互控制组件 (VirtualHumanController.js)

**控制功能：**
- 文本输入和发送
- 语音录制控制
- 动作按钮
- 高级设置调整
- 状态显示

### 4. 虚拟人页面 (VirtualHumanPage.js)

**页面功能：**
- 完整的虚拟人交互界面
- 配置管理
- 状态监控
- 帮助说明

## 使用方法

### 1. 基本使用

```jsx
import VirtualHumanSDK from './components/VirtualHumanSDK';

function MyComponent() {
  const config = {
    appId: 'your_app_id',
    apiKey: 'your_api_key',
    apiSecret: 'your_api_secret',
    sceneId: 'your_scene_id',
    avatarId: 'your_avatar_id',
    vcn: 'your_voice_id'
  };

  return (
    <VirtualHumanSDK
      config={config}
      onStatusChange={(status) => console.log('状态变化:', status)}
      onAvatarClick={() => console.log('虚拟人被点击')}
    />
  );
}
```

### 2. 完整页面使用

访问 `/virtual-human` 路由即可使用完整的虚拟人交互页面。

### 3. 在现有组件中集成

```jsx
import AnimeStyle3D from './components/AnimeStyle3D';

function MyComponent() {
  const virtualHumanConfig = {
    appId: 'your_app_id',
    // ... 其他配置
  };

  return (
    <AnimeStyle3D
      useVirtualHumanSDK={true}
      virtualHumanConfig={virtualHumanConfig}
      isSpeaking={isSpeaking}
      isListening={isListening}
    />
  );
}
```

## 配置说明

### 必填配置项

1. **App ID** - 从交互平台-接口服务中获取
2. **API Key** - 从交互平台-接口服务中获取
3. **API Secret** - 从交互平台-接口服务中获取
4. **Scene ID** - 接口服务ID，从交互平台-接口服务中获取
5. **虚拟人ID** - 从交互平台-接口服务-形象列表中获取已授权的形象
6. **声音ID** - 从交互平台-接口服务-声音列表中获取已授权的声音

### 可选配置项

- **服务器地址** - 默认：`wss://avatar.cn-huadong-1.xf-yun.com/v1/interact`
- **协议类型** - 支持 `xrtc`（支持透明背景）和 `webrtc`
- **透明背景** - 仅在使用 `xrtc` 协议时有效
- **码率** - 视频码率，影响清晰度和网络要求
- **帧率** - 视频刷新率，影响流畅度
- **语速/语调/音量** - TTS参数调整
- **交互模式** - 追加模式或打断模式
- **字幕设置** - 字体、颜色、位置等

## 事件说明

### SDK事件

- `connected` - 连接建立成功
- `disconnected` - 连接断开
- `stream_start` - 推流开始
- `frame_start` - 开始说话推流首帧
- `frame_stop` - 结束说话末尾帧
- `asr` - 语音识别结果
- `nlp` - 语义理解结果
- `error` - 错误事件

### 播放器事件

- `play` - 开始播放
- `playing` - 正在播放
- `waiting` - 缓冲等待
- `playNotAllowed` - 播放被禁止（需要用户交互）

## 注意事项

1. **浏览器兼容性** - 建议使用Chrome或Edge浏览器
2. **自动播放限制** - 浏览器可能限制自动播放，需要用户交互后恢复
3. **麦克风权限** - 语音交互需要用户授权麦克风权限
4. **网络要求** - 需要稳定的网络连接
5. **配置保存** - 配置会自动保存到本地存储

## 故障排除

### 常见问题

1. **连接失败**
   - 检查网络连接
   - 验证API配置是否正确
   - 确认虚拟人ID和声音ID是否有效

2. **播放被禁止**
   - 点击页面任意位置
   - 调用 `resumePlayback()` 方法

3. **录音失败**
   - 检查麦克风权限
   - 确保用户已与页面交互

4. **虚拟人不显示**
   - 检查虚拟人ID配置
   - 确认渲染区域有固定尺寸

## 开发建议

1. **错误处理** - 始终监听错误事件并处理
2. **状态管理** - 使用状态回调管理UI状态
3. **资源清理** - 组件卸载时调用 `destroy()` 方法
4. **配置验证** - 使用前验证必填配置项
5. **用户体验** - 提供加载状态和错误提示

## 更新日志

- **v1.0.0** - 初始版本，集成讯飞虚拟人SDK 3.1.2.1002
- 支持文本交互、语音交互、动作控制
- 提供完整的配置管理和状态监控
- 集成到现有项目架构中

