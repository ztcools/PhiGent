import axios from 'axios';
import { MILVUS_CLIENT_ID } from '@/consts';

// 基础 host url
const hostUrl: { [key: string]: string | undefined } = {
  development: ``,
  production: ((window as any)._env_ && (window as any)._env_.HOST_URL) || '',
};

export const url = hostUrl[import.meta.env.MODE];

const axiosInstance = axios.create({
  baseURL: `${url}/api/v1`,
  timeout: 60000 * 5, // 5 分钟
});

axiosInstance.interceptors.request.use(
  function (config) {
    // 请求发送前的处理
    const address = window.localStorage.getItem(MILVUS_CLIENT_ID);

    address && (config.headers[MILVUS_CLIENT_ID] = address);

    return config;
  },
  function (error) {
    // 请求错误的处理
    return Promise.reject(error);
  }
);

export default axiosInstance;
