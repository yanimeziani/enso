// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

import exports from './cjs/main.cjs';

const require = createRequire(import.meta.url);

export const {
  transformReactLynxSync,
  transformBundleResultSync,
  transformReactLynx,
  transformBundleResult,
} = process.env['USE_NAPI'] ? require('./index.cjs') : exports;
