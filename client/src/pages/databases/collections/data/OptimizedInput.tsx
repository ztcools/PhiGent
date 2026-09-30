import { useCallback, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import CustomInput from '@/components/customInput/CustomInput';
import Filter from '@/components/advancedSearch';
import type { FieldObject } from '@server/types';

interface OptimizedInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: any) => void;
  disabled?: boolean;
  fields: FieldObject[];
  onSubmit: (expression: string) => void;
}

const OptimizedInput = ({
  value,
  onChange,
  onKeyDown,
  disabled = false,
  fields,
  onSubmit,
}: OptimizedInputProps) => {
  const { t: collectionTrans } = useTranslation('collection');
  const [localValue, setLocalValue] = useState(value);

  // 用 ref 稳定函数调用，避免回调频繁重建
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);
  const onKeyDownRef = useRef(onKeyDown);

  // Props 变化时更新 ref
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    onKeyDownRef.current = onKeyDown;
  }, [onKeyDown]);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue);
      onChangeRef.current(newValue);
    },
    [] // 已使用 ref，故无需依赖
  );

  const handleKeyDown = useCallback(
    (e: any) => {
      onKeyDownRef.current(e);
    },
    [] // 已使用 ref，故无需依赖
  );

  const handleFilterSubmit = useCallback(
    (expression: string) => {
      setLocalValue(expression);
      onChangeRef.current(expression);
      onSubmitRef.current(expression);
    },
    [] // 已使用 ref，故无需依赖
  );

  return (
    <CustomInput
      type="text"
      textConfig={{
        label: localValue
          ? collectionTrans('queryExpression')
          : collectionTrans('exprPlaceHolder'),
        key: 'advFilter',
        className: 'textarea',
        onChange: handleChange,
        value: localValue,
        disabled,
        variant: 'filled',
        required: false,
        InputLabelProps: { shrink: true },
        InputProps: {
          endAdornment: (
            <Filter
              title={''}
              showTitle={false}
              fields={fields}
              filterDisabled={disabled}
              onSubmit={handleFilterSubmit}
              showTooltip={false}
            />
          ),
        },
        onKeyDown: handleKeyDown,
      }}
      checkValid={() => true}
    />
  );
};

export default OptimizedInput;
