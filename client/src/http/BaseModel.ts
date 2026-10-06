import http from './Axios';
import { AxiosRequestConfig } from 'axios';

type RequestParams = {
  method?: 'get' | 'post' | 'put' | 'delete' | string;
  path: string;
  params?: Record<string, any>;
  data?: any;
  timeout?: number;
  config?: AxiosRequestConfig;
};

export default class BaseModel {
  static async get<T>(options: RequestParams): Promise<T> {
    const { path, params = {}, config } = options;
    const response = await http.get(path, { params, ...config });
    return response.data?.data as T;
  }

  static async post<T>(options: RequestParams): Promise<T> {
    const { path, data = {}, config } = options;
    const response = await http.post(path, data, config);
    return response.data?.data as T;
  }

  static async put<T>(options: RequestParams): Promise<T> {
    const { path, data = {}, config } = options;
    const response = await http.put(path, data, config);
    return response.data?.data as T;
  }

  static async delete<T>(options: RequestParams): Promise<T> {
    const { path, params = {}, config } = options;
    const response = await http.delete(path, {
      data: params,
      ...config,
    });
    return response.data?.data as T;
  }

  /**
   * 兼容旧 service 层的读取方法。新增代码请直接使用 get/post/put/delete。
   */
  static async find<T>(options: RequestParams): Promise<T> {
    const { method = 'get' } = options;
    return method.toLowerCase() === 'get'
      ? this.get<T>(options)
      : this.post<T>({ ...options, data: options.params });
  }

  /** 兼容旧 create 命名。 */
  static async create<T>(options: RequestParams): Promise<T> {
    return this.post<T>(options);
  }

  /** 兼容旧 update 命名。 */
  static async update<T>(options: RequestParams): Promise<T> {
    return this.put<T>(options);
  }

  /** 兼容旧 query 命名。 */
  static async query<T>(options: RequestParams): Promise<T> {
    return this.post<T>(options);
  }
}