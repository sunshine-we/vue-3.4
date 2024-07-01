import { createRenderer } from "@vue/runtime-core";

import { nodeOps } from "./nodeOps";
import patchProp from "./patchProp";

const renderOptions = Object.assign({ patchProp }, nodeOps);

// render 方法采用domapi来进行渲染
export const render = (vnode, container) => {
  return createRenderer(renderOptions).render(vnode, container)
}
// function createRenderer() {}
export { renderOptions };
export * from "@vue/runtime-core";
// runtime-dom -> runtime-core -> reactivity
