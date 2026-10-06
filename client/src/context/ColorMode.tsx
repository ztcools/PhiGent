import React, { useState, useEffect } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import { createTheme, ThemeOptions } from '@mui/material/styles';
import { ThemeProvider } from '@mui/material/styles';
import getCommonThemes from '../styles/theme';

export const ColorModeContext = React.createContext({
  toggleColorMode: () => {},
  mode: 'light',
});
import { ATTU_THEME_MODE } from '@/consts';

const { Provider } = ColorModeContext;

type theme = 'light' | 'dark';

export const ColorModeProvider = (props: { children: React.ReactNode }) => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const systemTheme = prefersDarkMode ? 'dark' : 'light';

  const [mode, setMode] = useState<theme>(() => {
    try {
      return (localStorage.getItem(ATTU_THEME_MODE) as theme) || systemTheme;
    } catch (e) {
      return systemTheme;
    }
  });

  const theme = React.useMemo(
    () => createTheme(getCommonThemes(mode) as ThemeOptions),
    [mode]
  );

  const toggleColorMode = () => {
    setMode(prevMode => (prevMode === 'light' ? 'dark' : 'light'));
  };

  // 将当前 mode 存入 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(ATTU_THEME_MODE, mode);
    } catch (e) {
      // 忽略隐私模式等场景下 localStorage 写入失败。
    }
  }, [mode]);

  return (
    <Provider value={{ toggleColorMode, mode }}>
      <ThemeProvider theme={theme}>{props.children}</ThemeProvider>
    </Provider>
  );
};
