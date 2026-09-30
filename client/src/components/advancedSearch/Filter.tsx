import { forwardRef, useState, useEffect, useImperativeHandle, useRef } from 'react';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import icons from '@/components/icons/Icons';
import { generateIdByHash } from '@/utils/Common';
import AdvancedDialog from './Dialog';
import CustomButton from '../customButton/CustomButton';
import type { FilterProps, ConditionData } from './Types';

const Filter = forwardRef((props: FilterProps, ref) => {
  const {
    title = 'title',
    showTitle = true,
    showTooltip = true,
    className = '',
    filterDisabled = false,
    tooltipPlacement = 'top',
    onSubmit,
    fields = [],
    ...others
  } = props;

  // i18n
  const { t: searchTrans } = useTranslation('search');

  const [open, setOpen] = useState(false);
  const [flatConditions, setFlatConditions] = useState<any[]>([]);
  const [initConditions, setInitConditions] = useState<any[]>([]);
  const [isConditionsLegal, setIsConditionsLegal] = useState(false);
  const [filterExpression, setFilterExpression] = useState('');
  
  // 用 ref 记录上一次的表达式，避免不必要的更新
  const prevExpressionRef = useRef<string>('');

  const FilterIcon = icons.filter;

  // fields 为空数组时，重置所有条件
  useEffect(() => {
    if (fields.length === 0) {
      setFlatConditions([]);
      setInitConditions([]);
    }
  }, [fields]);

  // 检查所有条件是否都正确
  useEffect(() => {
    // 累加条件数量
    for (let i = 0; i < flatConditions.length; i++) {
      const { data, type } = flatConditions[i];
      if (type !== 'condition') continue;
      if (!data) {
        setIsConditionsLegal(false);
        return;
      }
      if (!data.isCorrect) {
        setIsConditionsLegal(data.isCorrect);
        return;
      }
    }
    setIsConditionsLegal(true);
    
    // 条件合法时才生成表达式
    if (flatConditions.length > 0) {
      generateExpression(flatConditions, setFilterExpression);
    }
  }, [flatConditions]);

  const setFilteredFlatConditions = (conditions: any[]) => {
    const newConditions = conditions.reduce((prev, item, currentIndex) => {
      if (prev.length === 0 && item.type !== 'condition') return prev;
      if (
        prev.length &&
        item.type !== 'condition' &&
        prev[prev.length - 1].type !== 'condition'
      )
        return prev;
      return [...prev, item];
    }, []);
    setFlatConditions(newConditions);
  };

  const generateExpression = (conditions: any[], func: any) => {
    const expression = conditions.reduce((prev, item) => {
      const { type, data } = item;
      if (type === 'break') return `${prev} || `;

      const {
        field: { name },
        op,
        jsonKey,
        value,
      } = data;

      let n = name;

      // 类型为 JSON 时，格式化 JSON 表达式
      if (data.field.data_type === 'JSON') {
        n = `${name}["${jsonKey}"]`;
      }

      let newExpr = `${n} ${op} ${value}`;

      // 操作符为 JSON_CONTAINS/ARRAY_CONTAINS 时，重写表达式
      if (
        op === 'JSON_CONTAINS' ||
        op === 'ARRAY_CONTAINS' ||
        op === 'TEXT_MATCH'
      ) {
        newExpr = `${op}(${n}, ${value})`;
      }
      // 操作符为 ARRAY_CONTAINS_ALL/ARRAY_CONTAINS_ANY 时，重写表达式
      if (op === 'ARRAY_CONTAINS_ALL' || op === 'ARRAY_CONTAINS_ANY') {
        newExpr = `${op}(${n}, ${value})`;
      }
      // 操作符为 JSON_CONTAINS_ALL/JSON_CONTAINS_ANY 时，重写表达式
      if (op === 'JSON_CONTAINS_ALL' || op === 'JSON_CONTAINS_ANY') {
        newExpr = `${op}(${n}, ${value})`;
      }
      return `${prev}${prev && !prev.endsWith('|| ') ? ' && ' : ''}${newExpr}`;
    }, '');
    func(expression);
  };

  /**
   * 在指定位置插入 "OR" 操作符。
   * @param targetId break 操作符会插入到目标项之后。
   */
  const addOrOp = (targetId?: string) => {
    if (!targetId) {
      setFilteredFlatConditions([
        ...flatConditions,
        { id: generateIdByHash('break'), type: 'break' },
        {
          id: generateIdByHash('condition'),
          type: 'condition',
          field: '',
          operator: '<',
          value: '',
        },
      ]);
      return;
    }
    const formerConditions = [...flatConditions];
    const newConditions = formerConditions.reduce((prev, item) => {
      if (item.id === targetId) {
        return [
          ...prev,
          item,
          { id: generateIdByHash('break'), type: 'break' },
        ];
      }
      return [...prev, item];
    }, []);
    setFilteredFlatConditions(newConditions);
  };
  /**
   * 移除指定位置的 "OR" 操作符。
   * @param targetId 移除目标项之后的 break 操作符。
   */
  const removeOrOp = (targetId: string) => {
    setFilteredFlatConditions(flatConditions.filter(i => i.id !== targetId));
  };
  /**
   * 在指定位置新增条件。
   * @param targetId 新条件项的插入位置。
   * 为空时追加到末尾。
   * @param beforeTarget 插入到目标项之前。
   */
  const addCondition = (targetId?: string, beforeTarget?: boolean) => {
    const formerConditions = [...flatConditions];
    const newItem = {
      id: generateIdByHash('condition'),
      type: 'condition',
      field: '',
      operator: '<',
      value: '',
    };
    if (!targetId) {
      formerConditions.push(newItem);
      setFilteredFlatConditions(formerConditions);
      return;
    }
    const newConditions = formerConditions.reduce((prev, item) => {
      if (item.id === targetId) {
        const newItems = [
          item,
          {
            id: generateIdByHash('condition'),
            type: 'condition',
            field: '',
            operator: '<',
            value: '',
          },
        ];
        beforeTarget && newItems.reverse();
        return [...prev, ...newItems];
      }
      return [...prev, item];
    }, []);
    setIsConditionsLegal(false);
    setFilteredFlatConditions(newConditions);
  };
  /**
   * 移除指定位置的条件。
   * @param targetId 要移除的条件项位置。
   */
  const removeCondition = (targetId: string) => {
    setFilteredFlatConditions(flatConditions.filter(i => i.id !== targetId));
  };
  const changeBinaryLogicalOp = (value: string, targetId: string) => {
    if (value === 'or') {
      addOrOp(targetId);
    } else if (value === 'and') {
      removeOrOp(targetId);
    }
  };
  /**
   * 更新指定条件的数据。
   * @param id 指定要更新的条件项。
   * @param data 要更新到该条件上的数据。
   */
  const updateConditionData = (id: string, data: ConditionData) => {
    const formerFlatConditions = flatConditions.map(i => {
      if (i.id === id) return { ...i, data };
      return i;
    });
    setFilteredFlatConditions(formerFlatConditions);
  };
  // 重置条件
  const resetConditions = () => {
    setIsConditionsLegal(false);
    setFilteredFlatConditions([
      {
        id: generateIdByHash(),
        type: 'condition',
        field: '',
        operator: '<',
        value: '',
      },
    ]);
  };
  const getConditionsSum = () => {
    const conds = flatConditions.filter(i => i.type === 'condition');
    return conds.length;
  };

  const handleConditions = {
    addOrOp,
    removeOrOp,
    addCondition,
    removeCondition,
    changeBinaryLogicalOp,
    updateConditionData,
    resetConditions,
    getConditionsSum,
    setFilteredFlatConditions,
    setIsConditionsLegal,
    setFilterExpression,
  };

  const handleClickOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };
  const handleDeleteAll = () => {
    setFlatConditions([]);
    setInitConditions([]);
    onSubmit('');
  };
  const handleCancel = () => {
    setOpen(false);
    handleFallback();
  };
  const handleSubmit = () => {
    onSubmit(filterExpression);
    setInitConditions(flatConditions);
    setOpen(false);
  };
  // 只重置当前条件，之前提交的条件保留。
  const handleReset = () => {
    setFilteredFlatConditions([
      {
        id: generateIdByHash('condition'),
        type: 'condition',
        field: '',
        operator: '<',
        value: '',
      },
    ]);
  };
  // 重置全部条件（当前的和之前提交的）。
  const handleHardReset = () => {
    setInitConditions([]);
    handleReset();
  };
  const handleFallback = () => {
    setFilteredFlatConditions(initConditions);
  };
  // 暴露方法
  // useImperativeHandle 用于自定义通过 ref 暴露给父组件的实例值。
  // https://reactjs.org/docs/hooks-reference.html#useimperativehandle
  useImperativeHandle(ref, () => ({
    // 暴露 handleHardReset，父组件可通过 `ref.current.getReset()` 调用
    getReset() {
      handleHardReset();
    },
  }));

  return (
    <>
      <Box className={className} {...others}>
        <CustomButton
          disabled={filterDisabled}
          sx={{
            color: theme => theme.palette.primary.main,
            minWidth: 32,
            p: '8px 0',
            '& .MuiButton-endIcon': { ml: 0 },
          }}
          onClick={handleClickOpen}
          size="small"
          endIcon={<FilterIcon />}
        >
          {showTitle ? title : ''}
        </CustomButton>
        {showTooltip && initConditions.length > 0 && (
          <Tooltip arrow title={filterExpression} placement={tooltipPlacement}>
            <Chip
              label={initConditions.filter(i => i.type === 'condition').length}
              onDelete={handleDeleteAll}
              variant="outlined"
              size="small"
            />
          </Tooltip>
        )}
        {open && (
          <AdvancedDialog
            open={open}
            onClose={handleClose}
            onCancel={handleCancel}
            onSubmit={handleSubmit}
            onReset={handleReset}
            title={searchTrans('filterExpr')}
            fields={fields}
            handleConditions={handleConditions}
            conditions={flatConditions}
            isLegal={isConditionsLegal}
            expression={filterExpression}
          />
        )}
      </Box>
    </>
  );
});

Filter.displayName = 'AdvancedFilter';

export default Filter;
