import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { insertTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { minimalSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { linter, Diagnostic } from '@codemirror/lint';
import { CollectionService } from '@/http';
import { DataTypeStringEnum } from '@/consts';
import { useTheme } from '@mui/material';
import { githubLight } from '@ddietr/codemirror-themes/github-light';
import { githubDark } from '@ddietr/codemirror-themes/github-dark';
import { Validator } from './utils';
import type { CollectionFullObject } from '@server/types';
import type { SearchSingleParams } from '../../types';
import { styled } from '@mui/material/styles';

const SearchInputBoxWrapper = styled('div')(({ theme }) => ({
  height: '124px',
  margin: 0,
  overflow: 'auto',
  backgroundColor: theme.palette.background.default,
  cursor: 'text',
}));

export type SearchInputBoxProps = {
  onChange: (anns_field: string, value: string) => void;
  searchParams: SearchSingleParams;
  collection: CollectionFullObject;
  type?: 'vector' | 'text';
};

let queryTimeout: NodeJS.Timeout;

export default function SearchInputBox(props: SearchInputBoxProps) {
  const theme = useTheme();
  const { t: searchTrans } = useTranslation('search');

  // 传入的 Props
  const { searchParams, onChange, collection, type } = props;
  const { field, data } = searchParams;

  // 引用
  const editorEl = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView>();
  const onChangeRef = useRef(onChange);
  const dataRef = useRef(data);
  const fieldRef = useRef(field);
  const searchParamsRef = useRef(searchParams);

  const themeCompartment = new Compartment();

  // 获取校验器
  const validator = Validator[field.data_type as keyof typeof Validator];

  useEffect(() => {
    // data 变化时更新 dataRef 与 onChangeRef
    dataRef.current = data;
    onChangeRef.current = onChange;
    fieldRef.current = field;
    searchParamsRef.current = searchParams;
  }, [JSON.stringify(searchParams), onChange]);

  const getVectorById = (text: string) => {
    if (queryTimeout) {
      clearTimeout(queryTimeout);
    }
    // 只搜索不含空格、逗号、方括号或花括号的文本
    if (!text.trim().match(/[\s,{}]/)) {
      const isVarChar =
        collection.schema.primaryField.data_type === DataTypeStringEnum.VarChar;

      if (!isVarChar && isNaN(Number(text))) {
        return;
      }

      queryTimeout = setTimeout(() => {
        try {
          CollectionService.queryData(collection.collection_name, {
            expr: isVarChar
              ? `${collection.schema.primaryField.name} == '${text}'`
              : `${collection.schema.primaryField.name} == ${text}`,
            output_fields: [searchParamsRef.current.anns_field],
          })
            .then(res => {
              if (res.data && res.data.length === 1) {
                onChangeRef.current(
                  searchParamsRef.current.anns_field,
                  JSON.stringify(
                    res.data[0][searchParamsRef.current.anns_field]
                  )
                );
              }
            })
            .catch(e => {
              console.log(0, e);
            });
        } catch (e) {}
      }, 300);
    }
  };

  // 创建编辑器
  useEffect(() => {
    if (!editor.current) {
      // 外部数据更新的超时处理
      let updateTimeout: NodeJS.Timeout;

      let extensions = [
        minimalSetup,
        placeholder(
          searchTrans(
            type === 'text' ? 'textPlaceHolder' : 'inputVectorPlaceHolder'
          )
        ),
        keymap.of([{ key: 'Tab', run: insertTab }]), // 修复 tab 行为
        indentUnit.of('    '), // 修复 tab 缩进
        EditorView.theme({
          '&.cm-editor': {
            '&.cm-focused': {
              outline: 'none',
            },
          },
          '.cm-content': {
            fontSize: '12px',
            fontFamily: 'IBM Plex Mono, monospace',
            minHeight: '124px',
          },
          '.cm-gutters': {
            display: 'none',
          },
        }),
        EditorView.lineWrapping,
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            if (queryTimeout || updateTimeout) {
              clearTimeout(queryTimeout);
              clearTimeout(updateTimeout);
            }

            updateTimeout = setTimeout(() => {
              // 获取文本
              const text = update.state.doc.toString();
              // 校验文本
              const { valid } = validator(text, fieldRef.current);
              // 校验通过则更新搜索参数
              if (valid || text === '' || type === 'text') {
                onChangeRef.current(searchParams.anns_field, text);
              } else {
                getVectorById(text);
              }
            }, 500);
          }
          if (update.focusChanged) {
            editorEl.current?.classList.toggle('focused', update.view.hasFocus);
          }
        }),
      ];

      if (type === 'vector') {
        extensions = [
          ...extensions,
          javascript(),

          linter(view => {
            const text = view.state.doc.toString();

            // 忽略空文本
            if (!text) return [];

            // 校验
            const { valid, message } = validator(text, field);

            // 校验不通过时画红线
            if (!valid) {
              let diagnostics: Diagnostic[] = [];

              diagnostics.push({
                from: 0,
                to: view.state.doc.line(view.state.doc.lines).to,
                severity: 'error',
                message: message,
                actions: [
                  {
                    name: 'Remove',
                    apply(view, from, to) {
                      view.dispatch({ changes: { from, to } });
                    },
                  },
                ],
              });

              return diagnostics;
            } else {
              // onChangeRef.current(searchParams.anns_field, value);
              return [];
            }
          }),
        ];
      }

      // 创建编辑器
      const startState = EditorState.create({
        doc: data,
        extensions,
      });

      // 创建编辑器视图
      const view = new EditorView({
        state: startState,
        parent: editorEl.current!,
      });

      // 设置编辑器引用
      editor.current = view;
    } else {
      if (editor.current.state.doc.toString() !== data) {
        editor.current.dispatch({
          changes: {
            from: 0,
            to: editor.current.state.doc.length,
            insert: data,
          },
        });
      }
    }

    return () => {};
  }, [JSON.stringify({ field, data })]);

  useEffect(() => {
    // 将暗色模式变更分发给编辑器
    if (editor.current) {
      editor.current.dispatch({
        effects: themeCompartment.reconfigure(
          themeCompartment.of(
            theme.palette.mode === 'light' ? githubLight : githubDark
          )
        ),
      });
    }
  }, [theme.palette.mode]);

  return <SearchInputBoxWrapper ref={editorEl}></SearchInputBoxWrapper>;
}
