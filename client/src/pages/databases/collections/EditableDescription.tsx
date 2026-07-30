import React, { useState } from 'react';
import { Box, IconButton, TextField, Tooltip } from '@mui/material';
import icons from '@/components/icons/Icons';
import { CollectionService } from '@/http/Collection.service';
import type { CollectionObject } from '@server/types';

interface EditableDescriptionProps {
  collection: CollectionObject;
  onSaved?: () => void;
}

/**
 * description 内联编辑：点击文本变输入框，回车/失焦保存（调 alterCollectionProperties
 * 的 description 属性），Esc 取消。code collection 的 description 承载 identity
 * （codebasePath:<url>:<branch>），一般不应手改——对这类给出确认提示。
 */
const EditableDescription: React.FC<EditableDescriptionProps> = ({ collection, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(collection.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isCodeCollection = /^(hcc|cc)_/i.test(collection.collection_name);
  const EditIcon = icons.edit;
  const display = collection.description || '--';

  const savingRef = React.useRef(false);
  const save = async () => {
    // Enter 触发一次后 onBlur 会再触发 —— 用 ref 防重复提交
    if (savingRef.current) return;
    if (value === (collection.description || '')) {
      setEditing(false);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await CollectionService.setProperty(collection.collection_name, {
        'collection.description': value,
      });
      setEditing(false);
      onSaved?.();
    } catch (e: any) {
      setError(e?.message || '保存失败');
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  if (!editing) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          maxWidth: 260,
          cursor: 'text',
          '&:hover .edit-icon': { opacity: 1 },
        }}
        onClick={() => {
          setValue(collection.description || '');
          setEditing(true);
        }}
        title={isCodeCollection ? `${display}\n（code collection，description 承载索引 identity，谨慎修改）` : display}
      >
        <Box
          component="span"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: collection.description ? 'text.primary' : 'text.disabled',
          }}
        >
          {display}
        </Box>
        <IconButton
          size="small"
          className="edit-icon"
          sx={{ opacity: 0, transition: 'opacity 0.15s', ml: 0.5, p: 0.25 }}
        >
          <EditIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', maxWidth: 300 }}>
      <TextField
        size="small"
        variant="outlined"
        autoFocus
        fullWidth
        disabled={saving}
        value={value}
        error={Boolean(error)}
        helperText={error}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          } else if (e.key === 'Escape') {
            setEditing(false);
            setValue(collection.description || '');
          }
        }}
        inputProps={{ style: { fontSize: '0.85em', padding: '4px 8px' } }}
      />
    </Box>
  );
};

export default EditableDescription;
