module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  ignorePatterns: [
    'src/sdk/**/*',
    'src/sdk/**/*.js',
    'src/sdk/**/*.ts',
    'src/sdk/**/*.jsx',
    'src/sdk/**/*.tsx',
    'build/**/*',
    'dist/**/*',
    'node_modules/**/*',
    '**/index-OS7Lza_r.js',
    '**/webrtc-player--YuOiwFd.js',
    '**/xrtc-player-BJTnVhG9.js'
  ],
  rules: {
    // 关闭一些严格的规则，特别是对第三方库文件
    'no-unused-expressions': 'off',
    'no-undef': 'off',
    'no-restricted-globals': 'off',
    'no-console': 'warn',
    'no-debugger': 'warn'
  },
  overrides: [
    {
      // 对SDK文件使用更宽松的规则
      files: ['src/sdk/**/*.js'],
      rules: {
        'no-unused-expressions': 'off',
        'no-undef': 'off',
        'no-restricted-globals': 'off',
        'no-console': 'off',
        'no-debugger': 'off'
      }
    }
  ],
  env: {
    browser: true,
    es6: true,
    node: true
  },
  globals: {
    // 定义一些全局变量，避免ESLint报错
    wx: 'readonly',
    globalThis: 'readonly',
    SuppressedError: 'readonly'
  }
};
