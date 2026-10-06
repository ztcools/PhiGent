import React, { useContext, useEffect, useMemo, useState } from 'react';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import { useTranslation } from 'react-i18next';
import CustomButton from '@/components/customButton/CustomButton';
import CustomInput from '@/components/customInput/CustomInput';
import { useFormValidation } from '@/hooks';
import { formatForm } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { rootContext, authContext, dataContext } from '@/context';
import {
  ATTU_AUTH_HISTORY,
  MILVUS_DATABASE,
  MILVUS_SERVERS,
  MILVUS_URL,
} from '@/consts';
import { CustomRadio } from '@/components/customRadio/CustomRadio';
import Icons from '@/components/icons/Icons';
import CustomToolTip from '@/components/customToolTip/CustomToolTip';
import CustomIconButton from '@/components/customButton/CustomIconButton';
import type { AuthReq } from '@server/types';
import FormControlLabel from '@mui/material/FormControlLabel';
import Box from '@mui/material/Box';
import type { Theme } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';

// 重新加回 Connection 的类型定义
type Connection = AuthReq & {
  time: number;
};

// 清理地址的工具函数，保留协议前缀
const cleanAddress = (address: string): string => {
  // 保留 http:// 或 https:// 前缀，仅去掉首尾空白
  return address.trim();
};

// 从环境变量解析服务器列表
const parseFixedConnections = (): Connection[] => {
  const serverList = MILVUS_SERVERS || '';
  const defaultUrl = MILVUS_URL || '127.0.0.1:19530';
  const defaultDatabase = MILVUS_DATABASE;

  // MILVUS_SERVERS 存在且非空时解析它
  if (serverList && serverList.trim() !== '') {
    return serverList.split(',').map((server: string) => {
      const [address, database] = server.trim().split('/');
      return {
        address: address.trim(),
        database: database?.trim() || defaultDatabase,
        token: '',
        username: '',
        password: '',
        ssl: false,
        checkHealth: true,
        time: -1,
        clientId: '',
      };
    });
  }

  // MILVUS_SERVERS 为空或不存在时，使用 MILVUS_URL
  return [
    {
      address: defaultUrl,
      database: defaultDatabase,
      token: '',
      username: '',
      password: '',
      ssl: false,
      checkHealth: true,
      time: -1,
      clientId: '',
    },
  ];
};

// 从环境变量获取固定连接
const FIXED_CONNECTIONS: Connection[] = parseFixedConnections();


const readAuthHistory = (): Connection[] => {
  try {
    const value = window.localStorage.getItem(ATTU_AUTH_HISTORY);
    return value ? JSON.parse(value) : [];
  } catch (e) {
    return [];
  }
};


export const AuthForm = () => {
  // Context
  const { openSnackBar } = useContext(rootContext);
  const { authReq, setAuthReq, login } = useContext(authContext);
  const { setDatabase } = useContext(dataContext);

  // i18n
  const { t: commonTrans } = useTranslation();
  const { t: btnTrans } = useTranslation('btn');
  const { t: successTrans } = useTranslation('success');
  const { t: dbTrans } = useTranslation('database');

  // Hooks
  const navigate = useNavigate();

  // UI 状态
  const [withPass, setWithPass] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  // 表单校验
  const checkedForm = useMemo(() => {
    return formatForm(authReq);
  }, [authReq]);
  const { validation, checkIsValid, resetValidation } =
    useFormValidation(checkedForm);

  // UI 事件处理
  // 处理输入变化
  const handleInputChange = (
    key:
      | 'address'
      | 'username'
      | 'password'
      | 'ssl'
      | 'database'
      | 'token'
      | 'checkHealth',
    value: string | boolean
  ) => {
    if (key === 'address' && typeof value === 'string') {
      // 清理地址，保留协议前缀
      const cleanedAddress = cleanAddress(value);

      // 检查地址中是否包含 Database 名（格式：address/database）
      // 处理带协议的 URL，如 http://127.0.0.1:19530/default
      if (
        cleanedAddress.includes('/') &&
        !cleanedAddress.startsWith('http://') &&
        !cleanedAddress.startsWith('https://')
      ) {
        // 不带协议的简单格式：address/database
        const parts = cleanedAddress.split('/');
        if (parts.length === 2) {
          setAuthReq(v => ({
            ...v,
            address: parts[0],
            database: parts[1],
          }));
          return;
        }
      } else if (
        cleanedAddress.includes('/') &&
        (cleanedAddress.startsWith('http://') ||
          cleanedAddress.startsWith('https://'))
      ) {
        // 带协议的 URL 格式：http://address:port/database 或 https://address:port/database
        const urlMatch = cleanedAddress.match(/^(https?:\/\/[^\/]+)\/(.+)$/);
        if (urlMatch) {
          setAuthReq(v => ({
            ...v,
            address: urlMatch[1],
            database: urlMatch[2],
          }));
          return;
        }
      }

      // 直接写入清理后的地址，不解析 Database
      setAuthReq(v => ({ ...v, address: cleanedAddress }));
      return;
    }
    setAuthReq(v => ({ ...v, [key]: value }));
  };

  // 处理认证开关
  const handleEnableAuth = (val: boolean) => {
    setWithPass(val);
  };

  // 处理连接
  const handleConnect = async (event: React.FormEvent) => {
    event.preventDefault();

    // 设置为连接中
    setIsConnecting(true);

    try {
      // 登录
      const loginParams = { ...authReq };

      if (!withPass) {
        loginParams.username = '';
        loginParams.password = '';
        loginParams.token = '';
      }
      await login(loginParams);

      // 设置 Database
      setDatabase(authReq.database);
      // 成功提示
      openSnackBar(successTrans('connect'));

      // 获取连接历史
      const history = readAuthHistory();

      // 把新连接写入历史，并过滤掉相同的连接
      const newHistory = [
        ...history.filter(
          (item: any) =>
            item.address !== authReq.address ||
            item.database !== authReq.database
        ),
        {
          address: authReq.address,
          database: authReq.database,
          username: authReq.username,
          password: authReq.password,
          token: authReq.token,
          time: Date.now(),
          checkHealth: authReq.checkHealth,
        },
      ];

      // 历史连接超过 16 条时移除最早的一条，但要保留默认连接
      if (newHistory.length > 16) {
        newHistory.shift();
      }

      // 保存到 localStorage
      window.localStorage.setItem(
        ATTU_AUTH_HISTORY,
        JSON.stringify(newHistory)
      );

      // 设置标题
      document.title = authReq.address ? `${authReq.address} - PhiGent` : 'PhiGent';

      // 跳转到首页
      navigate('/');
    } catch (error: any) {
      // 未授权时显示认证输入项
      if (error.response.data.message.includes('UNAUTHENTICATED')) {
        handleEnableAuth(true);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // 点击了历史连接
  const handleClickOnHisotry = (connection: Connection) => {
    // 设置认证请求
    setAuthReq(connection);
  };

  const handleDeleteConnection = (connection: Connection) => {
    // 不允许删除固定连接
    if (
      FIXED_CONNECTIONS.some(
        fixed =>
          fixed.address === connection.address &&
          fixed.database === connection.database
      )
    ) {
      return;
    }

    const history = readAuthHistory();

    const newHistory = history.filter(
      item =>
        item.address !== connection.address ||
        item.database !== connection.database
    );

    // 保存到 localStorage
    window.localStorage.setItem(ATTU_AUTH_HISTORY, JSON.stringify(newHistory));

    // 先放入固定连接
    const allConnections = [...FIXED_CONNECTIONS];

    // 追加历史连接，过滤掉与固定连接重复的项
    const uniqueHistoryConnections = newHistory.filter(
      historyConn =>
        !FIXED_CONNECTIONS.some(
          fixedConn =>
            fixedConn.address === historyConn.address &&
            fixedConn.database === historyConn.database
        )
    );
    allConnections.push(...uniqueHistoryConnections);

    // 按时间排序
    allConnections.sort((a, b) => {
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    });

    // 更新连接列表
    setConnections(allConnections);
  };

  // 清空全部历史的处理函数
  const handleClearAllHistory = () => {
    // 清空全部历史，只保留空数组
    window.localStorage.setItem(ATTU_AUTH_HISTORY, JSON.stringify([]));
    // 连接列表只保留固定连接
    setConnections([...FIXED_CONNECTIONS]);
    // 把表单重置为默认值
    setAuthReq(FIXED_CONNECTIONS[0]);
  };

  // 按钮是否应禁用
  const btnDisabled = authReq.address.trim().length === 0 || isConnecting;

  // 从 localStorage 加载连接
  useEffect(() => {
    const historyConnections: Connection[] = readAuthHistory();

    // 先放入固定连接
    const allConnections = [...FIXED_CONNECTIONS];

    // 追加历史连接，过滤掉与固定连接重复的项
    const uniqueHistoryConnections = historyConnections.filter(
      historyConn =>
        !FIXED_CONNECTIONS.some(
          fixedConn =>
            fixedConn.address === historyConn.address &&
            fixedConn.database === historyConn.database
        )
    );
    allConnections.push(...uniqueHistoryConnections);

    // 按时间排序
    allConnections.sort((a, b) => {
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    });

    setConnections(allConnections);
  }, []);

  // UI 副作用
  useEffect(() => {
    // 地址包含 zilliz，或用户名/密码非空时
    //  把 withPass 置为 true
    const withPass =
      (authReq.address.length > 0 && authReq.address.includes('zilliz')) ||
      authReq.username.length > 0 ||
      authReq.password.length > 0;

    // 设置是否带认证
    setWithPass(withPass);
    // 重置表单
    resetValidation(formatForm(authReq));
  }, [authReq.address, authReq.username, authReq.password]);

  return (
    <form onSubmit={handleConnect}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          padding: (theme: Theme) => theme.spacing(0, 3),
          position: 'relative',
          height: '100%',
        }}
      >
        <Box
          sx={{
            textAlign: 'left',
            alignSelf: 'flex-start',
            padding: (theme: Theme) => theme.spacing(2, 0, 1.5),
            '& svg': {
              fontSize: 16,
              marginLeft: (theme: Theme) => theme.spacing(0.5),
              color: 'primary.main',
            },
          }}
        >
          <Typography
            variant="h4"
            component="h4"
            sx={{
              fontSize: 20,
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            {commonTrans('attu.connectTitle')}
            <CustomToolTip title={commonTrans('attu.connectionTip')}>
              <Icons.info />
            </CustomToolTip>
          </Typography>
        </Box>

        {(authReq.address.toLowerCase().includes('127.0.0.1') ||
          authReq.address.toLowerCase().includes('localhost')) && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                padding: (theme: Theme) => theme.spacing(1, 2),
                marginBottom: (theme: Theme) => theme.spacing(2),
                backgroundColor: (theme: Theme) => theme.palette.warning.light,
                borderRadius: 1,
                '& svg': {
                  color: (theme: Theme) => theme.palette.warning.main,
                  fontSize: 20,
                  marginTop: 0.5,
                },
              }}
            >
              <Icons.error />
              <Typography
                sx={{
                  fontSize: 13,
                  color: (theme: Theme) => theme.palette.warning.dark,
                  lineHeight: 1.5,
                }}
              >
                {commonTrans('attu.dockerWarning')}
              </Typography>
            </Box>
          )}

        {/* 用 Autocomplete 替换地址输入框 */}
        <Autocomplete
          freeSolo={true}
          options={connections}
          getOptionLabel={option =>
            typeof option === 'string'
              ? option
              : `${option.address}/${option.database}`
          }
          value={connections.find(c => c.address === authReq.address) || null}
          onChange={(event, newValue) => {
            if (newValue) {
              if (typeof newValue === 'string') {
                // 处理自由文本输入
                const cleanedValue = cleanAddress(newValue);

                // 处理带协议的 URL，如 http://127.0.0.1:19530/default
                if (
                  cleanedValue.includes('/') &&
                  !cleanedValue.startsWith('http://') &&
                  !cleanedValue.startsWith('https://')
                ) {
                  // 不带协议的简单格式：address/database
                  const [address, database] = cleanedValue.split('/');
                  setAuthReq(v => ({
                    ...v,
                    address: address.trim(),
                    database: database?.trim() || MILVUS_DATABASE,
                  }));
                } else if (
                  cleanedValue.includes('/') &&
                  (cleanedValue.startsWith('http://') ||
                    cleanedValue.startsWith('https://'))
                ) {
                  // 带协议的 URL 格式：http://address:port/database 或 https://address:port/database
                  const urlMatch = cleanedValue.match(
                    /^(https?:\/\/[^\/]+)\/(.+)$/
                  );
                  if (urlMatch) {
                    setAuthReq(v => ({
                      ...v,
                      address: urlMatch[1],
                      database: urlMatch[2],
                    }));
                  } else {
                    setAuthReq(v => ({
                      ...v,
                      address: cleanedValue,
                      database: MILVUS_DATABASE,
                    }));
                  }
                } else {
                  setAuthReq(v => ({
                    ...v,
                    address: cleanedValue,
                    database: MILVUS_DATABASE,
                  }));
                }
              } else {
                handleClickOnHisotry(newValue);
              }
            }
          }}
          onInputChange={(event, newInputValue) => {
            // 仅在输入匹配到有效连接时更新
            const matchingConnection = connections.find(
              c =>
                `${c.address}/${c.database}`.toLowerCase() ===
                newInputValue.toLowerCase()
            );
            if (matchingConnection) {
              handleClickOnHisotry(matchingConnection);
            } else if (newInputValue) {
              // 处理自由文本输入
              const cleanedValue = cleanAddress(newInputValue);

              // 处理带协议的 URL，如 http://127.0.0.1:19530/default
              if (
                cleanedValue.includes('/') &&
                !cleanedValue.startsWith('http://') &&
                !cleanedValue.startsWith('https://')
              ) {
                // 不带协议的简单格式：address/database
                const [address, database] = cleanedValue.split('/');
                setAuthReq(v => ({
                  ...v,
                  address: address.trim(),
                  database: database?.trim() || MILVUS_DATABASE,
                }));
              } else if (
                cleanedValue.includes('/') &&
                (cleanedValue.startsWith('http://') ||
                  cleanedValue.startsWith('https://'))
              ) {
                // 带协议的 URL 格式：http://address:port/database 或 https://address:port/database
                const urlMatch = cleanedValue.match(
                  /^(https?:\/\/[^\/]+)\/(.+)$/
                );
                if (urlMatch) {
                  setAuthReq(v => ({
                    ...v,
                    address: urlMatch[1],
                    database: urlMatch[2],
                  }));
                } else {
                  setAuthReq(v => ({
                    ...v,
                    address: cleanedValue,
                    database: MILVUS_DATABASE,
                  }));
                }
              } else {
                setAuthReq(v => ({
                  ...v,
                  address: cleanedValue,
                  database: MILVUS_DATABASE,
                }));
              }
            }
          }}
          filterOptions={(options, state) => {
            // 只有存在输入文本时才过滤
            if (!state.inputValue) {
              return options;
            }
            return options.filter(option =>
              `${option.address}/${option.database}`
                .toLowerCase()
                .includes(state.inputValue.toLowerCase())
            );
          }}
          renderInput={params => (
            <TextField
              {...params}
              label={commonTrans('attu.address')}
              variant="filled"
              required
              error={validation.address?.result}
              helperText={validation.address?.errText}
              sx={{
                margin: (theme: Theme) => theme.spacing(0.5, 0),
                '& .MuiFilledInput-root': {
                  backgroundColor: 'background.default',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                  '&.Mui-focused': {
                    backgroundColor: 'background.default',
                  },
                },
              }}
            />
          )}
          ListboxProps={{
            sx: {
              '& .MuiAutocomplete-listbox': {
                padding: 0,
                '& li': {
                  padding: (theme: Theme) => theme.spacing(1.5, 2),
                  '&:not(:last-child)': {
                    borderBottom: (theme: Theme) =>
                      `1px solid ${theme.palette.divider}`,
                  },
                },
              },
            },
          }}
          renderOption={(props, option, { index }) => {
            // 从 props 中取出 key
            const { key, ...otherProps } = props;

            const isLastOption = index === connections.length - 1;
            const hasMultipleConnections = connections.length > 1;

            return (
              <React.Fragment key={`${option.address}-${option.database}`}>
                {/* 普通连接选项 */}
                <Box
                  component="li"
                  {...otherProps}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    padding: (theme: Theme) => theme.spacing(1.5, 2),
                    '&:hover': {
                      backgroundColor: (theme: Theme) =>
                        theme.palette.action.hover,
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <Icons.link sx={{ fontSize: 16, flexShrink: 0, mt: 0.5 }} />
                    <Typography
                      sx={{
                        wordBreak: 'break-all',
                        lineHeight: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      {option.address}/{option.database}
                      {(option.username || option.password || option.token) && (
                        <Icons.key
                          sx={{
                            fontSize: 14,
                            color: 'text.secondary',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </Typography>
                  </Box>
                  {option.time !== -1 &&
                    !FIXED_CONNECTIONS.some(
                      fixed =>
                        fixed.address === option.address &&
                        fixed.database === option.database
                    ) && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          minWidth: 200,
                          justifyContent: 'flex-end',
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: 11,
                            color: 'text.secondary',
                            fontStyle: 'italic',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {new Date(option.time).toLocaleString()}
                        </Typography>
                        <CustomIconButton
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteConnection(option);
                          }}
                          sx={{
                            padding: '4px',
                            marginLeft: 1,
                          }}
                        >
                          <Icons.cross sx={{ fontSize: 14 }} />
                        </CustomIconButton>
                      </Box>
                    )}
                </Box>

                {/* 在最后一个连接后追加清空历史的选项 */}
                {isLastOption && hasMultipleConnections && (
                  <Box
                    component="li"
                    onClick={handleClearAllHistory}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      fontSize: '12px',
                      borderTop: (theme: Theme) =>
                        `1px solid ${theme.palette.divider}`,
                      color: 'error.main',
                      cursor: 'pointer',
                      padding: (theme: Theme) => theme.spacing(1),
                      marginTop: (theme: Theme) => theme.spacing(1),
                      backgroundColor: (theme: Theme) =>
                        theme.palette.background.default,
                      '&:hover': {
                        backgroundColor: (theme: Theme) =>
                          theme.palette.action.hover,
                      },
                    }}
                  >
                    <Icons.delete sx={{ fontSize: 14 }} />
                    <Typography sx={{ fontWeight: 500 }}>
                      {commonTrans('attu.clearHistory')}
                    </Typography>
                  </Box>
                )}
              </React.Fragment>
            );
          }}
        />

        {/* db  */}
        <CustomInput
          type="text"
          textConfig={{
            label: `Milvus ${dbTrans('database')} ${commonTrans('attu.optional')}`,
            key: 'database',
            onChange: (value: string) => handleInputChange('database', value),
            variant: 'filled',
            sx: {
              margin: (theme: Theme) => theme.spacing(0.5, 0),
              '& .MuiFilledInput-root': {
                backgroundColor: 'background.default',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
                '&.Mui-focused': {
                  backgroundColor: 'background.default',
                },
              },
            },
            placeholder: dbTrans('database'),
            fullWidth: true,
            value: authReq.database,
          }}
          checkValid={checkIsValid}
          validInfo={validation}
          key={commonTrans('attu.database')}
        />

        {/* 认证开关 */}
        <Box
          sx={{
            display: 'flex',
            width: '100%',
            justifyContent: 'flex-start',
            marginTop: (theme: Theme) => theme.spacing(1),
          }}
        >
          <CustomRadio
            checked={withPass}
            label={commonTrans('attu.authentication')}
            handleChange={handleEnableAuth}
          />
        </Box>

        {/* token  */}
        {withPass && (
          <>
            <CustomInput
              type="text"
              textConfig={{
                label: `${commonTrans('attu.token')} ${commonTrans('attu.optional')} `,
                key: 'token',
                onChange: (val: string) => handleInputChange('token', val),
                variant: 'filled',
                sx: {
                  margin: (theme: Theme) => theme.spacing(0.5, 0),
                  '& .MuiFilledInput-root': {
                    backgroundColor: 'background.default',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'background.default',
                    },
                  },
                },
                placeholder: commonTrans('attu.token'),
                fullWidth: true,
                value: authReq.token,
              }}
              checkValid={checkIsValid}
              validInfo={validation}
              key={commonTrans('attu.token')}
            />
            {/* user  */}
            <CustomInput
              type="text"
              textConfig={{
                label: `${commonTrans('attu.username')} ${commonTrans('attu.optional')}`,
                key: 'username',
                onChange: (value: string) =>
                  handleInputChange('username', value),
                variant: 'filled',
                sx: {
                  margin: (theme: Theme) => theme.spacing(0.5, 0),
                  '& .MuiFilledInput-root': {
                    backgroundColor: 'background.default',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'background.default',
                    },
                  },
                },
                placeholder: commonTrans('attu.username'),
                fullWidth: true,
                value: authReq.username,
              }}
              checkValid={checkIsValid}
              validInfo={validation}
              key={commonTrans('attu.username')}
            />
            {/* pass  */}
            <CustomInput
              type="text"
              textConfig={{
                label: `${commonTrans('attu.password')} ${commonTrans('attu.optional')}`,
                key: 'password',
                onChange: (value: string) =>
                  handleInputChange('password', value),
                variant: 'filled',
                sx: {
                  margin: (theme: Theme) => theme.spacing(0.5, 0),
                  '& .MuiFilledInput-root': {
                    backgroundColor: 'background.default',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'background.default',
                    },
                  },
                },
                placeholder: commonTrans('attu.password'),
                fullWidth: true,
                type: 'password',
                value: authReq.password,
              }}
              checkValid={checkIsValid}
              validInfo={validation}
              key={commonTrans('attu.password')}
            />
          </>
        )}

        <Box
          sx={{
            marginTop: 'auto',
            padding: (theme: Theme) => theme.spacing(2, 0),
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: (theme: Theme) => theme.spacing(2),
            }}
          >
            <CustomButton
              type="submit"
              variant="contained"
              disabled={btnDisabled}
              sx={{
                height: 36,
                fontSize: 14,
                fontWeight: 500,
                flex: 1,
              }}
            >
              {btnTrans(isConnecting ? 'connecting' : 'connect')}
            </CustomButton>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: (theme: Theme) => theme.spacing(1),
                borderLeft: (theme: Theme) =>
                  `1px solid ${theme.palette.divider}`,
                paddingLeft: (theme: Theme) => theme.spacing(2),
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={authReq?.ssl ?? false}
                    onChange={e => handleInputChange('ssl', e.target.checked)}
                    sx={{
                      padding: '4px',
                      '&.Mui-checked': {
                        color: 'primary.main',
                      },
                    }}
                  />
                }
                label={
                  <Typography
                    sx={{
                      fontSize: 13,
                      color: 'text.secondary',
                    }}
                  >
                    {commonTrans('attu.ssl')}
                  </Typography>
                }
              />

              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={authReq?.checkHealth ?? true}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      handleInputChange('checkHealth', e.target.checked);
                    }}
                    sx={{
                      padding: '4px',
                      '&.Mui-checked': {
                        color: 'primary.main',
                      },
                    }}
                  />
                }
                label={
                  <Typography
                    sx={{
                      fontSize: 13,
                      color: 'text.secondary',
                    }}
                  >
                    {commonTrans('attu.checkHealth')}
                  </Typography>
                }
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </form>
  );
};
