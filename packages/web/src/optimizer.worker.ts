import { proposeVariants, type Book, type ProjectSettings } from '@graficai/core';

// O otimizador roda fora da thread da interface: a tela continua responsiva.
self.onmessage = (e: MessageEvent<{ book: Book; settings: ProjectSettings; key: string }>) => {
  const { book, settings, key } = e.data;
  const variants = proposeVariants(book, settings);
  (self as unknown as Worker).postMessage({ variants, key });
};
