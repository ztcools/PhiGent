import { FC, useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DialogTemplate from '@/components/customDialog/DialogTemplate';
import CustomInput from '@/components/customInput/CustomInput';
import { useFormValidation } from '@/hooks';
import { formatForm } from '@/utils';
import { UserService, DatabaseService } from '@/http';
import DBCollectionSelector from './DBCollectionSelector';
import type { ITextfieldConfig } from '@/components/customInput/Types';
import type { CreateRoleProps, CreateRoleParams, DBOption } from '../Types';
import type { DBCollectionsPrivileges, RBACOptions } from '@server/types';

const DEFAULT_DB_Privileges: DBCollectionsPrivileges = {
  '*': {
    collections: {
      '*': {},
    },
  },
};

const UpdateRoleDialog: FC<CreateRoleProps> = props => {
  const {
    role = {
      roleName: '',
      privileges: DEFAULT_DB_Privileges,
    },
    handleClose,
    onUpdate,
    sameAs,
  } = props;
  // 国际化
  const { t: userTrans } = useTranslation('user');
  const { t: btnTrans } = useTranslation('btn');
  const { t: warningTrans } = useTranslation('warning');

  // 常量
  const ALL_DB = { name: userTrans('allDatabases'), value: '*' };

  // UI 状态
  const [options, setOptions] = useState<{
    rbacOptions: RBACOptions; // 可用的 RBAC 选项（权限）
    dbOptions: DBOption[]; // 可用的 Database
  }>({
    rbacOptions: {} as RBACOptions,
    dbOptions: [],
  });

  const [selected, setSelected] = useState<DBCollectionsPrivileges>(
    role.privileges
  );

  // 表单状态
  const [form, setForm] = useState<CreateRoleParams>({
    roleName: role.roleName,
    privileges: selected,
  });

  // selected 变化时更新表单
  useEffect(() => {
    setForm(v => ({
      ...v,
      privileges: selected,
    }));
  }, [selected]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dbResponse, rbacResponse] = await Promise.all([
          DatabaseService.listDatabases(),
          UserService.getRBAC(),
        ]);

        const dbOptions = dbResponse.map(db => ({
          name: db.name,
          value: db.name,
        }));
        dbOptions.unshift(ALL_DB);

        setOptions({
          rbacOptions: rbacResponse,
          dbOptions,
        });
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };

    fetchData();
  }, []);

  // 检查是否为编辑已有角色
  const isEditing = role.roleName !== '' && !sameAs;

  // 表单校验
  const checkedForm = useMemo(() => {
    return formatForm(form);
  }, [form]);
  const { validation, checkIsValid, disabled } = useFormValidation(checkedForm);

  // 处理输入变化
  const handleInputChange = (key: 'roleName', value: string) => {
    setForm(v => ({
      ...v,
      [key]: value,
    }));
  };

  // 处理创建/更新角色
  const handleCreateRole = async () => {
    try {
      const res = await UserService.updateRolePrivileges(form);

      onUpdate({ data: form, isEditing });
    } catch (error) {
      console.error('Error creating/updating role:', error);
    }
  };

  // 输入框配置
  const inputSx = { mt: 1, mb: 0.5 };
  const createConfigs: ITextfieldConfig[] = [
    {
      label: userTrans('role'),
      key: 'roleName',
      onChange: (value: string) => handleInputChange('roleName', value),
      variant: 'filled',
      sx: inputSx,
      placeholder: userTrans('role'),
      fullWidth: true,
      validations: [
        {
          rule: 'require',
          errorText: warningTrans('required', {
            name: userTrans('role'),
          }),
        },
      ],
      defaultValue: form.roleName,
      disabled: isEditing,
    },
  ];

  return (
    <DialogTemplate
      title={userTrans(
        isEditing
          ? 'updateRolePrivilegeTitle'
          : sameAs
            ? 'dupicateRoleTitle'
            : 'createRoleTitle'
      )}
      handleClose={handleClose}
      confirmLabel={btnTrans(isEditing ? 'update' : 'create')}
      handleConfirm={handleCreateRole}
      confirmDisabled={disabled}
      sx={{ width: '66vw', maxWidth: '66vw' }}
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

        <DBCollectionSelector
          selected={selected}
          setSelected={setSelected}
          options={options}
        />
      </>
    </DialogTemplate>
  );
};

export default UpdateRoleDialog;
