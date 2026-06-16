import { App } from "obsidian";
import {
  Decoration,
  DecorationSet,
  WidgetType,
  EditorView,
} from "@codemirror/view";
import {
  StateField,
  Transaction,
  EditorState,
  RangeSetBuilder,
  Extension,
} from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { renderHtmlPreview } from "./htmlPreview";

class HtmlPreviewWidget extends WidgetType {
  constructor(
    private source: string,
    private app: App
  ) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const div = document.createElement("div");
    renderHtmlPreview(div, this.source, this.app);
    return div;
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof HtmlPreviewWidget &&
      other.source === this.source &&
      other.app === this.app
    );
  }

  get estimatedHeight(): number {
    return 500;
  }

  ignoreEvent(event: Event): boolean {
    return false;
  }
}

export function htmlPreviewExtension(app: App): Extension {
  return StateField.define<DecorationSet>({
    create(state: EditorState) {
      return buildDecorations(state, app);
    },
    update(value: DecorationSet, tr: Transaction) {
      if (tr.docChanged) {
        return buildDecorations(tr.state, app);
      }
      return value;
    },
    provide: f => EditorView.decorations.from(f),
  });
}

function buildDecorations(state: EditorState, app: App): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(state);

  tree.iterate({
    enter: node => {
      if (node.type.name !== "FencedCode") {
        return;
      }

      let language = "";
      let source = "";
      const cursor = node.node.cursor();

      if (cursor.firstChild()) {
        do {
          if (cursor.type.name === "CodeInfo") {
            language = state.doc.sliceString(cursor.from, cursor.to);
          } else if (cursor.type.name === "CodeText") {
            source = state.doc.sliceString(cursor.from, cursor.to);
          }
        } while (cursor.nextSibling());
      }

      if (language === "html-preview") {
        builder.add(
          node.from,
          node.to,
          Decoration.replace({
            widget: new HtmlPreviewWidget(source, app),
            block: true,
          })
        );
      }
    },
  });

  return builder.finish();
}
