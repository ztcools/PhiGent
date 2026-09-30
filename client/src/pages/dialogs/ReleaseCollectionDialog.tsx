import { useContext, useState } from 'react';
import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import DialogTemplate from '@/components/customDialog/DialogTemplate';
import { rootContext, dataContext } from '@/context';
import type { CollectionObject } from '@server/types';
import { CollectionService } from '@/http';

const ReleaseCollectionDialog = (props: {
  collection: CollectionObject;
  onRelease?: (collection: CollectionObject) => void;
}) => {
  const { fetchCollection } = useContext(dataContext);

  const { collection, onRelease } = props;
  const { t: dialogTrans } = useTranslation('dialog');
  const { t: btnTrans } = useTranslation('btn');
  const { t: successTrans } = useTranslation('success');
  const { t: collectionTrans } = useTranslation('collection');
  const { handleCloseDialog, openSnackBar } = useContext(rootContext);
  const [disabled, setDisabled] = useState(false);

  // 确认操作
  const handleConfirm = async () => {
    // 禁用确认按钮
    setDisabled(true);
    try {
      // 释放 Collection
      await CollectionService.releaseCollection(collection.collection_name);

      // 刷新 Collection
      await fetchCollection(collection.collection_name);

      // 显示成功提示
      openSnackBar(
        successTrans('release', {
          name: collectionTrans('collection'),
        })
      );

      // 执行回调
      onRelease && (await onRelease(collection));
      // 启用确认按钮
      setDisabled(false);
      // 关闭对话框
      handleCloseDialog();
    } finally {
      // 启用确认按钮
      setDisabled(false);
    }
  };

  return (
    <DialogTemplate
      title={dialogTrans('releaseTitle', {
        type: collection.collection_name,
      })}
      handleClose={handleCloseDialog}
      children={
        <>
          <Typography
            variant="body1"
            component="p"
            sx={{
              margin: '8px 0 16px 0',
              maxWidth: 480,
              color: (theme) => theme.palette.text.secondary,
            }}
          >
            {dialogTrans('releaseContent', {
              type: collection.collection_name,
            })}
          </Typography>
        </>
      }
      confirmLabel={btnTrans('release')}
      handleConfirm={handleConfirm}
      confirmDisabled={disabled}
    />
  );
};

export default ReleaseCollectionDialog;
