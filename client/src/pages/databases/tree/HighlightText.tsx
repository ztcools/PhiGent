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
  // Escape regex metacharacters in the search term — a query like "a(b" or
  // "c++" would otherwise make `new RegExp` throw and crash the tree render.
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
