import http from './Axios';
import { Method, AxiosRequestConfig } from 'axios';

type RequestParams = {
  method?: Method;
  path: string;
  params?: Record<string, any>;
  data?: any;
  timeout?: number;
  config?: AxiosRequestConfig;
};

export default class BaseModel {
  /**
   * 获取多条数据
   */
  static async find<T>(options: RequestParams): Promise<T> {
    const { method = 'get', path, params = {}, config } = options;
    const requestConfig: AxiosRequestConfig = {
      method,
      url: path,
      ...config,
    };

    if (method.toLowerCase() === 'get') {
      requestConfig.params = params;
    } else {
      requestConfig.data = params;
    }

    const response = await http(requestConfig);
    return response.data?.data as T;
  }


  /**
   * 创建新资源
   */
  static async create<T>(options: RequestParams): Promise<T> {
    const { path, data = {}, config } = options;
    const response = await http.post(path, data, config);
    return response.data?.data as T;
  }

  /**
   * 更新已有资源
   */
  static async update<T>(options: RequestParams): Promise<T> {
    const { path, data = {}, config } = options;
    const response = await http.put(path, data, config);
    return response.data?.data as T;
  }

  /**
   * 删除资源
   */
  static async delete<T>(options: RequestParams): Promise<T> {
    const { path, params = {}, config } = options;
    const response = await http.delete(path, { 
      data: params,
      ...config 
    });
    return response.data?.data as T;
  }

  /**
   * 自定义查询
   */
  static async query<T>(options: RequestParams): Promise<T> {
    return this.find<T>({
      ...options,
      params: options.data,
      method: 'post',
    });
  }
}