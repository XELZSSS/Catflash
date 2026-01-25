export {};

declare global {
  interface Window {
    gero?: {
      minimize: () => void;
      toggleMaximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximizeChanged: (callback: (isMaximized: boolean) => void) => () => void;
      setTrayLanguage: (language: 'en' | 'zh-CN') => Promise<void>;
      setTrayLabels: (labels: {
        open: string;
        hide: string;
        toggleDevTools: string;
        quit: string;
      }) => Promise<void>;
    };
  }
}
