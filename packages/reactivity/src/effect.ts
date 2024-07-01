import { DirtyLevels } from "./constants";

export function effect(fn, options?) {
  // 创建一个响应式的effect 数据变化后，可以重新执行

  // 创建一个effect， 只要依赖的属性变化了，就要执行回调
  const _effect = new ReactiveEffect(fn, () => {
    _effect.run();
  });
  _effect.run(); // 刚一进来就收集
  if (options) {
    Object.assign(_effect, options); // 用户传递的覆盖init option
  }

  const runner = _effect.run.bind(_effect);
  runner.effect = _effect;
  return runner;
}

export let activeEffect;

function cleanDepEffect(dep, effect) {
  dep.delete(effect);
  if (dep.size === 0) {
    dep.cleanup();
  }
}
function preCleanEffect(effect) {
  effect._depsLength = 0;
  effect._trackId++;
}

function postCleanEffect(effect) {
  if (effect.deps.length > effect._depsLength) {
    for (let i = effect._depsLength; i < effect.deps.length; i++) {
      cleanDepEffect(effect.deps[i], effect);
    }
    effect.deps.length = effect._depsLength;
  }
}

export class ReactiveEffect {
  _trackId = 0; // 用于记录当前effect执行了几次
  deps = [];
  _depsLength = 0;
  _running = 0;
  _dirtyLevel = DirtyLevels.Dirty;
  public active = true;
  // fn 用户编写的函数
  // 如果fn中依赖的数据发生变化后，需要重新调用 -》 run()
  constructor(public fn, public scheduler) {}
  public get dirty() {
    return this._dirtyLevel === DirtyLevels.Dirty;
  }
  public set dirty(v) {
    this._dirtyLevel = v ? DirtyLevels.Dirty : DirtyLevels.NoDirty;
  }
  run() {
    this._dirtyLevel = DirtyLevels.NoDirty; // 每次运行的时候变为 No_dirty
    if (!this.active) {
      return this.fn(); // 不是激活的，执行后，什么都不做
    }
    let lastEffect = activeEffect;
    try {
      activeEffect = this;

      // effect 重新执行， 需要讲上一次的依赖情况 清空
      preCleanEffect(this);
      this._running++;
      return this.fn(); // 依赖收集
    } finally {
      this._running--;
      postCleanEffect(this);
      activeEffect = lastEffect;
    }
  }
  stop() {
    if (this.active) {
      this.active = false
      preCleanEffect(this)
      postCleanEffect(this)
    }
  }
}

export function trackEffect(effect, dep) {
  if (dep.get(effect) !== effect._trackId) {
    dep.set(effect, effect._trackId);
    let oldDep = effect.deps[effect._depsLength];
    if (oldDep !== dep) {
      if (oldDep) {
        cleanDepEffect(oldDep, effect);
      }
      // 换成新的
      effect.deps[effect._depsLength++] = dep;
    } else {
      effect._depsLength++;
    }
  }
  // dep.set(effect, effect._trackId)
  // // 我还想让effect和effect 关联起来
  // effect.deps[effect._depsLength++] = dep
  // console.log(effect)
}
export function triggerEffect(deps) {
  for (const effect of deps.keys()) {
    // 当前这个值是不脏的， 但是触发更新需要将值变为脏值
    if (effect._dirtyLevel < DirtyLevels.Dirty) {
      effect._dirtyLevel = DirtyLevels.Dirty
    }
    if (!effect._running) {
      if (effect.scheduler) {
        // 如果正在执行，什么都不做
        effect.scheduler();
      }
    }
  }
}
