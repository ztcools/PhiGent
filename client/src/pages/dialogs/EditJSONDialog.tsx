import { FC, useState } from 'react';
import { Box, TextField, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import DialogTemplate from '@/components/customDialog/DialogTemplate';


type EditJSONDialogProps = {
  data: { [key: string]: any };
  handleConfirm: (data: { [key: string]: any }) => void;
  handleCloseDialog: () => void;
  dialogTitle: string;
  dialogTip: string;
  cb?: () => void;
};

const EditJSONDialog: FC<EditJSONDialogProps> = props => {
  // 属性
  const { data, handleCloseDialog, handleConfirm } = props;
  // UI 状态
  const [disabled, setDisabled] = useState(true);
  // 翻译函数
  const { t: btnTrans } = useTranslation('btn');
  // 主题
  const theme = useTheme();

  const originalData = JSON.stringify(data, null, 2) + '\n';
  const [value, setValue] = useState(originalData);

  // 处理确认
  const _handleConfirm = async () => {
    handleConfirm(JSON.parse(value));
    handleCloseDialog();
  };

  const handleChange = (docValue: string) => {
    try {
      setValue(docValue);
      // 校验 JSON 解析是否合法
      JSON.parse(docValue);
      setDisabled(docValue === originalData);
    } catch (err) {
      setDisabled(true);
    }
  };

  return (
    <DialogTemplate
      title={props.dialogTitle}
      handleClose={handleCloseDialog}
      children={
        <>
          <Box
            sx={{
              fontSize: 12,
              marginBottom: 1, // theme.spacing(1)
              width: 480,
              lineHeight: '20px',
            }}
            dangerouslySetInnerHTML={{
              __html: props.dialogTip,
            }}
          ></Box>
          <Box
            sx={{
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1, // theme.shape.borderRadius
              overflow: 'auto',
            }}
          >
            <TextField
              value={value}
              onChange={event => handleChange(event.target.value)}
              multiline
              minRows={12}
              maxRows={24}
              fullWidth
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: {
                  alignItems: 'flex-start',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 12,
                  lineHeight: '20px',
                  padding: 1.5,
                },
              }}
            />
          </Box>
        </>
      }
      confirmDisabled={disabled}
      confirmLabel={btnTrans('edit')}
      handleConfirm={_handleConfirm}
      showCancel={true}
    />
  );
};

export default EditJSONDialog;
