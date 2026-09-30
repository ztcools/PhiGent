import { FC, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { rootContext, dataContext } from '@/context';
import DeleteTemplate from '@/components/customDialog/DeleteDialogTemplate';
import { Property } from '@/consts';
import { DatabaseService, CollectionService } from '@/http';
import type { CollectionObject } from '@server/types';

export interface EditPropertyProps {
  target: CollectionObject | string;
  type: 'collection' | 'database';
  property: Property;
  cb?: (target: CollectionObject | string) => void;
}

const ResetPropertyDialog: FC<EditPropertyProps> = props => {
  // Context
  const { fetchCollection } = useContext(dataContext);
  const { handleCloseDialog } = useContext(rootContext);
  // Props
  const { cb, target, type, property } = props;

  // UI 事件处理
  const handleDelete = async () => {
    switch (type) {
      case 'collection':
        const collection = target as CollectionObject;
        if (!collection || !collection.schema) {
          return;
        }
        // 将 Collection Schema 中的该属性重置为空
        await CollectionService.setProperty(collection.collection_name, {
          [property.key]: '',
        });
        // 刷新 Collection 以获取最新的 Schema
        await fetchCollection((target as CollectionObject).collection_name);
        break;

      case 'database':
        await DatabaseService.setProperty({
          db_name: target as string,
          properties: { [property.key]: '' },
        });
        break;
    }

    handleCloseDialog();
    cb && (await cb(target));
  };

  // 国际化
  const { t: btnTrans } = useTranslation('btn');
  const { t: dialogTrans } = useTranslation('dialog');

  return (
    <DeleteTemplate
      label={btnTrans('reset')}
      title={dialogTrans('resetPropertyTitle')}
      text={dialogTrans('resetPropertyInfo')}
      compare={property.key}
      handleDelete={handleDelete}
    />
  );
};

export default ResetPropertyDialog;
