import {
  EditorView,
  Decoration,
  DecorationSet,
  keymap,
  WidgetType,
} from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import { insertTab } from '@codemirror/commands';

// 使用 ReturnType<typeof setTimeout> 以获得正确的 timeout 类型
type Timeout = ReturnType<typeof setTimeout>;

// 通过继承 WidgetType 定义自定义 widget
class GhostTextWidget extends WidgetType {
  constructor(private text: string) {
    super();
  }

  eq(other: GhostTextWidget): boolean {
    return this.text === other.text;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.textContent = this.text;
    span.style.color = '#999';
    span.style.fontStyle = 'italic';
    return span;
  }
}

let timeout: Timeout | null = null; // 将类型改为 Timeout | null
let ghostText: { from: number; to: number; text: string } | null = null;

const addGhostText =
  StateEffect.define<{ from: number; to: number; text: string }>();
const removeGhostText = StateEffect.define<DecorationSet>();

// 创建 StateField 用于存储 ghost text
const ghostTextField = StateField.define({
  create() {
    return Decoration.none; // 初始时没有任何 decoration
  },
  update(value, tr) {
    // 初始时没有任何 decoration
    for (const effect of tr.effects) {
      if (effect.is(addGhostText)) {
        const { from, to, text } = effect.value;
        const widget = Decoration.widget({
          widget: new GhostTextWidget(text),
          side: 1,
        });
        // 返回包含新 widget 的 DecorationSet
        return Decoration.set(widget.range(from));
      } else if (effect.is(removeGhostText)) {
        return Decoration.none; // 清除所有 decoration
      }
    }
    return value;
  },
});

// 定义自动补全扩展
export const tabCompletion = [
  EditorView.updateListener.of(update => {
    if (update.docChanged) {
      if (timeout) clearTimeout(timeout);
      if (ghostText) {
        update.view.dispatch({
          effects: removeGhostText.of(Decoration.none),
        });
        ghostText = null;
      }

      timeout = setTimeout(() => {
        const cursorPos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(cursorPos);
        const textBeforeCursor = line.text.slice(0, cursorPos - line.from);

        if (textBeforeCursor.endsWith('fun')) {
          ghostText = {
            from: cursorPos,
            to: cursorPos,
            text: 'ction',
          };

          update.view.dispatch({
            effects: addGhostText.of(ghostText),
          });
        }
      }, 300);
    }
  }),
  ghostTextField,
  EditorView.decorations.compute([ghostTextField], state => {
    return state.field(ghostTextField);
  }),
  keymap.of([
    {
      key: 'Tab',
      run: view => {
        if (ghostText) {
          view.dispatch({
            changes: {
              from: ghostText.from,
              to: ghostText.to,
              insert: ghostText.text,
            },
            selection: {
              anchor: ghostText.from + ghostText.text.length,
              head: ghostText.from + ghostText.text.length,
            },
            effects: removeGhostText.of(Decoration.none),
          });
          ghostText = null;
          return true;
        } else {
          return insertTab(view);
        }
      },
    },
  ]),
];
