import { useState, useCallback, useEffect, useContext } from 'react';
import {
  TextField,
  FormControlLabel,
  Checkbox,
  Tabs,
  Tab,
  Radio,
  Box,
  styled,
} from '@mui/material';
import { authContext } from '@/context';
import Autocomplete from '@mui/material/Autocomplete';
import { CollectionService } from '@/http';
import { useTranslation } from 'react-i18next';
import type {
  DBOption,
  CollectionOption,
  DBCollectionsSelectorProps,
} from '../Types';
import type { DBCollectionsPrivileges, RBACOptions } from '@server/types';

const Root = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
}));

const DBCollections = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  gap: theme.spacing(1),
}));

const SelectorDB = styled(Autocomplete<DBOption>)(({ theme }) => ({
  flex: 1,
  marginBottom: theme.spacing(2),
}));

const SelectorCollection = styled(Autocomplete<CollectionOption>)({
  flex: 1,
});

const CategoryHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0.5),
  backgroundColor: theme.palette.action.hover,
  borderRadius: theme.shape.borderRadius,
  marginBottom: 0,
  '& .MuiTypography-root': {
    fontSize: 14,
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
}));

const CategoryBody = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0.5, 1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
}));

const Privileges = styled(Box)(({ theme }) => ({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  height: 'auto',
  minHeight: 200,
  width: '100%',
  borderRadius: theme.shape.borderRadius,
}));

const PrivilegeBody = styled(FormControlLabel)({
  minWidth: 200,
});

const ToggleContainer = styled(Box)(({ theme }) => ({
  fontSize: 13,
  '& .toggle-label': {
    padding: 0,
    marginRight: theme.spacing(1),
    fontWeight: '400',
  },
  '& .MuiRadio-root': {
    paddingRight: 8,
  },
}));

export default function DBCollectionsSelector(
  props: DBCollectionsSelectorProps
) {
  // Props
  const { selected, setSelected, options } = props;
  const { rbacOptions, dbOptions } = options;
  // 样式
  // 国际化
  const { t: searchTrans } = useTranslation('search');
  const { t: userTrans } = useTranslation('user');
  // Context
  const { isDedicated } = useContext(authContext);

  // UI State
  const [selectedDB, setSelectedDB] = useState<DBOption | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string>('*');
  const [collectionOptions, setCollectionOptions] = useState<
    CollectionOption[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0); // Tab 下标
  const [privilegeOptionType, setPrivilegeOptionType] = useState<
    'group' | 'custom'
  >('group'); // 权限选项的类型

  // 选中的 Database 变化时拉取 Collection 列表
  const fetchCollections = useCallback(async (dbName: string) => {
    // 常量
    const ALL_COLLECTIONS = { name: '*', value: '*' };
    setLoading(true);
    try {
      let options: CollectionOption[] = [];
      if (dbName === '*') {
        options = [ALL_COLLECTIONS];
      } else {
        const res = await CollectionService.getCollectionsNames({
          db_name: dbName,
        });
        options = res.map(c => ({ name: c, value: c }));
        options.unshift(ALL_COLLECTIONS);
      }
      setCollectionOptions(options);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // dbOptions 变化时初始化 selectedDB 并拉取 Collection 列表
  useEffect(() => {
    if (dbOptions.length > 0 && selectedDB === null) {
      const initialDB = dbOptions[0];
      setSelectedDB(initialDB);
      fetchCollections(initialDB.value);
    }
  }, [dbOptions, selectedDB, fetchCollections]);

  // 处理 Database 选择
  const handleDBChange = (db: DBOption) => {
    setSelectedDB(db);
    setSelected(prevSelected => {
      const newSelected = { ...prevSelected } as DBCollectionsPrivileges;
      if (!newSelected[db.value]) {
        newSelected[db.value] = { collections: {} };
      }
      setSelectedCollection('*');
      return newSelected;
    });
    fetchCollections(db.value);
  };

  // 处理 Collection 选择
  const handleCollectionChange = (collection: CollectionOption | null) => {
    if (collection) {
      setSelectedCollection(collection.value);
    }
  };

  // 处理某个 Collection 的权限勾选变化
  const handlePrivilegeChange = (
    collectionValue: string,
    privilegeName: string,
    checked: boolean,
    dbValue: string
  ) => {
    const selectedDBValue = dbValue;
    if (!selectedDBValue) return;

    const newSelected = { ...selected };
    if (!newSelected[selectedDBValue]) {
      newSelected[selectedDBValue] = { collections: {} };
    }
    if (!newSelected[selectedDBValue].collections[collectionValue]) {
      newSelected[selectedDBValue].collections[collectionValue] = {};
    }
    newSelected[selectedDBValue].collections[collectionValue][privilegeName] =
      checked;
    setSelected(newSelected);
  };

  // 处理某个分类的权限全选
  const handleSelectAll = (
    category: keyof RBACOptions,
    collectionValue: string,
    checked: boolean,
    dbValue: string
  ) => {
    const selectedDBValue = dbValue;
    if (!selectedDBValue) return;

    const newSelected = { ...selected };
    if (!newSelected[selectedDBValue]) {
      newSelected[selectedDBValue] = { collections: {} };
    }
    if (!newSelected[selectedDBValue].collections[collectionValue]) {
      newSelected[selectedDBValue].collections[collectionValue] = {};
    }
    Object.keys(rbacOptions[category]).forEach(privilegeName => {
      newSelected[selectedDBValue].collections[collectionValue][privilegeName] =
        checked;
    });
    setSelected(newSelected);
  };

  // 判断某个分类的权限是否已全选
  const isCategoryAllSelected = (
    category: keyof RBACOptions,
    collectionValue: string,
    dbValue: string
  ) => {
    const selectedDBValue = dbValue || selectedDB?.value;
    if (!selectedDBValue) return false;

    const categoryPrivileges = rbacOptions[category];
    return Object.keys(categoryPrivileges).every(
      privilegeName =>
        selected[selectedDBValue] &&
        selected[selectedDBValue].collections &&
        selected[selectedDBValue].collections[collectionValue]?.[privilegeName]
    );
  };

  // 判断某个分类的权限是否部分选中
  const isCategorySomeSelected = (
    category: keyof RBACOptions,
    collectionValue: string,
    dbValue: string
  ) => {
    const selectedDBValue = dbValue;
    if (!selectedDBValue) return false;

    const categoryPrivileges = rbacOptions[category];
    const someSelected = Object.keys(categoryPrivileges).some(
      privilegeName =>
        selected[selectedDBValue] &&
        selected[selectedDBValue].collections &&
        selected[selectedDBValue].collections[collectionValue]?.[privilegeName]
    );
    const allSelected = isCategoryAllSelected(
      category,
      collectionValue,
      dbValue
    );
    return someSelected && !allSelected;
  };

  // 计算某个 Collection 已勾选的权限数量
  const getSelectedPrivilegesCount = (
    collectionValue: string,
    privileges: [string, Record<string, string>][]
  ): number => {
    const selectedDBValue = selectedDB?.value;
    if (!selectedDBValue) return 0;

    const collectionPrivileges =
      selected[selectedDBValue]?.collections?.[collectionValue] || {};

    // 统计该 Collection 已勾选的权限数量
    const selectedCount = privileges.reduce(
      (total, [_, categoryPrivileges]) => {
        return (
          total +
          Object.keys(categoryPrivileges).reduce((total, privilegeName) => {
            return total + (collectionPrivileges[privilegeName] ? 1 : 0);
          }, 0)
        );
      },
      0
    );

    return selectedCount;
  };

  // 计算某个 Collection 的权限总数
  const getTotalPrivilegesCount = (
    privileges: [string, Record<string, string>][]
  ) => {
    const total = privileges.reduce((total, [_, categoryPrivileges]) => {
      return total + Object.keys(categoryPrivileges).length;
    }, 0);

    return total;
  };

  // 拆分权限选项
  const globalPrivileges = [
    'DatabasePrivileges',
    'ResourceManagementPrivileges',
    'RBACPrivileges',
  ];

  const rbacEntries = Object.entries(rbacOptions) as [
    keyof RBACOptions,
    Record<string, string>,
  ][];
  const databasePrivilegeOptions = rbacEntries.filter(([category]) => {
    return (
      category === 'DatabasePrivileges' || category == 'DatabasePrivilegeGroups'
    );
  });
  const collectionPrivilegeOptions = rbacEntries.filter(([category]) => {
    return (
      !globalPrivileges.includes(category) &&
      category !== 'ClusterPrivilegeGroups' &&
      category !== 'DatabasePrivilegeGroups'
    );
  });
  const clusterPrivileges = rbacEntries.filter(([category]) => {
    return (
      category === 'ResourceManagementPrivileges' ||
      category === 'RBACPrivileges' ||
      category === 'ClusterPrivilegeGroups' ||
      category === 'CustomPrivilegeGroups'
    );
  });

  const collectionTypeOptions = collectionPrivilegeOptions.filter(c => {
    return privilegeOptionType === 'group'
      ? c[0].includes('Groups')
      : !c[0].includes('Groups');
  });

  return (
    <Root>
      {/* 权限类型切换 */}
      <ToggleContainer>
        <label className="toggle-label">
          <Radio
            checked={privilegeOptionType === 'group'}
            onChange={() => setPrivilegeOptionType('group')}
            value="group"
            name="group"
            size="small"
            inputProps={{ 'aria-label': 'group' }}
          />
          {userTrans('privilegeGroups')}
        </label>
        {!isDedicated && (
          <label className="toggle-label">
            <Radio
              checked={privilegeOptionType === 'custom'}
              onChange={() => setPrivilegeOptionType('custom')}
              value="custom"
              name="custom"
              size="small"
              inputProps={{ 'aria-label': 'custom' }}
            />
            {userTrans('privileges')}
          </label>
        )}
      </ToggleContainer>
      {/* Cluster、Database、Collection 三个 Tab */}
      <Tabs
        value={tabValue}
        onChange={(event, newValue) => setTabValue(newValue)}
        aria-label="tabs"
      >
        <Tab label={userTrans('collection')} sx={{ textTransform: 'none' }} />
        <Tab label={userTrans('database')} sx={{ textTransform: 'none' }} />
        <Tab label={userTrans('cluster')} sx={{ textTransform: 'none' }} />
      </Tabs>

      {tabValue === 2 && (
        <PrivilegeSelector
          privilegeOptions={clusterPrivileges}
          selected={selected}
          selectedDB={{ name: userTrans('allDatabases'), value: '*' }}
          selectedCollection={'*'}
          handlePrivilegeChange={handlePrivilegeChange}
          isCategoryAllSelected={isCategoryAllSelected}
          isCategorySomeSelected={isCategorySomeSelected}
          handleSelectAll={handleSelectAll}
          privilegeOptionType={privilegeOptionType}
        />
      )}

      {tabValue === 1 && (
        <div>
          <SelectorDB
            options={dbOptions}
            loading={loading}
            value={selectedDB || null}
            onChange={(_, value) => {
              if (!value) return;
              handleDBChange(value);
            }}
            getOptionLabel={option => option.name}
            isOptionEqualToValue={(option, value) =>
              option.value === value.value
            }
            renderInput={params => (
              <TextField
                {...params}
                label={userTrans('databases')}
                variant="filled"
              />
            )}
            noOptionsText={
              loading ? searchTrans('loading') : searchTrans('noOptions')
            }
          />
          <PrivilegeSelector
            privilegeOptions={databasePrivilegeOptions}
            selected={selected}
            selectedDB={selectedDB}
            selectedCollection={'*'}
            handlePrivilegeChange={handlePrivilegeChange}
            isCategoryAllSelected={isCategoryAllSelected}
            isCategorySomeSelected={isCategorySomeSelected}
            handleSelectAll={handleSelectAll}
            privilegeOptionType={privilegeOptionType}
          />
        </div>
      )}

      {tabValue === 0 && (
        <div>
          <DBCollections>
            <SelectorDB
              options={dbOptions}
              loading={loading}
              value={selectedDB || null}
              onChange={(_, value) => {
                if (!value) return;
                handleDBChange(value);
              }}
              getOptionLabel={option => option.name}
              isOptionEqualToValue={(option, value) =>
                option.value === value.value
              }
              renderInput={params => (
                <TextField
                  {...params}
                  label={userTrans('databases')}
                  variant="filled"
                />
              )}
              noOptionsText={
                loading ? searchTrans('loading') : searchTrans('noOptions')
              }
            />
            <SelectorCollection
              options={collectionOptions}
              loading={loading}
              value={
                collectionOptions.find(
                  option => option.value === selectedCollection
                ) || null
              }
              onChange={(_, value) => {
                if (!value) return;
                handleCollectionChange(value);
              }}
              getOptionLabel={option => {
                const selectedCount = getSelectedPrivilegesCount(
                  option.value,
                  collectionTypeOptions
                );
                const totalCount = getTotalPrivilegesCount(
                  collectionTypeOptions
                );
                return `${option.name} (${selectedCount}/${totalCount})`;
              }}
              isOptionEqualToValue={(option, value) =>
                option.value === value.value
              }
              renderInput={params => {
                return (
                  <TextField
                    {...params}
                    label={userTrans('collections')}
                    variant="filled"
                  />
                );
              }}
              noOptionsText={
                loading ? searchTrans('loading') : searchTrans('noOptions')
              }
            />
          </DBCollections>

          <PrivilegeSelector
            privilegeOptions={collectionPrivilegeOptions}
            selected={selected}
            selectedDB={selectedDB}
            selectedCollection={selectedCollection}
            handlePrivilegeChange={handlePrivilegeChange}
            isCategoryAllSelected={isCategoryAllSelected}
            isCategorySomeSelected={isCategorySomeSelected}
            handleSelectAll={handleSelectAll}
            privilegeOptionType={privilegeOptionType}
          />
        </div>
      )}
    </Root>
  );
}

// PrivilegeSelector 组件
const PrivilegeSelector = (props: {
  privilegeOptions: [keyof RBACOptions, Record<string, string>][];
  selected: DBCollectionsPrivileges;
  selectedDB: DBOption | null;
  selectedCollection: string;
  privilegeOptionType: 'group' | 'custom';
  handlePrivilegeChange: (
    collectionValue: string,
    privilegeName: string,
    checked: boolean,
    dbValue: string
  ) => void;
  isCategoryAllSelected: (
    category: keyof RBACOptions,
    collectionValue: string,
    dbValue: string
  ) => boolean;
  isCategorySomeSelected: (
    category: keyof RBACOptions,
    collectionValue: string,
    dbValue: string
  ) => boolean;
  handleSelectAll: (
    category: keyof RBACOptions,
    collectionValue: string,
    checked: boolean,
    dbValue: string
  ) => void;
}) => {
  // Props
  const {
    selected,
    selectedDB,
    selectedCollection,
    privilegeOptions,
    handlePrivilegeChange,
    handleSelectAll,
    isCategoryAllSelected,
    isCategorySomeSelected,
    privilegeOptionType,
  } = props;

  // 国际化
  const { t: userTrans } = useTranslation('user');

  return (
    <Privileges>
      {selectedDB && selectedCollection && (
        <div>
          {privilegeOptions
            .filter(v => {
              if (privilegeOptionType === 'group') {
                return v[0].includes('Groups') && Object.keys(v[1]).length > 0;
              } else {
                return !v[0].includes('Groups');
              }
            })
            .map(([category, categoryPrivileges]) => (
              <div key={category}>
                <CategoryHeader>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isCategoryAllSelected(
                          category,
                          selectedCollection,
                          selectedDB.value
                        )}
                        indeterminate={isCategorySomeSelected(
                          category,
                          selectedCollection,
                          selectedDB.value
                        )}
                        onChange={e =>
                          handleSelectAll(
                            category,
                            selectedCollection,
                            e.target.checked,
                            selectedDB.value
                          )
                        }
                        size="small"
                        sx={{ marginLeft: 1 }}
                        title={userTrans('selectAll')}
                      />
                    }
                    label={userTrans(category)}
                  />
                </CategoryHeader>
                <CategoryBody>
                  {Object.entries(categoryPrivileges).map(([privilegeName]) => (
                    <PrivilegeBody
                      key={privilegeName}
                      control={
                        <Checkbox
                          checked={
                            (selected[selectedDB.value] &&
                              selected[selectedDB.value].collections &&
                              selected[selectedDB.value].collections[
                                selectedCollection
                              ]?.[privilegeName]) ||
                            false
                          }
                          size="small"
                          onChange={e =>
                            handlePrivilegeChange(
                              selectedCollection,
                              privilegeName,
                              e.target.checked,
                              selectedDB.value
                            )
                          }
                        />
                      }
                      label={privilegeName}
                    />
                  ))}
                </CategoryBody>
              </div>
            ))}
        </div>
      )}
    </Privileges>
  );
};
