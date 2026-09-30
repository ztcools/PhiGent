import React, { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import icons from '../icons/Icons';

const MediaPreview = (props: { value: string }) => {
  const { value } = props;
  const [showImage, setShowImage] = useState(false);
  const [image, setImage] = useState('');
  const [showImageStyle, setShowImageStyle] = useState({});
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [imageCache, setImageCache] = useState<Map<string, HTMLImageElement>>(
    new Map()
  );
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (isImageSource(value)) {
      setImage(value);
      setImageError(false); // 重置错误状态
      loadImageWithCache(value);
    }
  }, [value]);

  // 组件卸载或缓存过大时清理缓存
  useEffect(() => {
    const cleanupCache = () => {
      if (imageCache.size > 50) {
        // 缓存上限 50 张图片
        const entries = Array.from(imageCache.entries());
        const newCache = new Map(entries.slice(-30)); // 保留最近 30 张图片
        setImageCache(newCache);
      }
    };

    cleanupCache();
  }, [imageCache.size]);

  // 卸载时清理
  useEffect(() => {
    return () => {
      setImageCache(new Map());
    };
  }, []);

  const loadImageWithCache = (imageSrc: string) => {
    // console.log('Loading image:', imageSrc); // Debug log

    // 检查图片是否已经缓存
    if (imageCache.has(imageSrc)) {
      const cachedImg = imageCache.get(imageSrc)!;
      setImageDimensions({
        width: cachedImg.naturalWidth,
        height: cachedImg.naturalHeight,
      });
      // console.log(
      //   'Image loaded from cache:',
      //   cachedImg.naturalWidth,
      //   'x',
      //   cachedImg.naturalHeight
      // );
      return;
    }

    // 创建 Image 对象以获取原始尺寸，并配合缓存
    const img = new Image();

    // 外部图片不设置 crossOrigin，避免 CORS 问题
    // 只要服务端允许，浏览器会自动处理 CORS

    img.onload = () => {
      // console.log(
      //   'Image loaded successfully:',
      //   img.naturalWidth,
      //   'x',
      //   img.naturalHeight
      // );
      // 缓存已加载的图片
      setImageCache(prev => new Map(prev).set(imageSrc, img));

      setImageDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      // console.warn('Failed to load image:', imageSrc);
      setImageError(true);
      // 图片加载失败时使用默认尺寸
      setImageDimensions({
        width: 200,
        height: 200,
      });
    };

    // 先绑定事件回调，再设置 src
    img.src = imageSrc;
  };

  const handleMouseOver = (e: React.MouseEvent) => {
    // 有动态尺寸就用动态尺寸，否则用默认值
    const maxDimension = 200;
    let imageWidth = maxDimension;
    let imageHeight = maxDimension;

    if (imageDimensions.width > 0 && imageDimensions.height > 0) {
      const aspectRatio = imageDimensions.width / imageDimensions.height;

      if (
        imageDimensions.width > maxDimension ||
        imageDimensions.height > maxDimension
      ) {
        if (aspectRatio > 1) {
          // 横图
          imageWidth = maxDimension;
          imageHeight = maxDimension / aspectRatio;
        } else {
          // 竖图或方图
          imageHeight = maxDimension;
          imageWidth = maxDimension * aspectRatio;
        }
      } else {
        // 在限制范围内就使用原始尺寸
        imageWidth = imageDimensions.width;
        imageHeight = imageDimensions.height;
      }
    }

    const offset = 10; // 小幅偏移，让图片紧贴光标

    // 计算初始位置
    let left = e.clientX + offset - imageWidth / 2;
    let top = e.clientY - imageHeight - 20;

    // 保证图片不超出视口边界
    if (left + imageWidth > window.innerWidth) {
      left = e.clientX - imageWidth - offset;
    }
    if (left < 0) {
      left = offset;
    }
    if (top + imageHeight > window.innerHeight) {
      top = window.innerHeight - imageHeight - offset;
    }
    if (top < 0) {
      top = offset;
    }

    if (image) {
      setShowImage(true);
      setShowImageStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 1000,
        pointerEvents: 'none',
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        minWidth: '50px',
        minHeight: '50px',
      });
    }
  };

  const handleMouseOut = () => {
    setShowImage(false);
  };

  const isImg = isImageSource(value);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        onMouseMove={handleMouseOver}
        onMouseOut={handleMouseOut}
        style={isImg ? { cursor: 'pointer' } : {}}
      >
        {isImg ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <icons.img />
            <Typography variant="mono" component="p" title={String(value)}>
              <a href={value} target="_blank" rel="noopener noreferrer">
                {value}
              </a>
            </Typography>
          </div>
        ) : (
          <Typography variant="mono" component="p" title={String(value)}>
            {value}
          </Typography>
        )}
      </div>
      {showImage && image && (
        <div style={showImageStyle}>
          {imageError ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: '#666',
                fontSize: '12px',
                minWidth: '150px',
                minHeight: '100px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div>
                <div>⚠️ 图片无法加载</div>
                <div style={{ marginTop: '8px', fontSize: '11px' }}>
                  可能是跨域限制
                </div>
                <div style={{ marginTop: '4px', fontSize: '11px' }}>
                  点击链接查看原图
                </div>
              </div>
            </div>
          ) : (
            <img
              src={image}
              alt="preview"
              style={{
                maxWidth: '200px',
                maxHeight: '200px',
                width: 'auto',
                height: 'auto',
                display: 'block',
                borderRadius: '2px',
                minWidth: '50px',
                minHeight: '50px',
              }}
              onLoad={e => {
                // console.log(
                //   'Preview image loaded:',
                //   e.currentTarget.naturalWidth,
                //   'x',
                //   e.currentTarget.naturalHeight
                // );
              }}
              onError={e => {
                console.warn('Failed to display image:', image);
                setImageError(true);
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

// 辅助函数：判断该值是否为 URL 或 Base64 编码的图片
function isImageSource(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const urlPattern = /\.(jpeg|jpg|gif|png|bmp|webp|svg)$/i;
  const base64Pattern =
    /^data:image\/(png|jpeg|jpg|gif|bmp|webp|svg\+xml);base64,/i;
  return urlPattern.test(value) || base64Pattern.test(value);
}

export default MediaPreview;
