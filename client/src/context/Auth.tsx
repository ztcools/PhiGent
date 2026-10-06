import { createContext, useCallback, useEffect, useState, useMemo } from 'react';
import { AuthContextType } from './Types';
import { MilvusService } from '@/http';
import {
  MILVUS_CLIENT_ID,
  MILVUS_URL,
  MILVUS_DATABASE,
  ATTU_AUTH_REQ,
} from '@/consts';
import type { AuthReq } from '@server/types';

export const authContext = createContext<AuthContextType>({
  clientId: '',
  authReq: {
    username: '',
    password: '',
    address: '',
    token: '',
    database: '',
    checkHealth: true,
    clientId: '',
    ssl: false,
  },
  setAuthReq: () => {},
  isManaged: false,
  isServerless: false,
  isDedicated: false,
  isAuth: false,
  login: async () => {
    return { clientId: '', database: '' };
  },
  logout: () => {},
});

const { Provider } = authContext;

const getDefaultAuthReq = (): AuthReq => ({
  username: '',
  password: '',
  address: MILVUS_URL,
  token: '',
  database: MILVUS_DATABASE,
  checkHealth: true,
  clientId: '',
  ssl: false,
});

const loadStoredAuth = () => {
  let storedClientId = '';
  let storedAuthReq = getDefaultAuthReq();

  try {
    storedClientId = window.localStorage.getItem(MILVUS_CLIENT_ID) || '';
    const rawAuthReq = window.localStorage.getItem(ATTU_AUTH_REQ);
    if (rawAuthReq) {
      storedAuthReq = { ...storedAuthReq, ...JSON.parse(rawAuthReq) };
    } else {
      storedAuthReq.clientId = storedClientId;
    }
  } catch (e) {
    // localStorage 不可用或 JSON 解析失败时回退到默认值
  }

  return { storedClientId, storedAuthReq };
};

export const AuthProvider = (props: { children: React.ReactNode }) => {
  const [initialAuth] = useState(loadStoredAuth);

  // 状态
  const [authReq, setAuthReq] = useState<AuthReq>(initialAuth.storedAuthReq);
  const [clientId, setClientId] = useState<string>(initialAuth.storedClientId);

  // authReq 变化时更新 localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(
        ATTU_AUTH_REQ,
        JSON.stringify({ ...authReq, password: '', token: '' })
      );
    } catch (e) {
      // localStorage 不可用时仍允许页面继续运行。
    }
    document.title = authReq.address ? `${authReq.address} - PhiGent` : 'PhiGent';
  }, [authReq]);

  // 登录 API
  const login = useCallback(async (params: AuthReq) => {
    params.clientId = Math.random().toString(36).substring(7);
    // clientId 只设置一次
    try {
      window.localStorage.setItem(MILVUS_CLIENT_ID, params.clientId);
    } catch (e) {
      // localStorage 不可用时仍继续发起连接。
    }
    const res = await MilvusService.connect(params);
    setAuthReq({ ...params, database: res.database });
    setClientId(res.clientId);
    // clientId 变化时同步更新 localStorage
    if (res.clientId !== params.clientId) {
      try {
        window.localStorage.setItem(MILVUS_CLIENT_ID, res.clientId);
      } catch (e) {
        // localStorage 不可用时仍保留内存中的 clientId。
      }
    }
    return res;
  }, []);

  // 登出 API
  const logout = useCallback(async (pass?: boolean) => {
    if (!pass) {
      await MilvusService.closeConnection();
    }
    setClientId('');
    try {
      window.localStorage.removeItem(MILVUS_CLIENT_ID);
      window.localStorage.removeItem(ATTU_AUTH_REQ);
    } catch (e) {
      // localStorage 不可用时忽略清理失败。
    }
  }, []);

  // 用 useMemo 缓存计算值
  const isManaged = useMemo(
    () => authReq.address.includes('zilliz'),
    [authReq.address]
  );
  const isServerless = useMemo(
    () => isManaged && authReq.address.includes('serverless'),
    [isManaged, authReq.address]
  );
  const isDedicated = useMemo(
    () => !isServerless && isManaged,
    [isServerless, isManaged]
  );

  return (
    <Provider
      value={{
        authReq,
        setAuthReq,
        login,
        logout,
        clientId,
        isAuth: !!clientId,
        isManaged,
        isServerless,
        isDedicated,
      }}
    >
      {props.children}
    </Provider>
  );
};
