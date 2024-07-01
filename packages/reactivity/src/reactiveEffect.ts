import { activeEffect, trackEffect, triggerEffect } from "./effect";

const targetMap = new WeakMap();
export const createDep = (cleanup, key) => {
  const dep = new Map() as any;
  dep.cleanup = cleanup;
  dep.name = key;
  return dep;
};

export function track(target, key, recevier) {
  // activeEffect 有这个属性，说明这个key 实在effect重访问的， 否则就是effect外访问的
  // debugger;
  if (activeEffect) {
    // console.log(key, activeEffect, "888");
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()));
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, (dep = createDep(() => depsMap.delete(key), key)));
    }
    trackEffect(activeEffect, dep); // 将当前的effect放入dep中，

    // console.log(targetMap);
  }
}


export function trigger(target, key, oldValue, value) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }
  let dep = depsMap.get(key)
  if (dep) {
    triggerEffect(dep)
  }

}