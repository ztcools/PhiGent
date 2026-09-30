import { FC, useMemo, useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import DialogTemplate from '@/components/customDialog/DialogTemplate';
import CustomInput from '@/components/customInput/CustomInput';
import { ITextfieldConfig } from '@/components/customInput/Types';
import { useFormValidation } from '@/hooks';
import { formatForm } from '@/utils';
import { CreateDatabaseParams } from '@/http';
import { dataContext, rootContext } from '@/context';
import { DatabaseService } from '@/http';

export interface CreateDatabaseProps {
  onCreate?: () => void;
}

const CreateDatabaseDialog: FC<CreateDatabaseProps> = ({ onCreate }) => {
  // Context
  const { fetchDatabases } = useContext(dataContext);
  const { openSnackBar, handleCloseDialog } = useContext(rootContext);

  // 国际化
  const { t: databaseTrans } = useTranslation('database');
  const { t: btnTrans } = useTranslation('btn');
  const { t: warningTrans } = useTranslation('warning');
  const { t: successTrans } = useTranslation('success');
  const { t: dbTrans } = useTranslation('database');

  // UI 状态
  const [form, setForm] = useState<CreateDatabaseParams>({
    db_name: '',
  });
  const [loading, setLoading] = useState(false);

  // 校验
  const checkedForm = useMemo(() => {
    return formatForm(form);
  }, [form]);
  const { validation, checkIsValid, disabled } = useFormValidation(checkedForm);

  const handleInputChange = (key: 'db_name', value: string) => {
    setForm(v => ({ ...v, [key]: value }));
  };

  const createConfigs: ITextfieldConfig[] = [
    {
      label: databaseTrans('database'),
      key: 'db_name',
      onChange: (value: string) => handleInputChange('db_name', value),
      variant: 'filled',
      sx: { margin: theme => theme.spacing(3, 0, 0.5) },
      placeholder: databaseTrans('database'),
      fullWidth: true,
      validations: [
        {
          rule: 'require',
          errorText: warningTrans('required', {
            name: databaseTrans('databaseName'),
          }),
        },
      ],
      defaultValue: form.db_name,
    },
  ];

  const handleCreate = async () => {
    setLoading(true);
    // 创建 Database
    await DatabaseService.createDatabase(form).finally(() => {
      setLoading(false);
    });
    // 刷新 Database 列表
    await fetchDatabases();

    openSnackBar(successTrans('create', { name: dbTrans('database') }));

    handleCloseDialog();

    if (onCreate) {
      onCreate();
    }

    setLoading(false);
  };

  const handleClose = () => {
    handleCloseDialog();
  };

  return (
    <DialogTemplate
      title={databaseTrans('createTitle')}
      handleClose={handleClose}
      confirmLabel={btnTrans('create')}
      handleConfirm={handleCreate}
      confirmDisabled={disabled || loading}
    >
      <>
        {createConfigs.map(v => (
          <CustomInput
            type="text"
            textConfig={v}
            checkValid={checkIsValid}
            validInfo={validation}
            key={v.label}
          />
        ))}
      </>
    </DialogTemplate>
  );
};

export default CreateDatabaseDialog;
