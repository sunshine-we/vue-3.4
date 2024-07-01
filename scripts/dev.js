// 这个文件会帮我们打包 package下的模块，最终打包出js文件

import minimist from "minimist";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { createRequire } from "module";
import esbuild from "esbuild";
// node dev.js (要打包的名字 -f 打包的格式)  === argv.slice(2)

const args = minimist(process.argv.slice(2));
const __filename = fileURLToPath(import.meta.url); // 获取文件的额绝对路径 file: -> /urs
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const target = args._[0] || "reactivity";
const format = args.f || "iife"; // 打包后的模块化桂发
// console.log(args, target, format);
// console.log(__filename, __dirname);
// console.log(import.meta);

// 入口文件 根绝命令行提供的路径进行解析
const entry = resolve(__dirname, `../packages/${target}/src/index.ts`);
const pkg = require(`../packages/${target}/package.json`);

// 根据需要进行打包
esbuild
  .context({
    entryPoints: [entry], // 入口
    outfile: resolve(__dirname, `../packages/${target}/dist/${target}.js`), // 出口
    bundle: true, // reactivity  -> shared  会打包到一起
    platform: "browser", // 打包后给浏览器使用
    sourcemap: true, // 可以调试源码
    format, // cjs esm iife
    globalName: pkg.buildOption?.name,
  })
  .then((ctx) => {
    console.log("start dev build");
    return ctx.watch(); // 监控入口文件持续进行打包处理
  });
