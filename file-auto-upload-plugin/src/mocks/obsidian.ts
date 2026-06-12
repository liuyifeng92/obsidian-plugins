export class App {
  workspace = {
    getActiveFile: () => ({ path: "mock/path" }),
    getActiveViewOfType: () => ({
      editor: {
        getValue: () => "",
        setValue: (value: string) => {},
        getScrollInfo: () => ({ left: 0, top: 0 }),
        scrollTo: (left: number, top: number) => {},
        getCursor: () => ({ line: 0, ch: 0 }),
        setCursor: (pos: { line: number; ch: number }) => {},
      },
    }),
  };
  metadataCache = {
    getCache: (path: string) => ({
      frontmatter: {
        key: "value",
      },
    }),
  };
}

export class Plugin {}
export class PluginSettingTab {}
export class Setting {
  constructor(..._args: any[]) {}
  setName() {
    return this;
  }
  setDesc() {
    return this;
  }
  addToggle() {
    return this;
  }
  addDropdown() {
    return this;
  }
  addText() {
    return this;
  }
  addTextArea() {
    return this;
  }
  addButton() {
    return this;
  }
}
export class FileSystemAdapter {}
export class Editor {}
export class Menu {}
export class MenuItem {}
export class MarkdownFileInfo {}

export class TFile {
  name = "";
  path = "";
}

export class MarkdownView {}

export class Notice {
  constructor(public message: string) {}
}

export const moment = {
  locale: () => "en",
};

export function addIcon() {}

export function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export async function requestUrl() {
  return {
    json: {},
    status: 200,
  };
}
