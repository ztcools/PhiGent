import { lintGutter, linter, Diagnostic } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

export const milvusHttpLinter = [
  lintGutter(), // 启用 lint gutter 以显示错误标记
  linter((view: EditorView) => {
    const state = view.state;
    const tree = syntaxTree(state); // 获取当前文档的语法树

    // 存放 lint 诊断信息（错误/警告）的数组
    const diagnostics: Diagnostic[] = [];

    // 遍历语法树
    tree.iterate({
      enter(node) {
        if (node.type.isError) {
          // 获取错误节点的起止位置
          const from = node.from;
          const to = node.to;

          // 检查该行是否为空
          const line = state.doc.lineAt(from);
          if (line.length === 0) {
            return;
          }

          // 将错误加入诊断数组
          diagnostics.push({
            from,
            to,
            severity: 'error', // 设置严重级别（error/warning/info）
            message: 'Syntax error detected', // 待展示的错误信息
          });
        }
      },
    });

    // 返回需要在编辑器中展示的诊断列表
    return diagnostics;
  }),
];
