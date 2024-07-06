import { ShapeFlags, isFunction, isObject, isString } from "@vue/shared";
import { isTeleport } from "./components/Teleport";

export function createVnode(type, props?, children?, patchFlag?) {
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT // 元素
    : isTeleport(type)
    ? ShapeFlags.TELEPORT
    : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT // 组件
    : isFunction(type)
    ? ShapeFlags.FUNCTIONAL_COMPONENT
    : 0;
  const vnode = {
    __v_isVnode: true,
    type,
    props,
    children,
    key: props?.key, // diff算法后面需要的key
    el: null, // 虚拟节点需要对应的真实节点是谁
    shapeFlag,
    ref: props?.ref,
    patchFlag,
  };

  if (currentBlock && patchFlag > 0) {
    currentBlock && currentBlock.push(vnode);
  }

  if (children) {
    if (Array.isArray(children)) {
      vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
    } else if (isObject(children)) {
      vnode.shapeFlag |= ShapeFlags.SLOTS_CHILDREN;
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

let currentBlock = null;
export function openBlock() {
  currentBlock = [];
}

export function closeBlock() {
  currentBlock = null;
}

export function setupBlock(vnode) {
  vnode.dynamicChildren = currentBlock; // 当前elemementBlock会收集子节点，用当前block收集
  closeBlock();
  return vnode;
}

// block 有收集虚拟节点的功能
export function createElementBlock(type, props, children, patchFlag?) {
  return setupBlock(createVnode(type, props, children, patchFlag));
}

export function toDisplayString(v) {
  return isString(v)
    ? v
    : v == null
    ? ""
    : isObject(v)
    ? JSON.stringify(v)
    : String(v);
}

export { createVnode as createElementVNode };
