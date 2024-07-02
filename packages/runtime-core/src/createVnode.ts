import { ShapeFlags, isObject, isString } from "@vue/shared";

export function createVnode(type, props?, children?) {
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT  // 元素
    : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT  // 组件
    : 0;
  const vnode = {
    __v_isVnode: true,
    type,
    props,
    children,
    key: props?.key, // diff算法后面需要的key
    el: null, // 虚拟节点需要对应的真实节点是谁
    shapeFlag,
  };
  if (children) {
    if (Array.isArray(children)) {
      vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
    } else {
      children = String(children);
      vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN;
    }
  }

  return vnode;
}

export function isVnode(v) {
  return v?.__v_isVnode;
}
export function isSameVnode(n1, n2) {
  return n1.type === n2.type && n1.key === n2.key;
}

export const Text = Symbol("text");
export const Fragment = Symbol("Fragment");
