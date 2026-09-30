import { FC, useCallback, useMemo } from 'react';
import { Typography, Box, Select, MenuItem, FormControl } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { InsertPreviewProps } from './Types';
import CustomSelector from '@/components/customSelector/CustomSelector';
import AttuGrid from '@/components/grid/Grid';
import { transferCsvArrayToTableData } from '@/utils';
import icons from '@/components/icons/Icons';
import type { Option } from '@/components/customSelector/Types';
import type { ColDefinitionsType } from '@/components/grid/Types';

const getTableData = (
  data: any[],
  isContainFieldNames: number
): { [key in string]: any }[] => {
  const csvData = isContainFieldNames ? data.slice(1) : data;
  return transferCsvArrayToTableData(csvData);
};

const InsertPreview: FC<InsertPreviewProps> = ({
  schemaOptions,
  data,
  isContainFieldNames,
  handleIsContainedChange,
  tableHeads,
  setTableHeads,
}) => {
  const { t: insertTrans } = useTranslation('insert');

  const ArrowIcon = icons.dropdown;
  // 表格所需的表结构，元数据取自 CSV
  const tableData = getTableData(data, isContainFieldNames);

  const handleTableHeadChange = useCallback(
    (index: number, label: string) => {
      const newHeads = [...tableHeads];
      newHeads[index] = label;
      setTableHeads(newHeads);
    },
    [tableHeads, setTableHeads]
  );

  const editHeads = useMemo(
    () =>
      tableHeads.map((head: string, index: number) => ({
        value: head,
        component: (
          <FormControl
            sx={{
              m: 0.5,
              minWidth: 120,
              backgroundColor: theme => theme.palette.background.paper,
            }}
          >
            <Select
              value={head || ''} // 确保 Select 的 value 不为 undefined
              onChange={event =>
                handleTableHeadChange(index, event.target.value as string)
              }
              displayEmpty
              IconComponent={ArrowIcon}
              sx={{
                color: theme => theme.palette.text.secondary,
                fontSize: '0.875rem', // 更小的字号
                '& .MuiSelect-select': {
                  paddingRight: '28px', // 为自定义图标和更小尺寸留出空间
                  paddingTop: '8px', // 减小 padding
                  paddingBottom: '8px', // 减小 padding
                },
                '&:hover': { backgroundColor: 'transparent' },
              }}
              renderValue={selected => {
                if (!selected) {
                  return <em>{insertTrans('requiredFieldName')}</em>;
                }
                return selected;
              }}
            >
              <MenuItem disabled value="">
                <em>{insertTrans('requiredFieldName')}</em>
              </MenuItem>
              {schemaOptions.map(schema => (
                <MenuItem
                  key={schema.label}
                  value={schema.label}
                  className={
                    head === schema.label ? 'menu-active' : 'menu-item'
                  }
                >
                  {schema.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ),
      })),
    [tableHeads, ArrowIcon, schemaOptions, insertTrans, handleTableHeadChange]
  );

  const isContainedOptions: Option[] = [
    {
      label: 'Yes',
      value: 1,
    },
    { label: 'No', value: 0 },
  ];

  // 取表格行的第一项来获取值
  const colDefinitions: ColDefinitionsType[] = Object.keys(tableData[0])
    // 过滤掉 id，因为不需要在表格中展示
    .filter(item => item !== 'id')
    .map(key => ({
      id: key,
      align: 'left',
      disablePadding: false,
      label: '',
    }));

  return (
    <Box sx={{ width: '75vw' }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          mb: 2,
          '& .selector': { flexBasis: '40%', minWidth: 256 },
          '& .isContainSelect': { pt: 2, pb: 2 },
        }}
        component="form"
      >
        <Typography
          sx={{
            color: theme => theme.palette.text.secondary,
            fontWeight: 500,
            mb: 1,
          }}
        >
          {insertTrans('isContainFieldNames')}
        </Typography>
        <CustomSelector
          options={isContainedOptions}
          wrapperClass="selector"
          classes={{ filled: 'isContainSelect' }}
          value={isContainFieldNames}
          variant="filled"
          onChange={(e: { target: { value: unknown } }) => {
            const isContainedValue = e.target.value;
            handleIsContainedChange(isContainedValue as number);
          }}
          sx={{
            width: '100px',
            ml: 2,
          }}
        />
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mt: 3,
          mb: 1,
          '& .text': {
            color: theme => theme.palette.text.secondary,
            fontWeight: 500,
          },
        }}
      >
        <Typography className="text">
          {insertTrans('previewTipData')}
        </Typography>
        <Typography className="text">
          {insertTrans('previewTipAction')}
        </Typography>
      </Box>
      {tableData.length > 0 && (
        <Box sx={{ height: 320 }}>
          <AttuGrid
            toolbarConfigs={[]}
            colDefinitions={colDefinitions}
            rows={tableData}
            rowCount={0}
            primaryKey="id"
            openCheckBox={false}
            showHoverStyle={false}
            headEditable={true}
            editHeads={editHeads}
            tableCellMaxWidth="120px"
          />
        </Box>
      )}
    </Box>
  );
};

export default InsertPreview;
