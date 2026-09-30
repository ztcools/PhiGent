import React from 'react';
import { useTheme } from '@mui/material/styles';

interface HighlightTextProps {
  text: string;
  highlight: string;
}

const HighlightText: React.FC<HighlightTextProps> = ({ text, highlight }) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  if (!highlight.trim()) {
    return <>{text}</>;
  }
  // 转义搜索词中的正则元字符 —— 否则形如 "a(b" 或 "c++" 的查询
  // 会让 `new RegExp` 抛错并导致树渲染崩溃。
  const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span
            key={i}
            style={{
              backgroundColor: isLight
                ? theme.palette.highlight.light
                : theme.palette.highlight.dark,
              borderRadius: '2px',
              padding: '0 2px',
            }}
          >
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
};

export default HighlightText;
