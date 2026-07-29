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
        borderRadius: 2,
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
      }}
    >
      <Typography
        variant="h6"
        sx={{
          mb: 1.5,
          fontSize: 15,
          fontWeight: 600,
          color: 'text.primary',
        }}
      >
        {t('attu.community')}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
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
              px: 1,
              py: 0.75,
              borderRadius: 1,
              color: 'text.primary',
              textDecoration: 'none',
              transition: 'all 0.15s ease-in-out',
              '&:hover': {
                color: 'primary.main',
                backgroundColor: 'action.hover',
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
