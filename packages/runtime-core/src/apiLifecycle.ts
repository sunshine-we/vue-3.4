import {
  currentInstance,
  setCurrentInstance,
  unsetCurrentInstance,
} from "./component";

export const enum LifeCycle {
  BEFORE_MOUNT = "bm",
  MOUNTED = "m",
  BEFORE_UPDATE = "bu",
  UPDATED = "u",
}

// M - > [FN,FN]

function createHook(type) {
  return (hook, target = currentInstance) => {
    // console.log(type, hook);

    if (target) {
      const hooks = target[type] || (target[type] = []); // 看当前钩子是否存放，发布订阅
      const wrapHook = () => {
        // 在钩子执行前，对实例进行矫正
        setCurrentInstance(target);
        hook.call(target);
        unsetCurrentInstance();
      };
      // 在执行函数内部保证实例是正确的
      hooks.push(wrapHook); // 这里有坑，因为setup执行完成后，就会讲instance清空
    }
  };
}
export const onBeforeMount = createHook(LifeCycle.BEFORE_MOUNT);
export const onMounted = createHook(LifeCycle.MOUNTED);
export const onBeforeUpdate = createHook(LifeCycle.BEFORE_UPDATE);
export const onUpdated = createHook(LifeCycle.UPDATED);

export function invokeArray(fns) {
  for (let i = 0; i < fns.length; i++) {
    fns[i]();
  }
}
