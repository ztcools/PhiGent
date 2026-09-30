import { syntaxTree } from '@codemirror/language';
import { Range, RangeSetBuilder } from '@codemirror/state';
import { ViewPlugin, ViewUpdate } from '@codemirror/view';
import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
import { Text } from '@codemirror/state';

const requestHighlightLineDecoration = Decoration.line({
  class: 'milvus-http-request-highlight',
});

export const selectionDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.computeDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = this.computeDecorations(update.view);
      }
    }

    computeDecorations(view: EditorView) {
      const state = view.state;
      const doc = state.doc;
      const tree = syntaxTree(state);
      const cursor = state.selection.main.head;

      let nodeAtCursor = tree.resolve(cursor, -1);

      const builder = new RangeSetBuilder<Decoration>();

      let requestNode = null;

      while (nodeAtCursor) {
        if (nodeAtCursor.name === 'Request') {
          requestNode = nodeAtCursor;
          break;
        }
        if (!nodeAtCursor.parent) {
          break;
        }
        nodeAtCursor = nodeAtCursor.parent;
      }

      if (requestNode) {
        // 获取 request 节点的起止位置
        const from = requestNode.from;

        // 获取 URL 节点
        const urlNode = requestNode.getChild('URL')!;
        const bodyNode = requestNode.getChild('Body');

        // 若既无 URL 节点也无 Body 节点则直接返回
        if (!urlNode && !bodyNode) {
          return builder.finish();
        }

        // 获取 Body 节点或 URL 节点的结束位置
        const to = bodyNode ? bodyNode.to : urlNode.to;

        // 高亮整个 request 节点
        const lines = this.getLinesInRange(doc, from, to);

        lines.forEach(line => {
          builder.add(line.from, line.from, requestHighlightLineDecoration);
        });
      }

      return builder.finish();
    }

    getLinesInRange(doc: Text, from: number, to: number) {
      try {
        const lines = [];

        let startLine = doc.lineAt(from);
        let endLine = doc.lineAt(to);

        for (let i = startLine.number; i <= endLine.number; i++) {
          const line = doc.line(i);
          lines.push(line);
        }

        return lines;
      } catch (error) {
        return [];
      }
    }
  },
  {
    decorations: v => v.decorations,
  }
);

const tokenClass = Decoration.mark({ class: 'token-node' });
export const highlightTokens = EditorView.decorations.compute(
  ['doc'],
  state => {
    const decorations: Range<Decoration>[] = [];
    const tree = syntaxTree(state);

    tree.iterate({
      enter(node) {
        if (node.name === 'Authorization') {
          decorations.push(tokenClass.range(node.from, node.to));
        }
      },
    });

    return Decoration.set(decorations);
  }
);
