import {
  combineConfig,
  MapMode,
  Facet,
  Extension,
  EditorState,
  RangeValue,
  RangeSet,
  RangeCursor,
} from '@codemirror/state';
import {
  BlockInfo,
  BlockType,
  Direction,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { EditorView } from 'codemirror';

/// 一个 gutter marker 表示挂在某一行、某个 gutter 上的一点信息。
/// 自定义 marker 必须继承该类。
export abstract class GutterMarker extends RangeValue {
  /// @internal
  compare(other: GutterMarker) {
    return (
      this == other || (this.constructor == other.constructor && this.eq(other))
    );
  }

  /// 将该 marker 与同类型的另一个 marker 比较。
  eq(other: GutterMarker): boolean {
    return false;
  }

  /// 渲染该 marker 的 DOM 节点（如果有）。
  toDOM?(view: EditorView): Node;

  /// 该属性可用于给承载此 marker 的 gutter 元素添加 CSS class。
  elementClass!: string;

  /// 当 marker 有 `toDOM` 方法且其表示已从 gutter 中移除时调用。
  destroy(dom: Node) {}
}

GutterMarker.prototype.elementClass = '';
GutterMarker.prototype.toDOM = undefined;
GutterMarker.prototype.mapMode = MapMode.TrackBefore;
GutterMarker.prototype.startSide = GutterMarker.prototype.endSide = -1;
GutterMarker.prototype.point = true;

/// 用于给指定行的所有 gutter 元素添加 class 的 Facet。
/// 传给该 Facet 的 marker 应 _只_ 定义
/// [`elementclass`](#view.GutterMarker.elementClass)，而不要定义
/// [`toDOM`](#view.GutterMarker.toDOM)（否则该 marker 会出现在
/// 该行的所有 gutter 中）。
export const gutterLineClass = Facet.define<RangeSet<GutterMarker>>();

/// 用于给 widget 旁的所有 gutter 元素添加 class 的 Facet。
/// 不应提供带 `toDOM` 方法的 widget。
export const gutterWidgetClass =
  Facet.define<
    (
      view: EditorView,
      widget: WidgetType,
      block: BlockInfo
    ) => GutterMarker | null
  >();

type Handlers = {
  [event: string]: (view: EditorView, line: BlockInfo, event: Event) => boolean;
};

interface GutterConfig {
  /// 额外加到包装元素（`cm-gutter`）上的 CSS class。
  class?: string;
  /// 控制是否渲染空的 gutter 元素。
  /// 默认为 false。
  renderEmptyElements?: boolean;
  /// 获取该 gutter 要使用的一组 marker。
  markers?: (
    view: EditorView
  ) => RangeSet<GutterMarker> | readonly RangeSet<GutterMarker>[];
  /// 可用于给每一行可选地添加一个 marker。
  lineMarker?: (
    view: EditorView,
    line: BlockInfo,
    otherMarkers: readonly GutterMarker[]
  ) => GutterMarker | null;
  /// 把 marker 与文档中的 block widget 关联起来。
  widgetMarker?: (
    view: EditorView,
    widget: WidgetType,
    block: BlockInfo
  ) => GutterMarker | null;
  /// 如果行 marker 或 widget marker 依赖额外状态、需要在状态变化时更新，
  /// 就在这里传入一个判定函数，用来检查某次 view 更新是否可能改变行 marker。
  lineMarkerChange?: null | ((update: ViewUpdate) => boolean);
  /// 添加一个隐藏的占位元素，用于撑出 gutter 的基础宽度。
  initialSpacer?: null | ((view: EditorView) => GutterMarker);
  /// view 更新时同步更新占位元素。
  updateSpacer?:
    | null
    | ((spacer: GutterMarker, update: ViewUpdate) => GutterMarker);
  /// 为该 gutter 上的 DOM 事件提供事件处理函数。
  domEventHandlers?: Handlers;
}

const defaults = {
  class: '',
  renderEmptyElements: false,
  elementStyle: '',
  markers: () => RangeSet.empty,
  lineMarker: () => null,
  widgetMarker: () => null,
  lineMarkerChange: null,
  initialSpacer: null,
  updateSpacer: null,
  domEventHandlers: {},
};

const activeGutters = Facet.define<Required<GutterConfig>>();

/// 定义一个编辑器 gutter。gutter 的显示顺序
/// 由它们的 extension 优先级决定。
export function gutter(config: GutterConfig): Extension {
  return [gutters(), activeGutters.of({ ...defaults, ...config })];
}

const unfixGutters = Facet.define<boolean, boolean>({
  combine: values => values.some(x => x),
});

/// 添加 gutter 时会自动启用 gutter 绘制插件，但你也可以用这个函数
/// 显式配置它。
///
/// 除非把 `fixed` 显式设为 `false`，否则 gutter 是固定的，
/// 即不会随内容水平滚动（Internet Explorer 除外，它不支持
/// CSS [`position:
/// sticky`](https://developer.mozilla.org/en-US/docs/Web/CSS/position#sticky)）。
export function gutters(config?: { fixed?: boolean }): Extension {
  let result: Extension[] = [gutterView];
  if (config && config.fixed === false) result.push(unfixGutters.of(true));
  return result;
}

const gutterView = ViewPlugin.fromClass(
  class {
    gutters: SingleGutterView[];
    dom: HTMLElement;
    fixed: boolean;
    prevViewport: { from: number; to: number };

    constructor(readonly view: EditorView) {
      this.prevViewport = view.viewport;
      this.dom = document.createElement('div');
      this.dom.className = 'cm-gutters';
      this.dom.setAttribute('aria-hidden', 'true');
      this.dom.style.minHeight =
        this.view.contentHeight / this.view.scaleY + 'px';
      this.gutters = view.state
        .facet(activeGutters)
        .map(conf => new SingleGutterView(view, conf));
      for (let gutter of this.gutters) this.dom.appendChild(gutter.dom);
      this.fixed = !view.state.facet(unfixGutters);
      if (this.fixed) {
        // FIXME IE11 的兜底方案：它不支持 position: sticky，
        // 可改用 position: relative + 事件处理函数来重新对齐
        // gutter（或者干脆在 IE11 上强制 fixed=false？）
        this.dom.style.position = 'sticky';
      }
      this.syncGutters(false);
      view.scrollDOM.insertBefore(this.dom, view.contentDOM);
    }

    update(update: ViewUpdate) {
      if (this.updateGutters(update)) {
        // viewport 变化较大时（例如滚动过程中）同步前先 detach，
        // 因为对大规模更新来说这样更快。
        let vpA = this.prevViewport,
          vpB = update.view.viewport;
        let vpOverlap = Math.min(vpA.to, vpB.to) - Math.max(vpA.from, vpB.from);
        this.syncGutters(vpOverlap < (vpB.to - vpB.from) * 0.8);
      }
      if (update.geometryChanged) {
        this.dom.style.minHeight =
          this.view.contentHeight / this.view.scaleY + 'px';
      }
      if (this.view.state.facet(unfixGutters) != !this.fixed) {
        this.fixed = !this.fixed;
        this.dom.style.position = this.fixed ? 'sticky' : '';
      }
      this.prevViewport = update.view.viewport;
    }

    syncGutters(detach: boolean) {
      let after = this.dom.nextSibling;
      if (detach) this.dom.remove();
      let lineClasses = RangeSet.iter(
        this.view.state.facet(gutterLineClass),
        this.view.viewport.from
      );
      let classSet: GutterMarker[] = [];
      let contexts = this.gutters.map(
        gutter =>
          new UpdateContext(
            gutter,
            this.view.viewport,
            -this.view.documentPadding.top
          )
      );
      for (let line of this.view.viewportLineBlocks) {
        if (classSet.length) classSet = [];
        if (Array.isArray(line.type)) {
          let first = true;
          for (let b of line.type) {
            if (b.type == BlockType.Text && first) {
              advanceCursor(lineClasses, classSet, b.from);
              for (let cx of contexts) cx.line(this.view, b, classSet);
              first = false;
            } else if (b.widget) {
              for (let cx of contexts) cx.widget(this.view, b);
            }
          }
        } else if (line.type == BlockType.Text) {
          advanceCursor(lineClasses, classSet, line.from);
          for (let cx of contexts) cx.line(this.view, line, classSet);
        } else if (line.widget) {
          for (let cx of contexts) cx.widget(this.view, line);
        }
      }
      for (let cx of contexts) cx.finish();
      if (detach) this.view.scrollDOM.insertBefore(this.dom, after);
    }

    updateGutters(update: ViewUpdate) {
      let prev = update.startState.facet(activeGutters),
        cur = update.state.facet(activeGutters);
      let change =
        update.docChanged ||
        update.heightChanged ||
        update.viewportChanged ||
        !RangeSet.eq(
          update.startState.facet(gutterLineClass),
          update.state.facet(gutterLineClass),
          update.view.viewport.from,
          update.view.viewport.to
        );
      if (prev == cur) {
        for (let gutter of this.gutters)
          if (gutter.update(update)) change = true;
      } else {
        change = true;
        let gutters = [];
        for (let conf of cur) {
          let known = prev.indexOf(conf);
          if (known < 0) {
            gutters.push(new SingleGutterView(this.view, conf));
          } else {
            this.gutters[known].update(update);
            gutters.push(this.gutters[known]);
          }
        }
        for (let g of this.gutters) {
          g.dom.remove();
          if (gutters.indexOf(g) < 0) g.destroy();
        }
        for (let g of gutters) this.dom.appendChild(g.dom);
        this.gutters = gutters;
      }
      return change;
    }

    destroy() {
      for (let view of this.gutters) view.destroy();
      this.dom.remove();
    }
  },
  {
    provide: plugin =>
      EditorView.scrollMargins.of(view => {
        let value = view.plugin(plugin);
        if (!value || value.gutters.length == 0 || !value.fixed) return null;
        return view.textDirection == Direction.LTR
          ? { left: value.dom.offsetWidth * view.scaleX }
          : { right: value.dom.offsetWidth * view.scaleX };
      }),
  }
);

function asArray<T>(val: T | readonly T[]) {
  return (Array.isArray(val) ? val : [val]) as readonly T[];
}

function advanceCursor(
  cursor: RangeCursor<GutterMarker>,
  collect: GutterMarker[],
  pos: number
) {
  while (cursor.value && cursor.from <= pos) {
    if (cursor.from == pos) collect.push(cursor.value);
    cursor.next();
  }
}

class UpdateContext {
  cursor: RangeCursor<GutterMarker>;
  i = 0;

  constructor(
    readonly gutter: SingleGutterView,
    viewport: { from: number; to: number },
    public height: number
  ) {
    this.cursor = RangeSet.iter(gutter.markers, viewport.from);
  }

  addElement(
    view: EditorView,
    block: BlockInfo,
    markers: readonly GutterMarker[]
  ) {
    let { gutter } = this,
      above = (block.top - this.height) / view.scaleY,
      height = block.height / view.scaleY;
    if (this.i == gutter.elements.length) {
      let newElt = new GutterElement(view, height, above, markers);
      gutter.elements.push(newElt);
      gutter.dom.appendChild(newElt.dom);
    } else {
      gutter.elements[this.i].update(view, height, above, markers);
    }
    this.height = block.bottom;
    this.i++;
  }

  line(
    view: EditorView,
    line: BlockInfo,
    extraMarkers: readonly GutterMarker[]
  ) {
    let localMarkers: GutterMarker[] = [];
    advanceCursor(this.cursor, localMarkers, line.from);
    if (extraMarkers.length) localMarkers = localMarkers.concat(extraMarkers);
    let forLine = this.gutter.config.lineMarker(view, line, localMarkers);
    if (forLine) localMarkers.unshift(forLine);

    let gutter = this.gutter;
    if (localMarkers.length == 0 && !gutter.config.renderEmptyElements) return;
    this.addElement(view, line, localMarkers);
  }

  widget(view: EditorView, block: BlockInfo) {
    let marker = this.gutter.config.widgetMarker(view, block.widget!, block),
      markers = marker ? [marker] : null;
    for (let cls of view.state.facet(gutterWidgetClass)) {
      let marker = cls(view, block.widget!, block);
      if (marker) (markers || (markers = [])).push(marker);
    }
    if (markers) this.addElement(view, block, markers);
  }

  finish() {
    let gutter = this.gutter;
    while (gutter.elements.length > this.i) {
      let last = gutter.elements.pop()!;
      gutter.dom.removeChild(last.dom);
      last.destroy();
    }
  }
}

class SingleGutterView {
  dom: HTMLElement;
  elements: GutterElement[] = [];
  markers: readonly RangeSet<GutterMarker>[];
  spacer: GutterElement | null = null;

  constructor(public view: EditorView, public config: Required<GutterConfig>) {
    this.dom = document.createElement('div');
    this.dom.className =
      'cm-gutter' + (this.config.class ? ' ' + this.config.class : '');
    for (let prop in config.domEventHandlers) {
      this.dom.addEventListener(prop, (event: Event) => {
        let target = event.target as HTMLElement,
          y;
        if (target != this.dom && this.dom.contains(target)) {
          while (target.parentNode != this.dom)
            target = target.parentNode as HTMLElement;
          let rect = target.getBoundingClientRect();
          y = (rect.top + rect.bottom) / 2;
        } else {
          y = (event as MouseEvent).clientY;
        }
        let line = view.lineBlockAtHeight(y - view.documentTop);
        if (config.domEventHandlers[prop](view, line, event))
          event.preventDefault();
      });
    }
    this.markers = asArray(config.markers(view));
    if (config.initialSpacer) {
      this.spacer = new GutterElement(view, 0, 0, [config.initialSpacer(view)]);
      this.dom.appendChild(this.spacer.dom);
      this.spacer.dom.style.cssText +=
        'visibility: hidden; pointer-events: none';
    }
  }

  update(update: ViewUpdate) {
    let prevMarkers = this.markers;
    this.markers = asArray(this.config.markers(update.view));
    if (this.spacer && this.config.updateSpacer) {
      let updated = this.config.updateSpacer(this.spacer.markers[0], update);
      if (updated != this.spacer.markers[0])
        this.spacer.update(update.view, 0, 0, [updated]);
    }
    let vp = update.view.viewport;
    return (
      !RangeSet.eq(this.markers, prevMarkers, vp.from, vp.to) ||
      (this.config.lineMarkerChange
        ? this.config.lineMarkerChange(update)
        : false)
    );
  }

  destroy() {
    for (let elt of this.elements) elt.destroy();
  }
}

class GutterElement {
  dom: HTMLElement;
  height: number = -1;
  above: number = 0;
  markers: readonly GutterMarker[] = [];

  constructor(
    view: EditorView,
    height: number,
    above: number,
    markers: readonly GutterMarker[]
  ) {
    this.dom = document.createElement('div');
    this.dom.className = 'cm-gutterElement';
    this.update(view, height, above, markers);
  }

  customMarkers = (markers: readonly GutterMarker[], view: EditorView) => {
    for (let marker of markers) {
      if (marker instanceof NumberMarker) {
        try {
          const text = view.state.doc.line(Number(marker.number)).text.trim();
          if (
            text.startsWith('POST') ||
            text.startsWith('GET') ||
            text.startsWith('PUT') ||
            text.startsWith('DELETE')
          ) {
            this.dom.classList.add('cm-codelens-marker');
          } else {
            this.dom.classList.remove('cm-codelens-marker');
          }
        } catch (err) {}
      }
    }
  };

  update(
    view: EditorView,
    height: number,
    above: number,
    markers: readonly GutterMarker[]
  ) {
    if (this.height != height) {
      this.height = height;
      this.dom.style.height = height + 'px';
    }
    if (this.above != above)
      this.dom.style.marginTop = (this.above = above) ? above + 'px' : '';

    this.customMarkers(markers, view);

    if (!sameMarkers(this.markers, markers)) this.setMarkers(view, markers);
  }

  setMarkers(view: EditorView, markers: readonly GutterMarker[]) {
    let cls = 'cm-gutterElement',
      domPos = this.dom.firstChild;
    for (let iNew = 0, iOld = 0; ; ) {
      let skipTo = iOld,
        marker = iNew < markers.length ? markers[iNew++] : null,
        matched = false;
      if (marker) {
        let c = marker.elementClass;
        if (c) cls += ' ' + c;
        for (let i = iOld; i < this.markers.length; i++)
          if (this.markers[i].compare(marker)) {
            skipTo = i;
            matched = true;
            break;
          }
      } else {
        skipTo = this.markers.length;
      }
      while (iOld < skipTo) {
        let next = this.markers[iOld++];
        if (next.toDOM) {
          next.destroy(domPos!);
          let after = domPos!.nextSibling;
          domPos!.remove();
          domPos = after;
        }
      }
      if (!marker) break;
      if (marker.toDOM) {
        if (matched) domPos = domPos!.nextSibling;
        else this.dom.insertBefore(marker.toDOM(view), domPos);
      }
      if (matched) iOld++;
    }
    this.dom.className = cls;

    this.customMarkers(markers, view);

    this.markers = markers;
  }

  destroy() {
    this.setMarkers(null as any, []); // 除非要创建 marker，否则不使用第一个参数
  }
}

function sameMarkers(
  a: readonly GutterMarker[],
  b: readonly GutterMarker[]
): boolean {
  if (a.length != b.length) return false;
  for (let i = 0; i < a.length; i++) if (!a[i].compare(b[i])) return false;
  return true;
}

interface LineNumberConfig {
  /// 如何显示行号。默认只是把行号转成字符串。
  formatNumber?: (lineNo: number, state: EditorState) => string;
  /// 为该 gutter 上的 DOM 事件提供事件处理函数。
  domEventHandlers?: Handlers;
}

/// 用于为行号 gutter 提供 marker 的 Facet。
export const lineNumberMarkers = Facet.define<RangeSet<GutterMarker>>();

/// 用于在行号 gutter 中紧邻 widget 创建 marker 的 Facet。
export const lineNumberWidgetMarker =
  Facet.define<
    (
      view: EditorView,
      widget: WidgetType,
      block: BlockInfo
    ) => GutterMarker | null
  >();

const lineNumberConfig = Facet.define<
  LineNumberConfig,
  Required<LineNumberConfig>
>({
  combine(values) {
    return combineConfig<Required<LineNumberConfig>>(
      values,
      { formatNumber: String, domEventHandlers: {} },
      {
        domEventHandlers(a: Handlers, b: Handlers) {
          let result: Handlers = Object.assign({}, a);
          for (let event in b) {
            let exists = result[event],
              add = b[event];
            result[event] = exists
              ? (view, line, event) =>
                  exists(view, line, event) || add(view, line, event)
              : add;
          }
          return result;
        },
      }
    );
  },
});

class NumberMarker extends GutterMarker {
  constructor(readonly number: string) {
    super();
  }

  eq(other: NumberMarker) {
    return this.number == other.number;
  }

  toDOM() {
    return document.createTextNode(this.number);
  }
}

function formatNumber(view: EditorView, number: number) {
  return view.state.facet(lineNumberConfig).formatNumber(number, view.state);
}

const lineNumberGutter = activeGutters.compute([lineNumberConfig], state => ({
  class: 'cm-lineNumbers',
  renderEmptyElements: false,
  markers(view: EditorView) {
    return view.state.facet(lineNumberMarkers);
  },
  lineMarker(view, line, others) {
    if (others.some(m => m.toDOM)) return null;
    return new NumberMarker(
      formatNumber(view, view.state.doc.lineAt(line.from).number)
    );
  },
  widgetMarker: (view, widget, block) => {
    for (let m of view.state.facet(lineNumberWidgetMarker)) {
      let result = m(view, widget, block);
      if (result) return result;
    }
    return null;
  },
  lineMarkerChange: update =>
    update.startState.facet(lineNumberConfig) !=
    update.state.facet(lineNumberConfig),
  initialSpacer(view: EditorView) {
    return new NumberMarker(
      formatNumber(view, maxLineNumber(view.state.doc.lines))
    );
  },
  updateSpacer(spacer: GutterMarker, update: ViewUpdate) {
    let max = formatNumber(
      update.view,
      maxLineNumber(update.view.state.doc.lines)
    );
    return max == (spacer as NumberMarker).number
      ? spacer
      : new NumberMarker(max);
  },
  domEventHandlers: state.facet(lineNumberConfig).domEventHandlers,
}));

/// 创建行号 gutter extension。
export function lineNumbers(config: LineNumberConfig = {}): Extension {
  return [lineNumberConfig.of(config), gutters(), lineNumberGutter];
}

function maxLineNumber(lines: number) {
  let last = 9;
  while (last < lines) last = last * 10 + 9;
  return last;
}

const activeLineGutterMarker = new (class extends GutterMarker {
  elementClass = 'cm-activeLineGutter';
})();

const activeLineGutterHighlighter = gutterLineClass.compute(
  ['selection'],
  state => {
    let marks = [],
      last = -1;
    for (let range of state.selection.ranges) {
      let linePos = state.doc.lineAt(range.head).from;
      if (linePos > last) {
        last = linePos;
        marks.push(activeLineGutterMarker.range(linePos));
      }
    }
    return RangeSet.of(marks);
  }
);

/// 返回一个 extension，给[当前活动
/// 行](#view.highlightActiveLine)上的所有 gutter 元素添加 `cm-activeLineGutter` class。
export function highlightActiveLineGutter() {
  return activeLineGutterHighlighter;
}
