// styled-components 配置
import { StyleSheetManager } from 'styled-components';

// 修复 jsx 属性警告的配置
export const StyledComponentsConfig = ({ children }) => {
  return (
    <StyleSheetManager
      shouldForwardProp={(prop, defaultValidatorFn) => {
        // 过滤掉 jsx 属性
        if (prop === 'jsx') {
          return false;
        }
        return defaultValidatorFn(prop);
      }}
    >
      {children}
    </StyleSheetManager>
  );
};
