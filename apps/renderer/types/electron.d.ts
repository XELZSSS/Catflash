export {};

declare global {
  interface Window {
    gero?: {
      minimize: () => void;
      toggleMaximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      getProxyToken: () => string | undefined;
      getProxyPort: () => string;
      onMaximizeChanged: (callback: (isMaximized: boolean) => void) => () => void;
      setTrayLanguage: (language: 'en' | 'zh-CN') => Promise<void>;
      setTrayLabels: (labels: {
        open: string;
        hide: string;
        toggleDevTools: string;
        quit: string;
      }) => Promise<void>;
      obsidian?: {
        listMarkdown: (vaultPath: string) => Promise<string[]>;
        getRecentNote: (vaultPath: string) => Promise<string | null>;
        readNote: (vaultPath: string, notePath: string) => Promise<string>;
        writeNote: (vaultPath: string, notePath: string, content: string) => Promise<void>;
      };
    };
  }
}
