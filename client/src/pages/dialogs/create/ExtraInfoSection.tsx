import React, { ChangeEvent } from 'react';
import { Checkbox, Box } from '@mui/material';
import CustomSelector from '@/components/customSelector/CustomSelector';
import CustomToolTip from '@/components/customToolTip/CustomToolTip';
import { ConsistencyLevelEnum } from '@/consts';
import { CONSISTENCY_LEVEL_OPTIONS } from './Constants';

interface ExtraInfoSectionProps {
  consistencyLevel: ConsistencyLevelEnum;
  setConsistencyLevel: (level: ConsistencyLevelEnum) => void;
  form: {
    enableDynamicField: boolean;
    loadAfterCreate: boolean;
  };
  updateCheckBox: (
    event: ChangeEvent<any>,
    key: string,
    value: boolean
  ) => void;
  collectionTrans: (key: string) => string;
}

const ExtraInfoSection: React.FC<ExtraInfoSectionProps> = ({
  consistencyLevel,
  setConsistencyLevel,
  form,
  updateCheckBox,
  collectionTrans,
}) => {
  return (
    <Box
      component="section"
      sx={{
        mt: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        '& fieldset': {
          border: 'none',
          padding: 0,
          margin: 0,
        },
        '& input': {
          ml: 0,
        },
      }}
    >
      <fieldset>
        <CustomSelector
          wrapperClass="consistency-select" // 保留 class 以备需要时进行外部样式定制，否则可移除
          sx={{ width: '400px', mb: 2 }} // 对应 consistencySelect 样式
          size="small"
          options={CONSISTENCY_LEVEL_OPTIONS}
          onChange={e => {
            setConsistencyLevel(e.target.value as ConsistencyLevelEnum);
          }}
          label={collectionTrans('consistency')}
          value={consistencyLevel}
          variant="filled"
        />
      </fieldset>
      <Box
        component="fieldset"
        sx={{
          pt: 1, // 对应 paddingTop: 8
          fontSize: 14,
          ml: -1, // 对应 marginLeft: -8
          borderTop: theme => `1px solid ${theme.palette.divider}`, // 对应 borderTop 样式
          '& label': {
            display: 'inline-block',
          },
        }}
      >
        <div>
          <CustomToolTip title={collectionTrans('partitionKeyTooltip')}>
            <label htmlFor="enableDynamicField">
              <Checkbox
                id="enableDynamicField"
                checked={!!form.enableDynamicField}
                size="small"
                onChange={event => {
                  updateCheckBox(
                    event,
                    'enableDynamicField',
                    !form.enableDynamicField
                  );
                }}
                sx={{ py: 0.5 }} // 如有需要可调整内边距
              />
              {collectionTrans('enableDynamicSchema')}
            </label>
          </CustomToolTip>
        </div>

        <div>
          <CustomToolTip
            title={collectionTrans('loadCollectionAfterCreateTip')}
          >
            <label htmlFor="loadAfterCreate">
              <Checkbox
                id="loadAfterCreate"
                checked={!!form.loadAfterCreate}
                size="small"
                onChange={event => {
                  updateCheckBox(
                    event,
                    'loadAfterCreate',
                    !form.loadAfterCreate
                  );
                }}
                sx={{ py: 0.5 }} // 如有需要可调整内边距
              />
              {collectionTrans('loadCollectionAfterCreate')}
            </label>
          </CustomToolTip>
        </div>
      </Box>
    </Box>
  );
};

export default ExtraInfoSection;
