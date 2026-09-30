import { ReactElement, useContext } from 'react';
import { rootContext } from '@/context';

export const useInsertDialogHook = () => {
  const { setDialog } = useContext(rootContext);

  const handleInsertDialog = (
    // 步骤容器，包含所有内容
    component: ReactElement
  ) => {
    setDialog({
      open: true,
      type: 'custom',
      params: {
        component,
      },
    });
  };

  return {
    handleInsertDialog,
  };
};
