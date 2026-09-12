'use strict';

// Referenced from metro.config.js: on web, the 'react' module is redirected
// here because require('react').default is undefined under React 19,
// which breaks `import React from 'react'` after Metro's CJS interop.
// Requiring 'react/index.js' (not 'react') avoids re-entering that redirect.
const React = require('react/index.js');

module.exports = React;
// `default` must stay non-enumerable: Expo's Metro namespace-import helper
// (`import * as X from 'react'`) does Object.keys(e).forEach(...) without
// excluding "default", then does a plain `n.default = e` assignment. An
// enumerable `default` here makes that loop pre-define `n.default` as a
// getter-only accessor, so the later plain assignment throws in strict mode.
Object.defineProperty(module.exports, 'default', {
  value: React,
  enumerable: false,
  configurable: true,
  writable: true,
});
