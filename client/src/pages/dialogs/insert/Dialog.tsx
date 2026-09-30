import {
  FC,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { parse } from 'papaparse';
import { useTranslation } from 'react-i18next';
import DialogTemplate from '@/components/customDialog/DialogTemplate';
import icons from '@/components/icons/Icons';
import { PartitionService } from '@/http';
import { rootContext } from '@/context';
import { combineHeadsAndData, convertVectorFields } from '@/utils';
import { FILE_MIME_TYPE } from '@/consts';
import InsertImport from './Import';
import InsertPreview from './Preview';
import InsertStatus from './Status';
import { InsertStatusEnum, InsertStepperEnum } from './consts';
import { DataService } from '@/http';
import type { InsertContentProps } from './Types';
import type { Option } from '@/components/customSelector/Types';
import type { InsertDataParam } from '@/pages/databases/collections/Types';

/**
 * 该组件包含插入过程中的各个步骤
 * 包括导入、预览和状态
 */

const InsertContainer: FC<InsertContentProps> = ({
  collections = [],
  defaultSelectedCollection,
  defaultSelectedPartition,

  partitions,
  schema,
  onInsert,
}) => {
  const { t: insertTrans } = useTranslation('insert');
  const { t: btnTrans } = useTranslation('btn');
  const { handleCloseDialog, openSnackBar } = useContext(rootContext);
  const [activeStep, setActiveStep] = useState<InsertStepperEnum>(
    InsertStepperEnum.import
  );
  const [insertStatus, setInsertStatus] = useState<InsertStatusEnum>(
    InsertStatusEnum.init
  );
  const [insertFailMsg, setInsertFailMsg] = useState<string>('');
  const [importingCount, setImportingCount] = useState<number>(0);

  const [nextDisabled, setNextDisabled] = useState<boolean>(false);

  // 选中的 Collection 名
  const [collectionValue, setCollectionValue] = useState<string>(
    defaultSelectedCollection
  );
  // 选中的 Partition 名
  const [partitionValue, setPartitionValue] = useState<string>(
    defaultSelectedPartition
  );
  // 默认视作包含 Field 名
  const [isContainFieldNames, setIsContainFieldNames] = useState<number>(1);
  // 上传的文件名
  const [fileName, setFileName] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);

  // 上传的 CSV 数据（类型为 string）
  const [csvData, setCsvData] = useState<any[]>([]);
  const [jsonData, setJsonData] = useState<
    Record<string, unknown> | undefined
  >();

  // 处理变化的表头
  const [tableHeads, setTableHeads] = useState<string[]>([]);

  const [partitionOptions, setPartitionOptions] = useState<Option[]>([]);

  const previewData = useMemo(() => {
    // 只展示上传 CSV 数据的前 4 条
    const end = isContainFieldNames ? 5 : 4;
    return csvData.slice(0, end);
  }, [csvData, isContainFieldNames]);

  useEffect(() => {
    if (activeStep === InsertStepperEnum.import) {
      /**
       * 1. 必须选择 Collection 和 Partition
       * 2. 必须上传 CSV 文件
       */
      const selectValid = collectionValue !== '' && partitionValue !== '';
      const uploadValid = csvData.length > 0 || typeof jsonData !== 'undefined';
      const condition = selectValid && uploadValid;
      setNextDisabled(!condition);
    }
    if (activeStep === InsertStepperEnum.preview) {
      /**
       * 表头不应为空
       */
      const headsValid = tableHeads.every(h => h !== '');
      setNextDisabled(!headsValid);
    }
  }, [
    activeStep,
    collectionValue,
    partitionValue,
    csvData,
    tableHeads,
    jsonData,
  ]);

  useEffect(() => {
    const heads = isContainFieldNames
      ? previewData[0]
      : new Array(previewData[0].length).fill('');

    setTableHeads(heads);
  }, [previewData, isContainFieldNames]);

  // 每次所选 Collection 变化时，Partition 选项和默认值都会变化
  const fetchPartition = useCallback(async () => {
    if (collectionValue) {
      const partitions = await PartitionService.getPartitions(collectionValue);
      const partitionOptions: Option[] = partitions.map(p => ({
        label: p.name === '_default' ? insertTrans('defaultPartition') : p.name,
        value: p.name,
      }));
      setPartitionOptions(partitionOptions);

      if (partitionOptions.length > 0) {
        // 把第一个 Partition 选项的值设为默认值
        const [{ value: defaultPartitionValue }] = partitionOptions;
        setPartitionValue(defaultPartitionValue as string);
      }
    }
  }, [collectionValue]);

  useEffect(() => {
    // 不在 Partition 页面时，需要按所选 Collection 拉取 Partition
    if (!partitions || partitions.length === 0) {
      fetchPartition();
    } else {
      const options = partitions
        .map(p => ({
          label: p.name,
          value: p.name,
        }))
        // 已选中单个 Partition 时
        // 插入弹窗中的 Partition 不应可选择
        .filter(
          partition =>
            partition.label === defaultSelectedPartition ||
            defaultSelectedPartition === ''
        );
      setPartitionOptions(options);
    }
  }, [partitions, fetchPartition, defaultSelectedPartition]);

  const BackIcon = icons.back;

  // 弹窗操作区：按钮文案或组件
  const { confirm, cancel } = useMemo(() => {
    const labelMap: {
      [key in InsertStepperEnum]: {
        confirm: string;
        cancel: string | ReactElement;
      };
    } = {
      [InsertStepperEnum.import]: {
        confirm: btnTrans('next'),
        cancel: btnTrans('cancel'),
      },
      [InsertStepperEnum.preview]: {
        confirm: btnTrans('importFile'),
        cancel: (
          <>
            <BackIcon sx={{ fontSize: '16px' }} />
            {btnTrans('previous')}
          </>
        ),
      },
      [InsertStepperEnum.status]: {
        confirm: btnTrans('done'),
        cancel: '',
      },
    };
    return labelMap[activeStep];
  }, [activeStep, btnTrans, BackIcon]);

  const { showActions, showCancel } = useMemo(() => {
    return {
      showActions: insertStatus !== InsertStatusEnum.loading,
      showCancel: insertStatus === InsertStatusEnum.init,
    };
  }, [insertStatus]);

  // 子组件需要的 props：
  const collectionOptions: Option[] = useMemo(
    () =>
      defaultSelectedCollection === ''
        ? collections.map(c => ({
            label: c.collection_name,
            value: c.collection_name,
          }))
        : [
            {
              label: defaultSelectedCollection,
              value: defaultSelectedCollection,
            },
          ],
    [collections, defaultSelectedCollection]
  );

  const {
    schemaOptions,
    autoIdFieldName,
  }: { schemaOptions: Option[]; autoIdFieldName: string } = useMemo(() => {
    /**
     * 在 Collection 页面时，Schema 数据取自 Collection
     * 在 Partition 页面时，Schema 通过 props 传入
     */
    const list = schema
      ? schema.fields
      : collections.find(c => c.collection_name === collectionValue)?.schema
          ?.fields;

    const autoIdFieldName =
      list?.find(item => item.is_primary_key && item.autoID)?.name || '';
    /**
     * 若同时满足以下条件，该 Schema 不应作为可选表头：
     * 1. 该 Field 是 Primary Key
     * 2. 该 Field 的 auto id 为 true
     */
    const options = (list || [])
      .filter(s => !s.autoID || !s.is_primary_key)
      .map(s => ({
        label: s.name,
        value: s.name,
      }));
    return {
      schemaOptions: options,
      autoIdFieldName,
    };
  }, [schema, collectionValue, collections]);

  const checkUploadFileValidation = (firstRowItems: string[]): boolean => {
    return checkIsAutoIdFieldValid(firstRowItems);
  };

  /**
   * Primary Key Field 的 auto id 为 true 时
   * 无需上传该 Field 的数据
   * @param firstRowItems 上传文件的首行数据
   * @returns 是否非法，true 表示非法
   */
  const checkIsAutoIdFieldValid = (firstRowItems: string[]): boolean => {
    const isContainAutoIdField = firstRowItems.includes(autoIdFieldName);
    isContainAutoIdField &&
      openSnackBar(
        insertTrans('uploadAutoIdFieldWarning', { fieldName: autoIdFieldName }),
        'error'
      );
    return isContainAutoIdField;
  };

  const handleUploadedData = (
    content: string,
    uploader: HTMLFormElement,
    type: FILE_MIME_TYPE
  ) => {
    // 如果是 JSON，直接把 JSON 解析成对象
    if (type === FILE_MIME_TYPE.JSON) {
      setJsonData(JSON.parse(content));
      setCsvData([]);
      return;
    }
    const { data } = parse(content);
    // 上传的 CSV 含表头时，firstRowItems 就是全部表头
    const [firstRowItems = []] = data as string[][];

    const invalid = checkUploadFileValidation(firstRowItems);
    if (invalid) {
      // 重置 uploader 的值和文件名
      setFileName('');
      setFile(null);
      uploader.value = null;
      return;
    }
    setCsvData(data);
    setJsonData(undefined);
  };

  const handleInsertData = async () => {
    const fields = schema
      ? schema.fields
      : collections.find(c => c.collection_name === collectionValue)?.schema
          ?.fields;

    // 开始加载
    setInsertStatus(InsertStatusEnum.loading);
    // 处理数据
    const data =
      typeof jsonData !== 'undefined'
        ? convertVectorFields(jsonData, fields!)
        : combineHeadsAndData(
            tableHeads,
            isContainFieldNames ? csvData.slice(1) : csvData,
            fields!
          );

    // 设置正在导入的记录数
    setImportingCount(data.length);

    const param: InsertDataParam = {
      partition_name: partitionValue,
      fields_data: data,
    };

    try {
      const inserted = await DataService.insertData(collectionValue, param);
      if (inserted.status.error_code !== 'Success') {
        setInsertFailMsg(inserted.status.reason);
        setInsertStatus(InsertStatusEnum.error);
      } else {
        await DataService.flush(collectionValue);
        // 更新 Collection
        await onInsert(collectionValue);
        setInsertStatus(InsertStatusEnum.success);
      }
    } catch (err: any) {
      // 退回导入步骤
      setInsertStatus(InsertStatusEnum.init);
      setActiveStep(InsertStepperEnum.import);
    }
  };

  const handleCollectionChange = (name: string) => {
    setCollectionValue(name);
  };

  const handleNext = () => {
    const isJSON = typeof jsonData !== 'undefined';
    switch (activeStep) {
      case InsertStepperEnum.import:
        setActiveStep(activeStep => activeStep + (isJSON ? 2 : 1));
        if (isJSON) {
          handleInsertData();
        }
        break;
      case InsertStepperEnum.preview:
        setActiveStep(activeStep => activeStep + 1);
        handleInsertData();
        break;
      // default 代表 InsertStepperEnum.status
      default:
        handleCloseDialog();
        break;
    }
  };

  const handleUploadFileChange = (file: File, upload: HTMLFormElement) => {
    setFile(file);
  };

  const handleBack = () => {
    switch (activeStep) {
      case InsertStepperEnum.import:
        handleCloseDialog();
        break;
      case InsertStepperEnum.preview:
        setActiveStep(activeStep => activeStep - 1);
        break;
      // default 代表 InsertStepperEnum.status
      // status 步骤没有取消按钮
      default:
        break;
    }
  };

  const generateContent = (activeStep: InsertStepperEnum) => {
    switch (activeStep) {
      case InsertStepperEnum.import:
        return (
          <InsertImport
            collectionOptions={collectionOptions}
            partitionOptions={partitionOptions}
            selectedCollection={collectionValue}
            selectedPartition={partitionValue}
            handleCollectionChange={handleCollectionChange}
            handlePartitionChange={setPartitionValue}
            handleUploadedData={handleUploadedData}
            handleUploadFileChange={handleUploadFileChange}
            fileName={fileName}
            setFileName={setFileName}
          />
        );
      case InsertStepperEnum.preview:
        return (
          <InsertPreview
            schemaOptions={schemaOptions}
            data={previewData}
            tableHeads={tableHeads}
            setTableHeads={setTableHeads}
            isContainFieldNames={isContainFieldNames}
            file={file}
            handleIsContainedChange={setIsContainFieldNames}
          />
        );
      // default 代表 InsertStepperEnum.status
      default:
        return (
          <InsertStatus
            status={insertStatus}
            failMsg={insertFailMsg}
            importingCount={importingCount}
          />
        );
    }
  };

  return (
    <DialogTemplate
      title={insertTrans('import')}
      handleClose={handleCloseDialog}
      confirmLabel={confirm}
      cancelLabel={cancel}
      handleCancel={handleBack}
      handleConfirm={handleNext}
      confirmDisabled={nextDisabled}
      showActions={showActions}
      showCancel={showCancel}
      // 插入未完成时不显示关闭图标
      showCloseIcon={insertStatus !== InsertStatusEnum.loading}
    >
      {generateContent(activeStep)}
    </DialogTemplate>
  );
};

export default InsertContainer;
