import React, { useContext, useEffect } from 'react';
import axiosInstance from '@/http/Axios';
import { rootContext, authContext, dataContext } from '@/context';
import { HTTP_STATUS_CODE } from '@server/utils/Const';

let axiosResInterceptor: number | null = null;

const GlobalEffect = ({ children }: { children: React.ReactNode }) => {
  const { openSnackBar } = useContext(rootContext);
  const { logout } = useContext(authContext);
  const { database } = useContext(dataContext);

  useEffect(() => {
    // 为所有 axios 请求添加 database Header
    const requestInterceptor = axiosInstance.interceptors.request.use(
      config => {
        config.headers['x-attu-database'] = database;
        return config;
      },
      error => Promise.reject(error)
    );

    // 卸载时清理拦截器
    return () => {
      axiosInstance.interceptors.request.eject(requestInterceptor);
    };
  }, [database]);

  useEffect(() => {
    if (axiosResInterceptor === null) {
      axiosResInterceptor = axiosInstance.interceptors.response.use(
        (response: any) => {
          // 处理成功响应
          const isHttpError =
            response.statusCode && response.statusCode !== 200;

          // 判断响应是否为 ResStatus 类型且 ResStatus.error_code !== 'Success'
          const isResStatusError =
            response.data &&
            response.data.data &&
            ((typeof response.data.data.error_code === 'string' &&
              response.data.data.error_code !== 'Success' &&
              response.data.data.error_code !== '') ||
              (response.data.data.status &&
                response.data.data.status.error_code &&
                response.data.data.status.error_code !== 'Success' &&
                response.data.data.status.error_code !== ''));

          if (isHttpError) {
            openSnackBar(response.data.message, 'warning');
            return Promise.reject(response.data);
          }

          if (isResStatusError) {
            const errorMessage =
              response.data.data.reason || response.data.data.status.detail;
            openSnackBar(errorMessage, 'error');
            return Promise.reject(errorMessage);
          }

          return response;
        },
        error => {
          const { response } = error;
          let messageType: 'error' | 'warning' = 'error';

          if (response) {
            switch (response.status) {
              case HTTP_STATUS_CODE.UNAUTHORIZED:
                setTimeout(() => logout(true), 1000);
                break;

              case HTTP_STATUS_CODE.FORBIDDEN:
                messageType = 'warning';
                break;
              default:
                break;
            }
            const errorMessage = response.data?.message;
            if (errorMessage) {
              openSnackBar(errorMessage, messageType);
              return Promise.reject(error);
            }
          }
          // 处理其他错误情况
          openSnackBar(error.message, messageType);
          return Promise.reject(error);
        }
      );
    }

    // 卸载时清理响应拦截器
    return () => {
      if (axiosResInterceptor !== null) {
        axiosInstance.interceptors.response.eject(axiosResInterceptor);
        axiosResInterceptor = null;
      }
    };
  }, [logout, openSnackBar]);

  return <>{children}</>;
};

export default GlobalEffect;
