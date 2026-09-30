import { FC, useContext } from 'react';
import { Checkbox, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import CustomSelector from '@/components/customSelector/CustomSelector';
import CustomIconButton from '@/components/customButton/CustomIconButton';
import icons from '@/components/icons/Icons';
import { ANALYZER_OPTIONS } from './Constants';
import { getAnalyzerParams } from '@/utils';
import { rootContext } from '@/context';
import EditJSONDialog from '@/pages/dialogs/EditJSONDialog';
import { FieldType } from '../../databases/collections/Types';
import { SxProps, Theme } from '@mui/material';

interface AnalyzerCheckboxFieldProps {
  field: FieldType;
  onChange: (id: string, changes: Partial<FieldType>) => void;
  localFieldAnalyzers: React.MutableRefObject<Map<string, Record<string, {}>>>;
  sx?: SxProps<Theme>;
}

const AnalyzerCheckboxField: FC<AnalyzerCheckboxFieldProps> = ({
  field,
  onChange,
  localFieldAnalyzers,
  sx,
}) => {
  const { setDialog2, handleCloseDialog2 } = useContext(rootContext);
  const { t: collectionTrans } = useTranslation('collection');
  const { t: dialogTrans } = useTranslation('dialog');

  // 判断当前选中的 analyzer 类型
  let analyzer = 'standard';
  if (typeof field.analyzer_params === 'string') {
    analyzer = field.analyzer_params;
  } else if (!field.analyzer_params) {
    analyzer = 'standard';
  } else {
    analyzer = 'custom';
  }

  const localAnalyzer = localFieldAnalyzers.current.get(field.id!) || {
    tokenizer: 'standard',
    filter: ['lowercase'],
  };

  const handleCheckboxChange = () => {
    const isAnalyzerEnabled = !field.enable_analyzer;
    onChange(field.id!, {
      enable_analyzer: isAnalyzerEnabled,
      analyzer_params: isAnalyzerEnabled ? 'standard' : undefined,
    });
  };

  const handleAnalyzerChange = (selectedAnalyzer: string) => {
    if (selectedAnalyzer === 'custom') {
      // 若为自定义，将 analyzer_params 设为可编辑的 JSON 格式
      onChange(field.id!, {
        analyzer_params: localAnalyzer,
      });
    } else {
      // 若为标准、中文或英文，将 analyzer_params 设为选中的类型
      onChange(field.id!, {
        analyzer_params: selectedAnalyzer,
      });
    }
  };

  const handleSettingsClick = () => {
    setDialog2({
      open: true,
      type: 'custom',
      params: {
        component: (
          <EditJSONDialog
            data={getAnalyzerParams(field.analyzer_params || 'standard')}
            dialogTitle={dialogTrans('editAnalyzerTitle')}
            dialogTip={dialogTrans('editAnalyzerInfo')}
            handleConfirm={data => {
              localFieldAnalyzers.current.set(field.id!, data);
              onChange(field.id!, { analyzer_params: data });
            }}
            handleCloseDialog={handleCloseDialog2}
          />
        ),
      },
    });
  };

  return (
    <Box
      sx={{
        paddingTop: 1, // 8px
        '& .select': {
          width: '110px',
        },
        ...sx,
      }}
    >
      <Checkbox
        checked={!!field.enable_analyzer}
        size="small"
        onChange={handleCheckboxChange}
        disabled={false}
        style={{ padding: '8px' }}
      />
      <CustomSelector
        wrapperClass="select"
        options={ANALYZER_OPTIONS}
        size="small"
        onChange={e => handleAnalyzerChange(e.target.value as string)}
        disabled={!field.enable_analyzer}
        value={analyzer}
        variant="filled"
        label={collectionTrans('analyzer')}
      />
      <CustomIconButton
        disabled={!field.enable_analyzer}
        onClick={handleSettingsClick}
      >
        <icons.settings sx={{ fontSize: '14px', marginLeft: '4px' }} />
      </CustomIconButton>
    </Box>
  );
};

export default AnalyzerCheckboxField;
