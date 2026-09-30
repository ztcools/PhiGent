import { Box, Typography } from '@mui/material';
import {
  FC,
  useContext,
  useMemo,
  useState,
  ChangeEvent,
  useEffect,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import DialogTemplate from '@/components/customDialog/DialogTemplate';
import CustomInput from '@/components/customInput/CustomInput';
import { ITextfieldConfig } from '@/components/customInput/Types';
import { rootContext, dataContext } from '@/context';
import { useFormValidation } from '@/hooks';
import {
  formatForm,
  getAnalyzerParams,
  TypeEnum,
  parseCollectionJson,
} from '@/utils';
import {
  DataTypeEnum,
  ConsistencyLevelEnum,
  DEFAULT_ATTU_DIM,
  FunctionType,
} from '@/consts';
import CreateFields from './create/CreateFields';
import ExtraInfoSection from './create/ExtraInfoSection';
import BM25FunctionSection from './create/BM25FunctionSection';
import type {
  CollectionCreateParam,
  CollectionCreateProps,
  CreateField,
} from '../databases/collections/Types';
import { CollectionService } from '@/http';

// 该类型可以放在文件顶部或相应的 types 文件中
interface BM25Function {
  name: string;
  description: string;
  type: FunctionType;
  input_field_names: string[];
  output_field_names: string[];
  params: Record<string, any>;
}

const CreateCollectionDialog: FC<CollectionCreateProps> = ({ onCreate }) => {
  const { fetchCollection } = useContext(dataContext);
  const { handleCloseDialog, openSnackBar } = useContext(rootContext);
  const { t: collectionTrans } = useTranslation('collection');
  const { t: btnTrans } = useTranslation('btn');
  const { t: successTrans } = useTranslation('success');
  const { t: warningTrans } = useTranslation('warning');

  const [form, setForm] = useState<{
    collection_name: string;
    description: string;
    enableDynamicField: boolean;
    loadAfterCreate: boolean;
    functions: BM25Function[];
  }>({
    collection_name: '',
    description: '',
    enableDynamicField: false,
    loadAfterCreate: true,
    functions: [],
  });

  const [fieldsValidation, setFieldsValidation] = useState(true);

  // BM25 选择界面的 State
  const [showBm25Selection, setShowBm25Selection] = useState<boolean>(false);
  const [selectedBm25Input, setSelectedBm25Input] = useState<string>('');
  const [selectedBm25Output, setSelectedBm25Output] = useState<string>('');

  const [consistencyLevel, setConsistencyLevel] =
    useState<ConsistencyLevelEnum>(ConsistencyLevelEnum.Bounded); // Bounded 是一致性级别的默认值
  const [properties, setProperties] = useState({});

  const [fields, setFields] = useState<CreateField[]>([
    {
      data_type: DataTypeEnum.Int64,
      is_primary_key: true,
      name: 'id', // 首次需要隐藏 helperText，因此用 null 判断用户是否已输入
      description: '',
      isDefault: true,
      id: '1',
    },
    {
      data_type: DataTypeEnum.FloatVector,
      is_primary_key: false,
      name: 'vector',
      dim: DEFAULT_ATTU_DIM,
      description: '',
      isDefault: true,
      id: '2',
    },
  ]);

  const checkedForm = useMemo(() => {
    const { collection_name } = form;
    return formatForm({ collection_name });
  }, [form]);

  const { validation, checkIsValid, disabled, setDisabled } =
    useFormValidation(checkedForm);

  const updateCheckBox = (
    event: ChangeEvent<any>,
    key: string,
    value: boolean
  ) => {
    setForm({
      ...form,
      [key]: value,
    });
  };

  const handleInputChange = (key: string, value: string) => {
    setForm(v => ({ ...v, [key]: value }));
  };

  const generalInfoConfigs: ITextfieldConfig[] = [
    {
      label: collectionTrans('name'),
      key: 'collection_name',
      value: form.collection_name,
      onChange: (value: string) => handleInputChange('collection_name', value),
      variant: 'filled',
      validations: [
        // 不能为空
        {
          rule: 'require',
          errorText: warningTrans('requiredOnly'),
        },
        // 长度 <= 255
        {
          rule: 'range',
          extraParam: {
            max: 255,
            type: 'string',
          },
          errorText: collectionTrans('nameLengthWarning'),
        },
        // 名称只能由字母、数字或下划线组成
        {
          rule: 'collectionName',
          errorText: collectionTrans('nameContentWarning'),
        },
        // 名称不能以数字开头
        {
          rule: 'firstCharacter',
          extraParam: {
            invalidTypes: [TypeEnum.number],
          },
          errorText: collectionTrans('nameFirstLetterWarning'),
        },
      ],
      InputLabelProps: {
        shrink: true,
      },
      size: 'small',
      sx: {
        width: '100%',
      },
    },
    {
      label: collectionTrans('description'),
      key: 'description',
      value: form.description,
      onChange: (value: string) => handleInputChange('description', value),
      variant: 'filled',
      validations: [],
      size: 'small',
      InputLabelProps: {
        shrink: true,
      },
      sx: {
        width: '100%',
      },
    },
  ];

  const handleCreateCollection = async () => {
    const param: CollectionCreateParam = {
      ...form,
      fields: fields.map(v => {
        let data: CreateField = {
          ...v,
          name: v.name,
          description: v.description,
          is_primary_key: !!v.is_primary_key,
          is_partition_key: !!v.is_partition_key,
          data_type: v.data_type,
        };

        // 删除无用的 id
        delete data.id;

        // 按需处理
        if (typeof v.dim !== undefined && !isNaN(Number(v.dim))) {
          data.dim = Number(v.dim);
        }

        if (typeof v.max_length === 'number') {
          data.max_length = Number(v.max_length);
        }
        if (typeof v.element_type !== 'undefined') {
          data.element_type = Number(v.element_type);
        }
        if (typeof v.max_capacity !== 'undefined') {
          data.max_capacity = Number(v.max_capacity);
        }

        if (data.analyzer_params) {
          // analyzer_params 为字符串时需要转换为默认对象
          data.analyzer_params = getAnalyzerParams(data.analyzer_params);
        }

        // 删除稀疏向量的 dim
        if (data.data_type === DataTypeEnum.SparseFloatVector) {
          delete data.dim;
        }

        // 非 VarChar 类型时删除 analyzer 配置
        if (
          data.data_type !== DataTypeEnum.VarChar &&
          data.data_type === DataTypeEnum.Array &&
          data.element_type !== DataTypeEnum.VarChar
        ) {
          delete data.enable_analyzer;
          delete data.analyzer_params;
          delete data.max_length;
        }

        return data;
      }),
      functions: form.functions || [],
      consistency_level: consistencyLevel,
      properties: {
        ...properties,
      },
    };

    // 创建 Collection
    await CollectionService.createCollection({
      ...param,
    });

    // 刷新 Collection
    await fetchCollection(param.collection_name);

    // 提示成功信息
    openSnackBar(
      successTrans('create', {
        name: collectionTrans('collection'),
      })
    );

    onCreate && onCreate(param.collection_name);
    handleCloseDialog();
  };

  // 过滤出 BM25 选择器可用的 Field
  const varcharFields = useMemo(
    () => fields.filter(f => f.data_type === DataTypeEnum.VarChar && f.name),
    [fields]
  );
  const sparseFields = useMemo(
    () =>
      fields.filter(
        f => f.data_type === DataTypeEnum.SparseFloatVector && f.name
      ),
    [fields]
  );

  const handleAddBm25Click = () => {
    setShowBm25Selection(true);
  };

  const handleConfirmAddBm25 = () => {
    if (!selectedBm25Input || !selectedBm25Output) {
      openSnackBar(collectionTrans('bm25SelectFieldsWarning'), 'warning');
      return;
    }

    const inputField = fields.find(f => f.name === selectedBm25Input);
    const outputField = fields.find(f => f.name === selectedBm25Output);

    if (!inputField || !outputField) {
      // 正常情况下 State 管理正确时不会发生，但保留校验更稳妥
      console.error('Selected BM25 fields not found');
      return;
    }

    // 为 function 生成唯一名称
    const functionName = `BM25_${inputField.name}_${
      outputField.name
    }_${Math.floor(Math.random() * 1000)}`;

    // 使用选中的 Field 创建一个新 function
    const newFunction: BM25Function = {
      name: functionName,
      description: `BM25 function: ${inputField.name} → ${outputField.name}`,
      type: FunctionType.BM25,
      input_field_names: [inputField.name],
      output_field_names: [outputField.name],
      params: {}, // 如需默认参数可在此补充，例如 { k1: 1.2, b: 0.75 }
    };

    // 把新 function 写入 form
    setForm(prev => ({
      ...prev,
      functions: [...(prev.functions || []), newFunction],
    }));

    // 隐藏选择界面
    setShowBm25Selection(false);

    // 需要把 field.is_function_output 置为 true
    const updatedFields = fields.map(field => {
      if (field.name === outputField.name) {
        return {
          ...field,
          is_function_output: true,
        };
      }
      return field;
    });
    setFields(updatedFields);
  };

  const handleCancelAddBm25 = () => {
    setShowBm25Selection(false);
  };

  // Field 变化或选择界面关闭时重置已选项
  useEffect(() => {
    if (!showBm25Selection) {
      setSelectedBm25Input('');
      setSelectedBm25Output('');
    } else {
      // 打开选择界面时预选第一个可用 Field
      setSelectedBm25Input(varcharFields[0]?.name || '');
      setSelectedBm25Output(sparseFields[0]?.name || '');
    }
  }, [showBm25Selection, varcharFields, sparseFields]);

  // 过滤掉 Field 名已失效的 function
  useEffect(() => {
    setForm(prevForm => {
      const fieldNames = fields.map(f => f.name);
      const filteredFunctions = (prevForm.functions || []).filter(
        fn =>
          fn.input_field_names.every(name => fieldNames.includes(name)) &&
          fn.output_field_names.every(name => fieldNames.includes(name))
      );
      if (filteredFunctions.length !== (prevForm.functions || []).length) {
        return { ...prevForm, functions: filteredFunctions };
      }
      return prevForm;
    });
  }, [fields]);

  // 从 json 导入
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const json = JSON.parse(evt.target?.result as string);

        if (
          !json.collection_name ||
          !Array.isArray(json.schema?.fields) ||
          json.schema.fields.length === 0
        ) {
          openSnackBar('Invalid JSON file', 'error');
          return;
        }

        const {
          form: importedForm,
          fields: importedFields,
          consistencyLevel: importedConsistencyLevel,
          properties: importedProperties,
        } = parseCollectionJson(json);

        setFields(importedFields);
        setConsistencyLevel(importedConsistencyLevel);
        setForm(importedForm);
        setProperties(importedProperties);

        // 启用提交按钮
        setDisabled(false);

        openSnackBar('Import successful', 'success');
      } catch (err) {
        openSnackBar('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <DialogTemplate
      dialogClass="create-collection-dialog"
      title={collectionTrans('createTitle', { name: form.collection_name })}
      handleClose={() => {
        handleCloseDialog();
      }}
      leftActions={
        <>
          <button
            type="button"
            onClick={handleImportClick}
            style={{
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              color: '#1976d2',
            }}
          >
            {btnTrans('importFromJSON')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </>
      }
      confirmLabel={btnTrans('create')}
      handleConfirm={handleCreateCollection}
      confirmDisabled={disabled || !fieldsValidation}
      sx={{ width: 980 }}
    >
      <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
          {generalInfoConfigs.map(config => (
            <CustomInput
              key={config.key}
              type="text"
              textConfig={{ ...config }}
              checkValid={checkIsValid}
              validInfo={validation}
            />
          ))}
        </Box>

        <Box
          sx={{
            background: theme => theme.palette.background.lightGrey,
            padding: '16px',
            borderRadius: 0.5,
          }}
        >
          <CreateFields
            fields={fields}
            setFields={setFields}
            onValidationChange={setFieldsValidation}
          />
        </Box>

        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="h4" sx={{ fontSize: 16 }}>
            {collectionTrans('functions')}
          </Typography>
          <BM25FunctionSection
            showBm25Selection={showBm25Selection}
            varcharFields={varcharFields}
            sparseFields={sparseFields}
            selectedBm25Input={selectedBm25Input}
            selectedBm25Output={selectedBm25Output}
            setSelectedBm25Input={setSelectedBm25Input}
            setSelectedBm25Output={setSelectedBm25Output}
            handleAddBm25Click={handleAddBm25Click}
            handleConfirmAddBm25={handleConfirmAddBm25}
            handleCancelAddBm25={handleCancelAddBm25}
            formFunctions={form.functions}
            setForm={setForm}
            collectionTrans={collectionTrans}
            btnTrans={btnTrans}
          />
        </Box>

        <ExtraInfoSection
          consistencyLevel={consistencyLevel}
          setConsistencyLevel={setConsistencyLevel}
          form={form}
          updateCheckBox={updateCheckBox}
          collectionTrans={collectionTrans}
        />
      </Box>
    </DialogTemplate>
  );
};

export default CreateCollectionDialog;
