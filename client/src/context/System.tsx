import { createContext, useEffect, useState, useContext } from 'react';
import { UserService, MilvusService } from '@/http';
import { parseJson, getNode, getSystemConfigs } from '@/utils';
import { MILVUS_NODE_TYPE } from '@/consts';
import { authContext } from '@/context';
import type { SystemContextType } from './Types';

export const systemContext = createContext<SystemContextType>({
  data: {},
});

const { Provider } = systemContext;
export const SystemProvider = (props: { children: React.ReactNode }) => {
  const { isAuth, isServerless } = useContext(authContext);

  const [data, setData] = useState<any>({});

  const fetchData = async () => {
    try {
      // 获取全部数据
      const [metrics, users, roles] = await Promise.all([
        MilvusService.getMetrics(),
        !isServerless ? UserService.getUsers() : { usernames: [] },
        !isServerless ? UserService.getRoles() : { results: [] },
      ]);

      // 解析数据
      const parsedJson = parseJson(metrics);

      // 获取 query 节点
      const queryNodes = getNode(
        parsedJson.allNodes,
        MILVUS_NODE_TYPE.QUERYNODE
      );

      // 获取 data 节点
      const dataNodes = getNode(parsedJson.allNodes, MILVUS_NODE_TYPE.DATANODE);

      // 获取 data 节点
      const indexNodes = getNode(
        parsedJson.allNodes,
        MILVUS_NODE_TYPE.INDEXNODE
      );

      // 获取 root coord
      const rootCoord = getNode(
        parsedJson.allNodes,
        MILVUS_NODE_TYPE.ROOTCOORD
      )[0];

      // 获取系统配置
      const systemConfig = getSystemConfigs(parsedJson.workingNodes);
      const deployMode = rootCoord.infos.system_info?.deploy_mode;
      const systemInfo = rootCoord.infos.system_info;

      const data = {
        users: users,
        roles: roles,
        queryNodes,
        dataNodes,
        indexNodes,
        rootCoord,
        deployMode,
        parsedJson,
        systemConfig,
        systemInfo,
      };

      // 保存其余数据
      setData(data);
    } catch (error) {
      // 不做处理
      console.log('fetch data error', error);
    }
  };

  useEffect(() => {
    if (isAuth) {
      fetchData();
    } else {
      setData({});
    }
  }, [isAuth]);

  return (
    <Provider
      value={{
        data,
      }}
    >
      {props.children}
    </Provider>
  );
};
