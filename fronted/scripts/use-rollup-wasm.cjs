const fs = require('node:fs');
const path = require('node:path');

const nativeFile = path.join(__dirname, '..', 'node_modules', 'rollup', 'dist', 'native.js');

if (!fs.existsSync(nativeFile)) process.exit(0);

const source = fs.readFileSync(nativeFile, 'utf8');
const wasmRequire = "const nativeModule = requireWithFriendlyError('@rollup/wasm-node/dist/native.js');";

if (source.includes(wasmRequire)) process.exit(0);

const replaced = source.replace(
  /const nativeModule = requireWithFriendlyError\([\s\S]*?\);\n\nconst \{ parse, parseAsync,/,
  `${wasmRequire}\n\nconst { parse, parseAsync,`
);

if (replaced === source) {
  console.warn('Could not patch Rollup native loader; native Rollup may remain blocked.');
  process.exit(0);
}

fs.writeFileSync(nativeFile, replaced);
