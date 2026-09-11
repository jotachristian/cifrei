// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// ─── Fix: React 19 + @expo/metro-runtime web compatibility ───────────────────
// No React 19, require('react') NÃO exporta .default. O Metro do Expo
// compila `import React from 'react'` como require('react').default para web,
// resultando em undefined → TypeError.
//
// Solução: no bundle web, substituir o módulo 'react' por um shim que
// re-exporta tudo + adiciona .default = módulo. Apenas para o módulo raiz
// ('react'), não subpaths ('react/jsx-runtime', 'react/jsx-dev-runtime', etc.)
const originalResolveRequest = config.resolver?.resolveRequest;

config.resolver = {
  ...(config.resolver || {}),
  resolveRequest(context, moduleName, platform) {
    // Redireciona apenas o módulo raiz 'react' no web para o shim
    if (platform === 'web' && moduleName === 'react') {
      return {
        filePath: path.resolve(__dirname, '.metro-shims', 'react-web-shim.js'),
        type: 'sourceFile',
      };
    }
    // Chama o resolver original ou o padrão
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
