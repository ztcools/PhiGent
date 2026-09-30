import { Box, IconButton, Typography } from '@mui/material';
import { FC, Fragment, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import icons from '@/components/icons/Icons';
import { generateId, getCreateFieldType } from '@/utils';
import { DataTypeEnum, VectorTypes } from '@/consts';
import { DEFAULT_ATTU_DIM, DEFAULT_ATTU_VARCHAR_MAX_LENGTH } from '@/consts';
import type {
  CreateFieldsProps,
  CreateFieldType,
  FieldType,
} from '../../databases/collections/Types';
import PrimaryKeyFieldRow from './rows/PrimaryKeyFieldRow';
import ScalarFieldRow from './rows/ScalarFieldRow';
import VectorFieldRow from './rows/VectorFieldRow';

const CreateFields: FC<CreateFieldsProps> = ({
  fields,
  setFields,
  onValidationChange,
}) => {
  // 国际化
  const { t: collectionTrans } = useTranslation('collection');

  // UI 状态
  const localFieldAnalyzers = useRef(
    new Map<string, Record<string, {}>>(new Map())
  );

  const localFieldsValidation = useRef<Map<string, boolean>>(
    new Map(
      fields
        .filter(field => field.id !== undefined)
        .map(field => [field.id!, field.name !== ''])
    )
  );

  // 添加此辅助函数
  const updateValidationStatus = useCallback(() => {
    const areFieldsValid = Array.from(
      localFieldsValidation.current.values()
    ).every(v => v);
    onValidationChange(areFieldsValid);
  }, [onValidationChange]);

  // UI 图标
  const AddIcon = icons.addOutline;

  // 计算必填字段与 Scalar 字段
  const { requiredFields, scalarFields } = useMemo(
    () =>
      fields.reduce(
        (acc, field) => {
          const createType: CreateFieldType = getCreateFieldType(field);
          const requiredTypes: CreateFieldType[] = [
            'primaryKey',
            'defaultVector',
            'vector',
          ];
          const key = requiredTypes.includes(createType)
            ? 'requiredFields'
            : 'scalarFields';

          acc[key].push({
            ...field,
            createType,
          });

          return acc;
        },
        {
          requiredFields: [] as FieldType[],
          scalarFields: [] as FieldType[],
        }
      ),

    [fields]
  );

  // UI 事件处理
  const changeFields = (
    id: string,
    changes: Partial<FieldType>,
    isValid?: boolean
  ) => {
    const newFields = fields.map(f => {
      if (f.id !== id) {
        return f;
      }

      const updatedField = {
        ...f,
        ...changes,
      };

      // 非数组类型时移除数组参数
      if (updatedField.data_type !== DataTypeEnum.Array) {
        delete updatedField.max_capacity;
        delete updatedField.element_type;
      }

      // 非 VarChar 类型时移除 varchar 参数
      if (
        updatedField.data_type !== DataTypeEnum.VarChar &&
        updatedField.element_type !== DataTypeEnum.VarChar
      ) {
        delete updatedField.max_length;
      }

      // 非 Vector 类型时移除维度
      if (
        !VectorTypes.includes(updatedField.data_type) ||
        updatedField.data_type === DataTypeEnum.SparseFloatVector
      ) {
        delete updatedField.dim;
      } else {
        // 维度不存在时补充维度
        updatedField.dim = Number(updatedField.dim || DEFAULT_ATTU_DIM);
      }

      return updatedField;
    });

    setFields(newFields);

    // 在引用中更新校验状态
    if (isValid !== undefined) {
      localFieldsValidation.current.set(id, isValid);
    } else {
      localFieldsValidation.current.delete(id);
    }

    updateValidationStatus();
  };

  const handleAddNewField = (index: number, type = DataTypeEnum.Int16) => {
    const id = generateId();

    // 确定字段类型并生成对应的名称前缀
    const isVector = VectorTypes.includes(type);
    const isPrimaryKey = false; // 新字段默认永远不是 Primary Key
    
    let fieldTypePrefix: string;
    if (isPrimaryKey) {
      fieldTypePrefix = 'primary_key';
    } else if (isVector) {
      fieldTypePrefix = 'vector';
    } else {
      fieldTypePrefix = 'scalar';
    }

    // 统计同类型已有字段数量以生成新索引
    let fieldCount = fields.filter(f => {
      if (isPrimaryKey) {
        return f.is_primary_key;
      } else if (isVector) {
        return VectorTypes.includes(f.data_type);
      } else {
        return !f.is_primary_key && !VectorTypes.includes(f.data_type);
      }
    }).length;
    
    let name = `${fieldTypePrefix}_${fieldCount}`;

    const existingNames = new Set(fields.map(f => f.name));
    while (existingNames.has(name)) {
      fieldCount += 1;
      name = `${fieldTypePrefix}_${fieldCount}`;
    }

    const newDefaultItem: FieldType = {
      id,
      name,
      data_type: type,
      is_primary_key: false,
      description: '',
      isDefault: false,
      dim: DEFAULT_ATTU_DIM,
      max_length: DEFAULT_ATTU_VARCHAR_MAX_LENGTH,
      enable_analyzer: false,
    };

    fields.splice(index + 1, 0, newDefaultItem);
    setFields([...fields]);

    // 向引用中添加校验状态
    localFieldsValidation.current.set(id, true);
    updateValidationStatus();
  };

  const handleRemoveField = (id: string) => {
    const newFields = fields.filter(f => f.id !== id);
    setFields(newFields);

    // 从引用中移除校验状态
    localFieldsValidation.current.delete(id);
    updateValidationStatus();
  };

  const generateRequiredFieldRow = (
    field: FieldType,
    index: number,
    fields: FieldType[],
    requiredFields: FieldType[]
  ) => {
    // 必填类型为 primaryKey 或 defaultVector
    if (field.createType === 'primaryKey') {
      return (
        <PrimaryKeyFieldRow
          field={field}
          fields={fields}
          onFieldChange={changeFields}
        />
      );
    }

    if (field.createType === 'defaultVector') {
      return (
        <VectorFieldRow
          field={field}
          fields={fields}
          index={index}
          requiredFields={requiredFields}
          onFieldChange={changeFields}
          onAddField={handleAddNewField}
          onRemoveField={handleRemoveField}
          showDeleteButton={true}
        />
      );
    }

    // 生成其他 Vector 行
    return (
      <VectorFieldRow
        field={field}
        fields={fields}
        index={index}
        requiredFields={requiredFields}
        onFieldChange={changeFields}
        onAddField={handleAddNewField}
        onRemoveField={handleRemoveField}
        showDeleteButton={true}
      />
    );
  };

  return (
    <Box>
      <Typography
        variant="h4"
        sx={{
          fontSize: 14,
          mb: 1.5,
        }}
      >
        {`${collectionTrans('idAndVectorFields')}(${requiredFields.length})`}
      </Typography>

      {requiredFields.map((field, index) => (
        <Fragment key={field.id}>
          {generateRequiredFieldRow(field, index, fields, requiredFields)}
        </Fragment>
      ))}

      <Typography
        variant="h4"
        sx={{
          fontSize: 14,
          mt: 2,
          mb: 1.5,
          '& button': {
            position: 'relative',
            top: '-1px',
            ml: 0.5,
          },
        }}
      >
        {`${collectionTrans('scalarFields')}(${scalarFields.length})`}
        <IconButton
          onClick={() => {
            handleAddNewField(requiredFields.length + 1);
          }}
          sx={{
            p: 0,
            position: 'relative',
            top: '-8px',
            '& svg': {
              width: 15,
            },
          }}
          aria-label="add"
          size="large"
        >
          <AddIcon />
        </IconButton>
      </Typography>

      <Box>
        {scalarFields.map((field, index) => (
          <ScalarFieldRow
            key={field.id}
            field={field}
            index={index + requiredFields.length}
            fields={fields}
            onFieldChange={changeFields}
            onAddField={handleAddNewField}
            onRemoveField={handleRemoveField}
            localFieldAnalyzers={localFieldAnalyzers}
          />
        ))}
      </Box>
    </Box>
  );
};

export default CreateFields;
