import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DialogTemplate from '@/components/customDialog/DialogTemplate';
import { Option } from '@/components/customSelector/Types';
import {
  INDEX_OPTIONS_MAP,
  METRIC_TYPES_VALUES,
  INDEX_TYPES_ENUM,
  DataTypeEnum,
  DataTypeStringEnum,
} from '@/consts';
import { useFormValidation } from '@/hooks';
import {
  formatForm,
  getMetricOptions,
  getScalarIndexOption,
  isVectorType,
  formatFieldType,
} from '@/utils';
import CreateForm from './CreateForm';
import type { IndexType, IndexExtraParam } from './Types';
import type { FieldObject } from '@server/types';
import { INDEX_PARAMS_CONFIG } from './indexParamsConfig';

/**
 * CreateIndex 组件，用于创建新的 index
 * 负责 index 类型选择、参数配置和校验
 */
const CreateIndex = (props: {
  collectionName: string;
  field: FieldObject;
  handleCreate: (params: IndexExtraParam, index_name: string) => void;
  handleCancel: () => void;
}) => {
  const { handleCreate, handleCancel, field } = props;

  const { t: indexTrans } = useTranslation('index');
  const { t: dialogTrans } = useTranslation('dialog');
  const { t: btnTrans } = useTranslation('btn');

  /**
   * 把 Field 数据类型转换为 DataTypeEnum
   * 用于确定可选的 index 类型和参数
   */
  const getFieldType = (): DataTypeEnum => {
    switch (field.data_type) {
      case DataTypeStringEnum.BinaryVector:
        return DataTypeEnum.BinaryVector;
      case DataTypeStringEnum.FloatVector:
      case DataTypeStringEnum.Float16Vector:
      case DataTypeStringEnum.BFloat16Vector:
        return DataTypeEnum.FloatVector;
      case DataTypeStringEnum.SparseFloatVector:
        return DataTypeEnum.SparseFloatVector;
      default:
        return DataTypeEnum.FloatVector;
    }
  };

  const defaultIndexType = INDEX_TYPES_ENUM.AUTOINDEX;

  /**
   * 根据 Field 数据类型获取默认 metric type
   * 不同 Vector 类型的默认 metric type 不同
   */
  const defaultMetricType = useMemo(() => {
    switch (field.data_type) {
      case DataTypeStringEnum.BinaryVector:
        return METRIC_TYPES_VALUES.HAMMING;
      case DataTypeStringEnum.FloatVector:
      case DataTypeStringEnum.Float16Vector:
      case DataTypeStringEnum.BFloat16Vector:
        return METRIC_TYPES_VALUES.COSINE;
      case DataTypeStringEnum.SparseFloatVector:
        return field.is_function_output
          ? METRIC_TYPES_VALUES.BM25
          : METRIC_TYPES_VALUES.IP;
      default:
        return '';
    }
  }, [field.data_type]);

  // index 创建的表单状态
  const [indexSetting, setIndexSetting] = useState<{
    index_type: IndexType;
    [x: string]: string | number | boolean;
  }>({
    index_name: '',
    index_type: defaultIndexType,
    metric_type: defaultMetricType,
  });

  /**
   * 获取所选 index 类型的必填和选填参数
   * 参数定义在 INDEX_PARAMS_CONFIG 中
   */
  const indexCreateParams = useMemo(() => {
    const fieldType = getFieldType();
    const config = INDEX_PARAMS_CONFIG[fieldType]?.[indexSetting.index_type];
    if (!config) return [];
    return [...config.required, ...config.optional];
  }, [indexSetting.index_type]);

  /**
   * 获取所选 index 类型可用的 metric type
   * 不同 index 类型支持的 metric type 不同
   */
  const metricOptions = useMemo(() => {
    return isVectorType(field)
      ? getMetricOptions(indexSetting.index_type, field)
      : [];
  }, [indexSetting.index_type, field]);

  /**
   * 准备创建 index 所需的参数
   * 汇总 index 类型、metric type 以及其他参数
   */
  const extraParams = useMemo(() => {
    const params: { [x: string]: string | number | boolean } = {};
    indexCreateParams.forEach(v => {
      params[v] = indexSetting[v];
    });

    const { index_type, metric_type } = indexSetting;

    return {
      index_type,
      metric_type: String(metric_type),
      params: JSON.stringify(params),
    };
  }, [indexCreateParams, indexSetting]);

  /**
   * 格式化 selector 所需 index 选项的辅助函数
   * 按类别分组（内存、磁盘、GPU）
   */
  const getOptions = (label: string, children: Option[]) => ({
    label,
    children: children.map(child => ({
      ...child,
      key: `${label}-${child.value}`,
    })),
  });

  /**
   * 根据 Field 类型获取可用的 index 类型
   * 不同 Field 类型可用的 index 类型不同
   */
  const indexOptions = useMemo(() => {
    const autoOption = getOptions('AUTOINDEX', INDEX_OPTIONS_MAP['AUTOINDEX']);
    let options = [];

    if (isVectorType(field)) {
      switch (field.data_type) {
        case DataTypeStringEnum.BinaryVector:
          options = [
            getOptions(
              indexTrans('inMemory'),
              INDEX_OPTIONS_MAP[DataTypeEnum.BinaryVector]
            ),
          ];
          break;

        case DataTypeStringEnum.SparseFloatVector:
          options = [
            getOptions(
              indexTrans('inMemory'),
              INDEX_OPTIONS_MAP[DataTypeEnum.SparseFloatVector]
            ),
          ];
          break;

        default:
          options = [
            getOptions(
              indexTrans('inMemory'),
              INDEX_OPTIONS_MAP[DataTypeEnum.FloatVector].filter(
                option =>
                  option.value !== INDEX_TYPES_ENUM.DISKANN &&
                  option.value !== INDEX_TYPES_ENUM.GPU_CAGRA &&
                  option.value !== INDEX_TYPES_ENUM.GPU_IVF_FLAT &&
                  option.value !== INDEX_TYPES_ENUM.GPU_IVF_PQ
              )
            ),
            getOptions(
              indexTrans('disk'),
              INDEX_OPTIONS_MAP[DataTypeEnum.FloatVector].filter(
                option => option.value === INDEX_TYPES_ENUM.DISKANN
              )
            ),
            getOptions(
              indexTrans('gpu'),
              INDEX_OPTIONS_MAP[DataTypeEnum.FloatVector].filter(
                option =>
                  option.value === INDEX_TYPES_ENUM.GPU_CAGRA ||
                  option.value === INDEX_TYPES_ENUM.GPU_IVF_FLAT ||
                  option.value === INDEX_TYPES_ENUM.GPU_IVF_PQ
              )
            ),
          ];
          break;
      }
    } else {
      options = [getOptions(indexTrans('scalar'), getScalarIndexOption(field))];
    }

    return [autoOption, ...options];
  }, [field, indexTrans]);

  /**
   * 整理用于校验的表单数据
   * 汇总 metric type 和 index 参数
   */
  const checkedForm = useMemo(() => {
    if (!isVectorType(field)) {
      return [];
    }
    const paramsForm: any = { metric_type: indexSetting.metric_type };
    indexCreateParams.forEach(v => {
      paramsForm[v] = indexSetting[v];
    });
    return formatForm(paramsForm);
  }, [indexSetting, indexCreateParams, field]);

  const { validation, checkIsValid, resetValidation } =
    useFormValidation(checkedForm);

  /**
   * 检查表单是否有效
   * 校验必填参数及其取值
   */
  const isFormValid = useMemo(() => {
    const fieldType = getFieldType();
    const config = INDEX_PARAMS_CONFIG[fieldType]?.[indexSetting.index_type];
    if (!config) return true;

    const hasAllRequiredParams = config.required.every(param => {
      const value = indexSetting[param];
      return value !== undefined && value !== '';
    });

    const validationErrors = Object.entries(validation || {}).filter(
      ([key, error]) => {
        if (!config.required.includes(key) && !indexSetting[key]) {
          return false;
        }
        return (
          error &&
          typeof error === 'object' &&
          'errText' in error &&
          error.errText
        );
      }
    );

    return hasAllRequiredParams && validationErrors.length === 0;
  }, [indexSetting, validation]);

  /**
   * 更新表单字段值
   */
  const updateForm = (type: string, value: string | number | boolean) => {
    setIndexSetting(v => ({ ...v, [type]: value }));
  };

  /**
   * 处理 index 类型变化
   * index 类型变化时重置参数，并按配置设置默认值
   */
  const onIndexTypeChange = (type: string) => {
    const fieldType = getFieldType();
    const config = INDEX_PARAMS_CONFIG[fieldType]?.[type];
    if (!config) return;

    // 创建带默认值的新表单状态
    const newIndexSetting: {
      index_type: IndexType;
      [key: string]: string | number | boolean;
    } = {
      ...indexSetting,
      index_type: type as IndexType,
    };

    // 从配置中为所有参数设置默认值
    Object.entries(config.params).forEach(([key, paramConfig]) => {
      if (paramConfig.defaultValue !== undefined) {
        newIndexSetting[key] = paramConfig.defaultValue.toString();
      } else {
        newIndexSetting[key] = '';
      }
    });

    // 更新表单状态
    setIndexSetting(newIndexSetting);

    // 用新值重置校验
    const paramsForm: { [key: string]: string | number | boolean } = {};
    [...config.required, ...config.optional].forEach(param => {
      paramsForm[param] = newIndexSetting[param];
    });

    resetValidation(formatForm(paramsForm));
  };

  /**
   * 处理 index 创建
   */
  const handleCreateIndex = async () => {
    await handleCreate(extraParams, indexSetting.index_name as string);
  };

  return (
    <DialogTemplate
      title={dialogTrans('createTitle', {
        type: indexTrans('index'),
        name: `${field.name} - ${formatFieldType(field)}`,
      })}
      handleClose={handleCancel}
      confirmLabel={btnTrans('create')}
      handleConfirm={handleCreateIndex}
      confirmDisabled={!isFormValid}
    >
      <CreateForm
        updateForm={updateForm}
        metricOptions={metricOptions}
        indexOptions={indexOptions}
        formValue={indexSetting}
        checkIsValid={checkIsValid}
        validation={validation}
        indexParams={indexCreateParams}
        indexTypeChange={onIndexTypeChange}
        wrapperClass="index-form"
        fieldType={getFieldType()}
      />
    </DialogTemplate>
  );
};

export default CreateIndex;
