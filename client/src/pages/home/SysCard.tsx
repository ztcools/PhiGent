import { Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import CardBase from '@/components/cards/CardBase';

const SysCard = (data: {
  title: string;
  count: number | string;
  des?: string;
  link?: string;
}) => {
  const inner = (
    <>
      <Typography
        component="p"
        sx={{
          fontSize: 24,
          m: 0,
          fontWeight: 600,
          color: theme => theme.palette.text.primary,
        }}
      >
        {data.count}
      </Typography>
      <Typography
        component="h3"
        sx={theme => ({
          m: 0,
          fontSize: 13,
          lineHeight: 1.5,
          color: theme.palette.text.secondary,
        })}
      >
        {data.title}
      </Typography>
      {data.des ? (
        <Typography component="p" sx={{ fontSize: 13, m: 0 }}>
          {data.des}
        </Typography>
      ) : null}
    </>
  );

  return (
    <CardBase
      minWidth={140}
      minHeight={88}
      sx={{
        '& a': {
          textDecoration: 'none',
          color: 'inherit',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        },
      }}
    >
      {data.link ? (
        <Link to={data.link} style={{ textDecoration: 'none' }}>
          {inner}
        </Link>
      ) : (
        inner
      )}
    </CardBase>
  );
};

export default SysCard;
