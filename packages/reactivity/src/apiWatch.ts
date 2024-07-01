import { isFunction, isObject } from "@vue/shared";
import { ReactiveEffect } from "./effect";
import { isReactive } from "./reactive";
import { isRef } from "./ref";

export function watch(source, cb, options) {
  // watchEffect 也是基于doWatch来实现的
  // const initOption = Object.assign({ deep: true }, options);
  return doWatch(source, cb, options);
}

export function watchEffect(source, options = {}) {
  return doWatch(source, null, (options = {}));
}

function traverse(source, depth, currentDepth = 0, seen = new Set()) {
  if (!isObject(source)) {
    return source;
  }
  if (depth) {
    if (currentDepth >= depth) {
      return source;
    }
    currentDepth++;
    if (seen.has(source)) {
      return source;
    }
    for (let key in source) {
      traverse(source[key], depth, currentDepth, seen);
    }
    return source;
  }
}
function doWatch(source, cb, { deep, immediate }) {
  const reactiveGetter = (source) =>
    traverse(source, deep === false ? 1 : undefined);
  // 产生一个可以给ReactiveEffect 来使用getter， 需要对这个对象进行取值操作，会关联当前的reactiveEffect
  let getter: () => void;
  if (isReactive(source)) {
    getter = () => reactiveGetter(source);
  } else if (isRef(source)) {
    getter = () => source.value;
  } else if (isFunction(source)) {
    getter = source;
  }
  let oldValue;
  let clean;
  const onCleanUp = (fn) => {
    clean = () => {
      fn();
      clean = undefined;
    };
  };
  const job = () => {
    if (cb) {
      const newValue = effect.run();
      if (clean) clean();
      cb(newValue, oldValue, onCleanUp);
      oldValue = newValue;
    } else {
      effect.run();
    }
  };
  const effect = new ReactiveEffect(getter, job);
  if (cb) {
    if (immediate) {
      // 立即先执行一次用户的额回调，传新值和老值
      job();
    } else {
      oldValue = effect.run();
    }
  } else {
    effect.run();
  }
  const unwatch = () => {
    effect.stop();
  };
  return unwatch;
  console.log(oldValue, "watch --->");
}
