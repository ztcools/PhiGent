import type { ReactNode } from 'react';
import { AuthProvider } from './Auth';
import { DataProvider } from './Data';
import { SystemProvider } from './System';

/**
 * 会话级 Provider 组合层。
 *
 * 先保持 Auth/Data/System 的上下文 API 不变，统一收敛它们的挂载顺序；
 * 后续可以在不改 App 入口的前提下逐步把内部状态迁入真正的 Session 状态模型。
 */
export const SessionProvider = ({ children }: { children: ReactNode }) => {
  return (
    <AuthProvider>
      <DataProvider>
        <SystemProvider>{children}</SystemProvider>
      </DataProvider>
    </AuthProvider>
  );
};
