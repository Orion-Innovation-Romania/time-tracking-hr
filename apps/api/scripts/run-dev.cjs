'use strict';

/**
 * Started by tsc-watch after a successful compile. tsc-watch kills this
 * process before the next restart, which is what nest start --watch fails
 * to do reliably on Windows (EADDRINUSE on :4000).
 */
require('./copy-mail-assets.cjs');
require('../dist/main.js');
