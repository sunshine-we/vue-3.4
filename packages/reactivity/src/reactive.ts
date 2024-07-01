import { isObject } from "@vue/shared";
import { mutableHandlers } from "./baseHandler";
import { ReactiveFlags } from "./constants"

const reactiveMap = new WeakMap();



export function reactive(target) {
  return createReactiveObject(target)
}
function createReactiveObject(target) {
  if (!isObject(target)) {
    return target
  }
  if (target[ReactiveFlags.IS_REACTIVE]) {
    return target
  }
  const exitsProxy = reactiveMap.get(target);
  if(exitsProxy) return exitsProxy
  let proxy = new Proxy(target, mutableHandlers)
  reactiveMap.set(target, proxy)
  return proxy
}

export function toReactive(value) {
  return isObject(value)? reactive(value):value
}

export function isReactive(value) {
  return !!(value && value[ReactiveFlags.IS_REACTIVE])
}