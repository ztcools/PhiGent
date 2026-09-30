import { FC } from 'react';
import { Theme, useTheme, styled } from '@mui/material';
import type { MiniTopoProps } from './Types';

const StyledSvg = styled('svg')(({ theme }: { theme: Theme }) => ({}));

const StyledG = styled('g')(({ theme }: { theme: Theme }) => ({
  transition: 'all .25s',
  cursor: 'pointer',
  transformOrigin: '50% 50%',
  transformBox: 'fill-box',

  '& circle': {
    transition: 'all .25s',
  },

  '& text': {
    transition: 'all .25s',
  },

  '&:hover, &:focus': {
    transform: 'scale(1.1)',
    filter: 'drop-shadow(3px 3px 5px rgba(0, 0, 0, .2))',
  },

  '&:focus': {
    outline: 'none',

    '& svg path': {
      fill: theme.palette.background.paper,
    },

    '& circle': {
      fill: theme.palette.primary.main,
      stroke: theme.palette.primary.main,
    },

    '& text': {
      fill: theme.palette.background.paper,
    },
  },
}));

const capitalize = (s: string) => {
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const MiniTopo: FC<MiniTopoProps> = props => {
  const theme = useTheme();
  const { selectedCord, selectedChildNode, setCord, setShowChildView } = props;

  const WIDTH = 300; // svg 宽度
  const HEIGHT = 300; // svg 高度
  const LINE = 80; // lv2 节点的连线长度
  const ANGLE = 10; // lv2 节点的角度偏移
  const R1 = 45; // 根节点半径
  const R2 = 30; // lv1 节点半径
  const W3 = 20; // 子矩形宽度

  const childNodeCenterX = WIDTH / 2 + LINE * Math.cos((ANGLE * Math.PI) / 180);
  const childNodeCenterY =
    HEIGHT / 2 + LINE * Math.sin((ANGLE * Math.PI) / 180);

  return (
    <StyledSvg
      theme={theme}
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100%" height="100%" fill={theme.palette.background.paper} />
      <line
        x1={`${WIDTH / 3}`}
        y1={`${HEIGHT / 3}`}
        x2={childNodeCenterX}
        y2={childNodeCenterY}
        stroke={theme.palette.primary.main}
      />
      <StyledG
        theme={theme}
        onClick={() => {
          setShowChildView(false);
        }}
      >
        <circle
          cx={`${WIDTH / 3}`}
          cy={`${HEIGHT / 3}`}
          r={R1}
          fill={theme.palette.background.paper}
          stroke={theme.palette.primary.main}
        />
        <text
          alignmentBaseline="middle"
          textAnchor="middle"
          fill={theme.palette.primary.main}
          fontWeight="700"
          fontSize="12"
          x={`${WIDTH / 3}`}
          y={`${HEIGHT / 3}`}
        >
          {selectedCord ? capitalize(selectedCord.infos?.name) : ''}
        </text>
      </StyledG>
      <g>
        <svg
          width="60"
          height="60"
          viewBox="0 0 60 60"
          x={childNodeCenterX - 30}
          y={childNodeCenterY - 30}
        >
          <circle
            cx={R2}
            cy={R2}
            r={R2}
            fill={theme.palette.background.paper}
            stroke={theme.palette.primary.main}
          />
          <rect
            className="selected"
            x={R2 - W3 / 2}
            y={R2 - W3 / 2}
            width={W3}
            height={W3}
            fill={theme.palette.primary.main}
          />
        </svg>
        <text
          textAnchor="middle"
          fill={theme.palette.text.primary}
          fontSize="12"
          x={childNodeCenterX}
          y={childNodeCenterY + 50}
        >{`${selectedChildNode ? selectedChildNode.infos?.name : ''}`}</text>
      </g>
    </StyledSvg>
  );
};

export default MiniTopo;
