import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: globalWebStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const globalWebStyles = `
html, body, #root {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  /* Bloqueia scroll horizontal na raiz — resolve o overflow dos orbs do AppBackground */
  overflow: hidden;
  overscroll-behavior: none;
  -webkit-text-size-adjust: 100%;
}
* {
  box-sizing: border-box;
  /* Garante que nenhum elemento filho quebre o layout horizontal */
  max-width: 100vw;
}
/* Permite scroll vertical apenas no container principal do Expo Router */
#root > div {
  overflow-y: auto;
  overflow-x: hidden;
}
`;
