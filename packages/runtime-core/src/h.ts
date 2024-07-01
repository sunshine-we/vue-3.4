import { isObject } from "@vue/shared";
import { createVnode, isVnode } from "./createVnode";

export function h(type, propsOrChildren?, children?) {
  let l = arguments.length;
  if (l === 2) {
    if (isObject(propsOrChildren) && !Array.isArray(propsOrChildren)) {
      // 属性或者虚拟节点
      if (isVnode(propsOrChildren)) {
        return createVnode(type, null, [propsOrChildren]);
      } else {
        return createVnode(type, propsOrChildren);
      }
    }
    return createVnode(type, null, propsOrChildren);
  } else {
    if (l > 3) {
      children = Array.from(arguments).slice(2);
    }
    if (l === 3 && isVnode(children)) {
      children = [children];
    }

    return createVnode(type, propsOrChildren, children);
  }
}
