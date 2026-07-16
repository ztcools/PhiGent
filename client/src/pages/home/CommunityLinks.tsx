import { Box, Typography, Link } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { MILVUS_DOCS, ATTU_SOURCE_CODE } from '@/consts/link';
import Icons from '@/components/icons/Icons';

const CommunityLinks = () => {
  const { t } = useTranslation();

  const links = [
    {
      title: 'PhiGent',
      url: ATTU_SOURCE_CODE,
      icon: <Icons.github sx={{ fontSize: 20 }} />,
    },
    {
      title: t('attu.docs'),
      url: MILVUS_DOCS,
      icon: <Icons.file sx={{ fontSize: 20 }} />,
    },
  ];

  return (
    <Box
      sx={{
        width: 270,
        backgroundColor: 'background.paper',
        borderRadius: 1,
        p: 1.5,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography
        variant="h6"
        sx={{
          mb: 1.5,
          fontSize: 16,
          fontWeight: 600,
          color: 'text.primary',
        }}
      >
        {t('attu.community')}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {links.map(link => (
          <Link
            key={link.title}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: 'text.primary',
              textDecoration: 'none',
              '&:hover': {
                color: 'primary.main',
                '& .MuiSvgIcon-root': {
                  color: 'primary.main',
                },
              },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 1,
                backgroundColor: 'action.hover',
                color: 'text.secondary',
              }}
            >
              {link.icon}
            </Box>
            <Typography
              sx={{
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {link.title}
            </Typography>
          </Link>
        ))}
      </Box>
    </Box>
  );
};

export default CommunityLinks;
