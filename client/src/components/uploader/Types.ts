import { FILE_MIME_TYPE } from '@/consts';

export interface UploaderProps {
  label: string;
  accept: string;
  btnClass?: string;
  disabled?: boolean;
  disableTooltip?: string;
  // 单位应为字节
  maxSize?: number;
  // 上传文件超过大小限制时的 snackbar 提示
  overSizeWarning?: string;
  setFileName: (fileName: string) => void;
  // 处理 uploader 上传完成
  handleUploadedData: (
    data: string,
    uploader: HTMLFormElement,
    type: FILE_MIME_TYPE
  ) => void;
  // 处理 uploader 的 onchange
  handleUploadFileChange?: (file: File, uploader: HTMLFormElement) => void;
  handleUploadError?: () => void;
}
