// packages/shared/src/index.ts
function isObject(value) {
  return typeof value === "object" && value !== null;
}
function isFunction(value) {
  return typeof value === "function";
}
function isString(value) {
  return typeof value === "string";
}
var hasOwnProperty = Object.prototype.hasOwnProperty;
var hasOwn = (val, key) => hasOwnProperty.call(val, key);

// packages/runtime-core/src/components/Teleport.ts
var Teleport = {
  __isTeleport: true,
  process(n1, n2, container, anchor, parentComponent, internals) {
    let { mountChildren, patchChildren, move } = internals;
    if (!n1) {
      const target = n2.target = document.querySelector(n2.props.to);
      if (target) {
        mountChildren(n2.children, target, parentComponent);
      }
    } else {
      console.log(n1, n2);
      const target = n2.target = n1.target;
      patchChildren(n1, n2, target, parentComponent);
      if (n1.props.to !== n2.props.to) {
        const nextTarget = n2.target = document.querySelector(n2.props.to);
        n2.children.forEach((child) => move(child, nextTarget, anchor));
      }
    }
  },
  remove(vnode, unmountChildren) {
    const { shapeFlag, children } = vnode;
    if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
      unmountChildren(children);
    }
  }
};
var isTeleport = (v) => v.__isTeleport;

// packages/runtime-core/src/createVnode.ts
function createVnode(type, props, children, patchFlag) {
  const shapeFlag = isString(type) ? 1 /* ELEMENT */ : isTeleport(type) ? 64 /* TELEPORT */ : isObject(type) ? 4 /* STATEFUL_COMPONENT */ : isFunction(type) ? 2 /* FUNCTIONAL_COMPONENT */ : 0;
  const vnode = {
    __v_isVnode: true,
    type,
    props,
    children,
    key: props?.key,
    // diff算法后面需要的key
    el: null,
    // 虚拟节点需要对应的真实节点是谁
    shapeFlag,
    ref: props?.ref,
    patchFlag
  };
  if (currentBlock && patchFlag > 0) {
    currentBlock && currentBlock.push(vnode);
  }
  if (children) {
    if (Array.isArray(children)) {
      vnode.shapeFlag |= 16 /* ARRAY_CHILDREN */;
    } else if (isObject(children)) {
      vnode.shapeFlag |= 32 /* SLOTS_CHILDREN */;
    } else {
      children = String(children);
      vnode.shapeFlag |= 8 /* TEXT_CHILDREN */;
    }
  }
  return vnode;
}
function isVnode(v) {
  return v?.__v_isVnode;
}
function isSameVnode(n1, n2) {
  return n1.type === n2.type && n1.key === n2.key;
}
var Text = Symbol("text");
var Fragment = Symbol("Fragment");
var currentBlock = null;
function openBlock() {
  currentBlock = [];
}
function closeBlock() {
  currentBlock = null;
}
function setupBlock(vnode) {
  vnode.dynamicChildren = currentBlock;
  closeBlock();
  return vnode;
}
function createElementBlock(type, props, children, patchFlag) {
  return setupBlock(createVnode(type, props, children, patchFlag));
}
function toDisplayString(v) {
  return isString(v) ? v : v == null ? "" : isObject(v) ? JSON.stringify(v) : String(v);
}

// packages/runtime-core/src/h.ts
function h(type, propsOrChildren, children) {
  let l = arguments.length;
  if (l === 2) {
    if (isObject(propsOrChildren) && !Array.isArray(propsOrChildren)) {
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

// packages/runtime-core/src/seq.ts
function getSequence(arr) {
  const p = arr.slice();
  const result = [0];
  let start;
  let end;
  let middle;
  const len = arr.length;
  for (let i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      let resultLastIndex = result[result.length - 1];
      if (arr[resultLastIndex] < arrI) {
        result.push(i);
        continue;
      }
    }
    start = 0;
    end = result.length - 1;
    while (start < end) {
      middle = (start + end) / 2 | 0;
      if (arr[result[middle]] < arrI) {
        start = middle + 1;
      } else {
        end = middle;
      }
    }
    if (arrI < arr[result[start]]) {
      result[start] = i;
    }
  }
  return result;
}

// packages/reactivity/src/effect.ts
function effect(fn, options) {
  const _effect = new ReactiveEffect(fn, () => {
    _effect.run();
  });
  _effect.run();
  if (options) {
    Object.assign(_effect, options);
  }
  const runner = _effect.run.bind(_effect);
  runner.effect = _effect;
  return runner;
}
var activeEffect;
function cleanDepEffect(dep, effect2) {
  dep.delete(effect2);
  if (dep.size === 0) {
    dep.cleanup();
  }
}
function preCleanEffect(effect2) {
  effect2._depsLength = 0;
  effect2._trackId++;
}
function postCleanEffect(effect2) {
  if (effect2.deps.length > effect2._depsLength) {
    for (let i = effect2._depsLength; i < effect2.deps.length; i++) {
      cleanDepEffect(effect2.deps[i], effect2);
    }
    effect2.deps.length = effect2._depsLength;
  }
}
var ReactiveEffect = class {
  // fn 用户编写的函数
  // 如果fn中依赖的数据发生变化后，需要重新调用 -》 run()
  constructor(fn, scheduler) {
    this.fn = fn;
    this.scheduler = scheduler;
    this._trackId = 0;
    // 用于记录当前effect执行了几次
    this.deps = [];
    this._depsLength = 0;
    this._running = 0;
    this._dirtyLevel = 4 /* Dirty */;
    this.active = true;
  }
  get dirty() {
    return this._dirtyLevel === 4 /* Dirty */;
  }
  set dirty(v) {
    this._dirtyLevel = v ? 4 /* Dirty */ : 0 /* NoDirty */;
  }
  run() {
    this._dirtyLevel = 0 /* NoDirty */;
    if (!this.active) {
      return this.fn();
    }
    let lastEffect = activeEffect;
    try {
      activeEffect = this;
      preCleanEffect(this);
      this._running++;
      return this.fn();
    } finally {
      this._running--;
      postCleanEffect(this);
      activeEffect = lastEffect;
    }
  }
  stop() {
    if (this.active) {
      this.active = false;
      preCleanEffect(this);
      postCleanEffect(this);
    }
  }
};
function trackEffect(effect2, dep) {
  if (dep.get(effect2) !== effect2._trackId) {
    dep.set(effect2, effect2._trackId);
    let oldDep = effect2.deps[effect2._depsLength];
    if (oldDep !== dep) {
      if (oldDep) {
        cleanDepEffect(oldDep, effect2);
      }
      effect2.deps[effect2._depsLength++] = dep;
    } else {
      effect2._depsLength++;
    }
  }
}
function triggerEffect(deps) {
  for (const effect2 of deps.keys()) {
    if (effect2._dirtyLevel < 4 /* Dirty */) {
      effect2._dirtyLevel = 4 /* Dirty */;
    }
    if (!effect2._running) {
      if (effect2.scheduler) {
        effect2.scheduler();
      }
    }
  }
}

// packages/reactivity/src/reactiveEffect.ts
var targetMap = /* @__PURE__ */ new WeakMap();
var createDep = (cleanup, key) => {
  const dep = /* @__PURE__ */ new Map();
  dep.cleanup = cleanup;
  dep.name = key;
  return dep;
};
function track(target, key, recevier) {
  if (activeEffect) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, depsMap = /* @__PURE__ */ new Map());
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, dep = createDep(() => depsMap.delete(key), key));
    }
    trackEffect(activeEffect, dep);
  }
}
function trigger(target, key, oldValue, value) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  let dep = depsMap.get(key);
  if (dep) {
    triggerEffect(dep);
  }
}

// packages/reactivity/src/baseHandler.ts
var mutableHandlers = {
  get(target, key, recevier) {
    if (key === "__v_isReactive" /* IS_REACTIVE */) {
      return true;
    }
    track(target, key, recevier);
    const res = Reflect.get(target, key, recevier);
    if (isObject(res)) {
      return reactive(res);
    }
    return res;
  },
  set(target, key, value, recevier) {
    let oldValue = target[key];
    let result = Reflect.set(target, key, value, recevier);
    if (oldValue !== value) {
      trigger(target, key, oldValue, value);
    }
    return result;
  }
};

// packages/reactivity/src/reactive.ts
var reactiveMap = /* @__PURE__ */ new WeakMap();
function reactive(target) {
  return createReactiveObject(target);
}
function createReactiveObject(target) {
  if (!isObject(target)) {
    return target;
  }
  if (target["__v_isReactive" /* IS_REACTIVE */]) {
    return target;
  }
  const exitsProxy = reactiveMap.get(target);
  if (exitsProxy) return exitsProxy;
  let proxy = new Proxy(target, mutableHandlers);
  reactiveMap.set(target, proxy);
  return proxy;
}
function toReactive(value) {
  return isObject(value) ? reactive(value) : value;
}
function isReactive(value) {
  return !!(value && value["__v_isReactive" /* IS_REACTIVE */]);
}

// packages/reactivity/src/ref.ts
function ref(value) {
  return createRef(value);
}
function createRef(value) {
  return new RefImpl(value);
}
var RefImpl = class {
  constructor(rawValue) {
    this.rawValue = rawValue;
    this.__v_isRef = true;
    this._value = toReactive(rawValue);
  }
  get value() {
    trackRefValue(this);
    return this._value;
  }
  set value(newValue) {
    if (newValue !== this.rawValue) {
      this.rawValue = newValue;
      this._value = newValue;
      triggerRefValue(this);
    }
  }
};
function trackRefValue(ref2) {
  if (activeEffect) {
    trackEffect(
      activeEffect,
      ref2.dep = ref2.dep || createDep(() => ref2.dep = void 0, "undefined")
    );
  }
}
function triggerRefValue(ref2) {
  let dep = ref2.dep;
  if (dep) {
    triggerEffect(dep);
  }
}
var ObjectRefImpl = class {
  // 增加ref标识
  constructor(_object, _key) {
    this._object = _object;
    this._key = _key;
    this.__v_isRef = true;
  }
  get value() {
    return this._object[this._key];
  }
  set value(newValue) {
    this._object[this._key] = newValue;
  }
};
function toRef(object, key) {
  return new ObjectRefImpl(object, key);
}
function toRefs(object) {
  const res = {};
  for (let key in object) {
    res[key] = toRef(object, key);
  }
  return res;
}
function proxyRefs(objectWithRef) {
  return new Proxy(objectWithRef, {
    get(target, key, recevier) {
      let r = Reflect.get(target, key, recevier);
      return r.__v_isRef ? r.value : r;
    },
    set(target, key, value, recevier) {
      const oldValue = target[key];
      if (oldValue.__v_isRef) {
        oldValue.value = value;
        return true;
      } else {
        return Reflect.set(target, key, value, recevier);
      }
    }
  });
}
function isRef(value) {
  return value && value.__v_isRef;
}

// packages/reactivity/src/computed.ts
function computed(getterOrOptions) {
  let onlyGetter = isFunction(getterOrOptions);
  let getter;
  let setter;
  if (onlyGetter) {
    getter = onlyGetter;
    setter = () => {
    };
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  return new ComputedRefImpl(getter, setter);
}
var ComputedRefImpl = class {
  constructor(getter, setter) {
    this.setter = setter;
    this.effect = new ReactiveEffect(() => getter(this._value), () => {
      triggerRefValue(this);
    });
  }
  get value() {
    if (this.effect.dirty) {
      this._value = this.effect.run();
      trackRefValue(this);
    }
    return this._value;
  }
  set value(v) {
    this.setter(v);
  }
};

// packages/reactivity/src/apiWatch.ts
function watch(source, cb, options) {
  return doWatch(source, cb, options);
}
function watchEffect(source, options = {}) {
  return doWatch(source, null, options = {});
}
function traverse(source, depth, currentDepth = 0, seen = /* @__PURE__ */ new Set()) {
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
  const reactiveGetter = (source2) => traverse(source2, deep === false ? 1 : void 0);
  let getter;
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
      clean = void 0;
    };
  };
  const job = () => {
    if (cb) {
      const newValue = effect2.run();
      if (clean) clean();
      cb(newValue, oldValue, onCleanUp);
      oldValue = newValue;
    } else {
      effect2.run();
    }
  };
  const effect2 = new ReactiveEffect(getter, job);
  if (cb) {
    if (immediate) {
      job();
    } else {
      oldValue = effect2.run();
    }
  } else {
    effect2.run();
  }
  const unwatch = () => {
    effect2.stop();
  };
  return unwatch;
  console.log(oldValue, "watch --->");
}

// packages/runtime-core/src/scheduler.ts
var queue = [];
var isFlushing = false;
var resolvePromise = Promise.resolve();
function queueJob(job) {
  if (!queue.includes(job)) {
    queue.push(job);
  }
  if (!isFlushing) {
    isFlushing = true;
    resolvePromise.then(() => {
      isFlushing = false;
      const copy = queue.slice(0);
      queue.length = 0;
      copy.forEach((job2) => job2());
      copy.length = 0;
    });
  }
}

// packages/runtime-core/src/component.ts
function createComponentInstance(vnode, parentComponent) {
  const instance = {
    data: null,
    // 组件的状态
    vnode,
    // 组件的虚拟节点
    subTree: null,
    // 子树
    isMounted: null,
    // 是否挂载完成
    update: null,
    // 组件的更新函数
    props: {},
    attrs: {},
    slots: {},
    propsOptions: vnode.type.props,
    // 用户声明的那些属性是组件的属性
    component: null,
    proxy: null,
    // 用来代理 props attrs, data 让用户更方便的使用
    setupState: {},
    exposed: null,
    parent: parentComponent,
    provides: parentComponent ? parentComponent.provides : /* @__PURE__ */ Object.create(null),
    ctx: {}
    // 如果是keepAlive 组件，就将dom api放入到这个属性上
  };
  return instance;
}
var publicProperty = {
  $attrs: (instance) => instance.attrs,
  $slots: (instance) => instance.slots
};
var handle = {
  get(target, key) {
    const { data, props, setupState } = target;
    if (data && hasOwn(data, key)) {
      return data[key];
    } else if (props && hasOwn(props, key)) {
      return props[key];
    } else if (setupState && hasOwn(setupState, key)) {
      return setupState[key];
    }
    const getter = publicProperty[key];
    if (getter) {
      return getter(target);
    }
  },
  set(target, key, value) {
    const { data, props, setupState } = target;
    if (data && hasOwn(data, key)) {
      data[key] = value;
    } else if (props && hasOwn(props, key)) {
      console.warn("props are readonly");
      return false;
    } else if (setupState && hasOwn(setupState, key)) {
      setupState[key] = value;
    }
  }
};
function setupComponent(instance) {
  const { vnode } = instance;
  initProps(instance, vnode.props);
  initSlots(instance, vnode.children);
  instance.proxy = new Proxy(instance, handle);
  const { data = () => {
  }, render: render2, setup } = vnode.type;
  if (setup) {
    const setupContext = {
      // todo...
      slots: instance.slots,
      attrs: instance.attrs,
      emit(event, ...payload) {
        const eventName = `on${event[0].toUpperCase() + event.slice(1)}`;
        const handle2 = instance.vnode.props[eventName];
        handle2 && handle2(...payload);
      },
      expose: (v) => {
        instance.exposed = v;
      }
    };
    setCurrentInstance(instance);
    const setupResult = setup(instance.props, setupContext);
    unsetCurrentInstance();
    if (isFunction(setupResult)) {
      instance.render = setupResult;
    } else {
      instance.setupState = proxyRefs(setupResult);
    }
  }
  if (data && !isFunction(data)) {
    console.warn("data option must be a function");
  } else {
    instance.data = reactive(data.call(instance.proxy, instance.proxy));
  }
  if (!instance.render) {
    instance.render = render2;
  }
}
var initProps = (instance, rawProps) => {
  const props = {};
  const attrs = {};
  const propsOptions = instance.propsOptions || {};
  if (rawProps) {
    for (let key in rawProps) {
      const value = rawProps[key];
      if (key in propsOptions) {
        props[key] = value;
      } else {
        attrs[key] = value;
      }
    }
  }
  instance.attrs = attrs;
  instance.props = reactive(props);
};
var initSlots = (instance, children) => {
  if (instance.vnode.shapeFlag & 32 /* SLOTS_CHILDREN */) {
    instance.slots = children;
  } else {
    instance.slots = {};
  }
};
var currentInstance = null;
var getCurrentInstance = () => {
  return currentInstance;
};
var setCurrentInstance = (instance) => {
  return currentInstance = instance;
};
var unsetCurrentInstance = () => {
  return currentInstance = null;
};

// packages/runtime-core/src/apiLifecycle.ts
var LifeCycle = /* @__PURE__ */ ((LifeCycle2) => {
  LifeCycle2["BEFORE_MOUNT"] = "bm";
  LifeCycle2["MOUNTED"] = "m";
  LifeCycle2["BEFORE_UPDATE"] = "bu";
  LifeCycle2["UPDATED"] = "u";
  return LifeCycle2;
})(LifeCycle || {});
function createHook(type) {
  return (hook, target = currentInstance) => {
    if (target) {
      const hooks = target[type] || (target[type] = []);
      const wrapHook = () => {
        setCurrentInstance(target);
        hook.call(target);
        unsetCurrentInstance();
      };
      hooks.push(wrapHook);
    }
  };
}
var onBeforeMount = createHook("bm" /* BEFORE_MOUNT */);
var onMounted = createHook("m" /* MOUNTED */);
var onBeforeUpdate = createHook("bu" /* BEFORE_UPDATE */);
var onUpdated = createHook("u" /* UPDATED */);
function invokeArray(fns) {
  for (let i = 0; i < fns.length; i++) {
    fns[i]();
  }
}

// packages/runtime-core/src/components/KeepAlive.ts
var KeepAlive = {
  __isKeepAlive: true,
  props: {
    max: Number
  },
  setup(props, { slots }) {
    const { max } = props;
    const keys = /* @__PURE__ */ new Set();
    const cache = /* @__PURE__ */ new Map();
    let pendingCacheKey = null;
    const instance = getCurrentInstance();
    const { move, createElement, unmount: _unmount } = instance.ctx.renderer;
    function reset(vnode) {
      let shapeFlag = vnode.shapeFlag;
      if (shapeFlag & 512 /* COMPONENT_KEPT_ALIVE */) {
        shapeFlag -= 512 /* COMPONENT_KEPT_ALIVE */;
      } else if (shapeFlag & 256 /* COMPONENT_SHOULD_KEEP_ALIVE */) {
        shapeFlag -= 256 /* COMPONENT_SHOULD_KEEP_ALIVE */;
      }
      vnode.shapeFlag = shapeFlag;
    }
    function unmount(cache2) {
      reset(cache2);
      _unmount(cache2);
    }
    function purneCacheEntry(key) {
      keys.delete(key);
      const cached = cache.get(key);
      unmount(cached);
    }
    instance.ctx.activate = function(vnode, container, anchor) {
      move(vnode, container, anchor);
    };
    const storageContent = createElement("div");
    instance.ctx.deactivate = function(vnode, container, anchor) {
      move(vnode, storageContent, anchor);
    };
    const cacheSubTree = () => {
      cache.set(pendingCacheKey, instance.subTree);
      console.log(cache);
    };
    onMounted(cacheSubTree);
    onUpdated(cacheSubTree);
    return () => {
      const vnode = slots.default();
      const comp = vnode.type;
      const key = vnode.key === null ? comp : vnode.key;
      const cacheVNode = cache.get(key);
      pendingCacheKey = key;
      if (cacheVNode) {
        vnode.component = cacheVNode.component;
        vnode.shapeFlag |= 512 /* COMPONENT_KEPT_ALIVE */;
        keys.delete(key);
        keys.add(key);
      } else {
        keys.add(key);
        console.log(max, keys.size);
        if (max && keys.size > max) {
          purneCacheEntry(keys.values().next().value);
        }
      }
      vnode.shapeFlag |= 256 /* COMPONENT_SHOULD_KEEP_ALIVE */;
      return vnode;
    };
  }
};
var isKeepAlive = (v) => v.type.__isKeepAlive;

// packages/runtime-core/src/renderer.ts
function createRenderer(renderOptions2) {
  const {
    insert: hostInsert,
    remove: hostRemove,
    createElement: hostCreateElement,
    createText: hostCreateText,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    patchProp: hostPatchProp
  } = renderOptions2;
  const mountElement = (vnode, container, anchor, parentComponent) => {
    const { type, children, props, shapeFlag, transition } = vnode;
    let el = vnode.el = hostCreateElement(type);
    if (props) {
      for (let key in props) {
        hostPatchProp(el, key, null, props[key]);
      }
    }
    if (shapeFlag & 8 /* TEXT_CHILDREN */) {
      hostSetElementText(el, children);
    } else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
      mountChildren(children, el, anchor, parentComponent);
    }
    if (transition) {
      transition.beforeEnter(el);
    }
    hostInsert(el, container, anchor);
    if (transition) {
      transition.enter(el);
    }
  };
  const normalize = (children) => {
    if (Array.isArray(children)) {
      for (let i = 0; i < children.length; i++) {
        if (typeof children[i] === "string" || typeof children[i] === "number") {
          children[i] = createVnode(Text, null, String(children[i]));
        }
      }
    }
    return children;
  };
  const mountChildren = (children, container, anchor, parentComponent) => {
    normalize(children);
    for (let i = 0; i < children.length; i++) {
      patch(null, children[i], container, anchor, parentComponent);
    }
  };
  const patchProps = (oldProps, newProps, el) => {
    for (let key in newProps) {
      hostPatchProp(el, key, oldProps[key], newProps[key]);
    }
    for (let key in oldProps) {
      if (!(key in newProps)) {
        hostPatchProp(el, key, oldProps[key], null);
      }
    }
  };
  const unmountChildren = (children, parentComponent) => {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i], parentComponent);
    }
  };
  const patchKeyChildren = (c1, c2, el, parentComponent) => {
    let i = 0;
    let e1 = c1.length - 1;
    let e2 = c2.length - 1;
    while (i <= e1 && i <= e2) {
      const n1 = c1[i];
      const n2 = c2[i];
      if (isSameVnode(n1, n2)) {
        patch(n1, n2, el);
      } else {
        break;
      }
      i++;
    }
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1];
      const n2 = c2[e2];
      if (isSameVnode(n1, n2)) {
        patch(n1, n2, el);
      } else {
        break;
      }
      e1--;
      e2--;
    }
    if (i > e1) {
      if (i <= e2) {
        let nextPos = e2 + 1;
        let anchor = c2[nextPos]?.el;
        while (i <= e2) {
          patch(null, c2[i], el, anchor);
          i++;
        }
      }
    } else if (i > e2) {
      if (i <= e1) {
        while (i <= e1) {
          unmount(c1[i], parentComponent);
          i++;
        }
      }
    } else {
      let s1 = i;
      let s2 = i;
      const keyToNewIndexMap = /* @__PURE__ */ new Map();
      let toBePatched = e2 - s2 + 1;
      let newIndexToOldMapIndex = new Array(toBePatched).fill(0);
      for (let i2 = s2; i2 <= e2; i2++) {
        const vnode = c2[i2];
        keyToNewIndexMap.set(vnode.key, i2);
      }
      for (let i2 = s1; i2 <= e1; i2++) {
        const vnode = c1[i2];
        const newIndex = keyToNewIndexMap.get(vnode.key);
        if (newIndex == void 0) {
          unmount(vnode, parentComponent);
        } else {
          newIndexToOldMapIndex[newIndex - s2] = i2 + 1;
          patch(vnode, c2[newIndex], el);
        }
      }
      let increasingSeq = getSequence(newIndexToOldMapIndex);
      let j = increasingSeq.length - 1;
      for (let i2 = toBePatched - 1; i2 >= 0; i2--) {
        let newIndex = s2 + i2;
        let anchor = c2[newIndex + 1]?.el;
        let vnode = c2[newIndex];
        if (!vnode.el) {
          patch(null, vnode, el, anchor);
        } else {
          if (i2 == increasingSeq[j]) {
            j--;
          } else {
            hostInsert(vnode.el, el, anchor);
          }
        }
      }
    }
  };
  const patchChildren = (n1, n2, el, anchor, parentComponent) => {
    const c1 = n1 && n1.children;
    const prevShapeFlag = n1 ? n1.shapeFlag : 0;
    const c2 = normalize(n2.children);
    const nextShapeFlag = n2.shapeFlag;
    if (nextShapeFlag & 8 /* TEXT_CHILDREN */) {
      if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
        unmountChildren(c1, parentComponent);
      }
      if (c1 !== c2) {
        hostSetElementText(el, c2);
      }
    } else {
      if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
        if (nextShapeFlag & 16 /* ARRAY_CHILDREN */) {
          patchKeyChildren(c1, c2, el, parentComponent);
        } else {
          unmountChildren(c1, parentComponent);
        }
      } else {
        if (prevShapeFlag & 8 /* TEXT_CHILDREN */) {
          hostSetElementText(el, "");
        }
        if (nextShapeFlag * 16 /* ARRAY_CHILDREN */) {
          mountChildren(c2, el, anchor, parentComponent);
        }
      }
    }
  };
  const patchBlockChildren = (n1, n2, el, anchor, parentComponent) => {
    for (let i = 0; i < n2.length; i++) {
      patchElement(
        n1.dynamicChildren[i],
        n2.dynamicChildren[i],
        el,
        anchor,
        parentComponent
      );
    }
  };
  const patchElement = (n1, n2, container, anchor, parentComponent) => {
    let el = n2.el = n1.el;
    let oldProps = n1.props || {};
    let newProps = n2.props || {};
    const { patchFlag, dynamicChildren } = n2;
    if (patchFlag) {
      if (patchFlag & 1 /* TEXT */) {
        if (n1.children !== n2.children) {
          hostSetElementText(el, n2.children);
        }
        if (patchFlag & 2 /* CLASS */) {
          if (oldProps.class !== newProps.class) {
            hostPatchProp(el, "class", null, newProps.class);
          }
        }
        if (patchFlag & 4 /* STYLE */) {
          hostPatchProp(el, "style", oldProps.style, newProps.style);
        }
      }
    } else {
      patchProps(oldProps, newProps, el);
    }
    if (dynamicChildren) {
      patchBlockChildren(n1, n2, el, anchor, parentComponent);
    } else {
      patchChildren(n1, n2, el, anchor, parentComponent);
    }
  };
  const updateComponentPreRender = (instance, next) => {
    instance.next = null;
    instance.vnode = next;
    updateProps(instance, instance.props, next.props || {});
    Object.assign(instance.slots, next.children);
  };
  function renderComponent(instance) {
    const { render: render3, vnode, proxy, attrs, slots, props } = instance;
    if (vnode.shapeFlag & 4 /* STATEFUL_COMPONENT */) {
      return render3.call(proxy, proxy);
    } else {
      return vnode.type(attrs, { slots });
    }
  }
  const setupRenderEffect = (instance, container, anchor, parentComponent) => {
    const { render: render3 } = instance;
    const componentUpdateFn = () => {
      const { bm, m } = instance;
      if (!instance.isMounted) {
        if (bm) {
          invokeArray(bm);
        }
        const subTree = renderComponent(instance);
        patch(null, subTree, container, anchor, instance);
        instance.subTree = subTree;
        instance.isMounted = true;
        if (m) {
          invokeArray(m);
        }
      } else {
        const { next, bu, u } = instance;
        if (next) {
          updateComponentPreRender(instance, next);
        }
        if (bu) {
          invokeArray(bu);
        }
        const subTree = renderComponent(instance);
        patch(instance.subTree, subTree, container, anchor, instance);
        instance.subTree = subTree;
        if (u) {
          invokeArray(u);
        }
      }
    };
    const effect2 = new ReactiveEffect(
      componentUpdateFn,
      () => queueJob(update)
    );
    const update = instance.update = () => effect2.run();
    update();
  };
  const mountComponent = (vnode, container, anchor, parentComponent) => {
    const instance = vnode.component = createComponentInstance(
      vnode,
      parentComponent
    );
    if (isKeepAlive(vnode)) {
      instance.ctx.renderer = {
        createElement: hostCreateElement,
        // 内部需要创建一个div来缓存dom
        move(vnode2, container2, anchor2) {
          hostInsert(vnode2.component.subTree.el, container2, anchor2);
        },
        unmount
        // 如果切换组件需要讲现在容器中的元素移除
      };
    }
    setupComponent(instance);
    setupRenderEffect(instance, container, anchor, parentComponent);
  };
  const processText = (n1, n2, container) => {
    if (n1 === null) {
      hostInsert(n2.el = hostCreateText(n2.children), container);
    } else {
      const el = n2.el = n1.el;
      if (n1.children !== n2.children) {
        hostSetText(el, n2.children);
      }
    }
  };
  const processFragment = (n1, n2, container, anchor, parentComponent) => {
    if (n1 === null) {
      mountChildren(n2.children, container, anchor, parentComponent);
    } else {
      patchChildren(n1, n2, container, anchor, parentComponent);
    }
  };
  const processElement = (n1, n2, container, anchor, parentComponent) => {
    if (n1 === null) {
      mountElement(n2, container, anchor, parentComponent);
    } else {
      patchElement(n1, n2, container, anchor, parentComponent);
    }
  };
  const hasPropsChange = (prevProps, nextProps) => {
    let nextKeys = Object.keys(nextProps);
    if (nextKeys.length !== Object.keys(prevProps).length) {
      return true;
    }
    for (let i = 0; i < nextKeys.length; i++) {
      const key = nextKeys[i];
      if (nextProps[key] !== prevProps[key]) {
        return true;
      }
    }
    return false;
  };
  const updateProps = (instance, prevProps, nextProps) => {
    if (hasPropsChange(prevProps, nextProps)) {
      for (let key in nextProps) {
        instance.props[key] = nextProps[key];
      }
      for (let key in instance.props) {
        if (!(key in nextProps)) {
          delete instance.props[key];
        }
      }
    }
  };
  const shouldComponentUpdate = (n1, n2) => {
    const { props: prevProps, children: prevChildren } = n1;
    const { props: nextProps, children: nextChildren } = n2;
    if (prevChildren || nextChildren) return true;
    if (prevProps === nextProps) return false;
    return hasPropsChange(prevProps, nextProps || {});
  };
  const updateComponent = (n1, n2) => {
    const instance = n2.component = n1.component;
    if (shouldComponentUpdate(n1, n2)) {
      instance.next = n2;
      instance.update();
    }
  };
  const processComponent = (n1, n2, container, anchor, parentComponent) => {
    if (n1 === null) {
      if (n2.shapeFlag & 512 /* COMPONENT_KEPT_ALIVE */) {
        parentComponent.ctx.activate(n2, container, anchor);
      } else {
        mountComponent(n2, container, anchor, parentComponent);
      }
    } else {
      updateComponent(n1, n2);
    }
  };
  const patch = (n1, n2, container, anchor = null, parentComponent = null) => {
    if (n1 === n2) {
      return;
    }
    if (n1 && !isSameVnode(n1, n2)) {
      unmount(n1, parentComponent);
      n1 = null;
    }
    const { type, shapeFlag, ref: ref2 } = n2;
    switch (type) {
      case Text:
        processText(n1, n2, container);
        break;
      case Fragment:
        processFragment(n1, n2, container, anchor, parentComponent);
        break;
      default:
        if (shapeFlag & 1 /* ELEMENT */) {
          processElement(n1, n2, container, anchor, parentComponent);
        } else if (shapeFlag & 6 /* COMPONENT */) {
          processComponent(n1, n2, container, anchor, parentComponent);
        } else if (shapeFlag & 64 /* TELEPORT */) {
          type.process(n1, n2, container, anchor, parentComponent, {
            mountChildren,
            patchChildren,
            move(vnode, container2, anchor2) {
              hostInsert(
                vnode.component ? vnode.component.subTree.el : vnode.el,
                container2,
                anchor2
              );
            }
          });
        }
    }
    if (ref2 !== null) {
      setRef(ref2, n2);
    }
  };
  const setRef = (rawRef, vnode) => {
    let value = vnode.shapeFlag & 4 /* STATEFUL_COMPONENT */ ? vnode.component.exposed || vnode.component.proxy : vnode.el;
    if (isRef(rawRef)) {
      rawRef.value = value;
    }
  };
  const unmount = (vnode, parentComponent) => {
    const { shapeFlag, transition, el } = vnode;
    const performRemove = () => hostRemove(vnode.el);
    if (shapeFlag & 256 /* COMPONENT_SHOULD_KEEP_ALIVE */) {
      parentComponent.ctx.deactivate(vnode);
    }
    if (vnode.type === Fragment) {
      unmountChildren(vnode.children, parentComponent);
    } else if (shapeFlag & 6 /* COMPONENT */) {
      unmount(vnode.component.subTree, parentComponent);
    } else if (shapeFlag & 64 /* TELEPORT */) {
      vnode.type.remove(vnode, unmountChildren);
    } else {
      if (transition) {
        transition.leave(el, performRemove);
      } else {
        performRemove();
      }
    }
  };
  const render2 = (vnode, container) => {
    if (vnode === null) {
      if (container._vnode) {
        unmount(container._vnode, null);
      }
    } else {
      patch(container._vnode || null, vnode, container);
      container._vnode = vnode;
    }
  };
  return { render: render2 };
}

// packages/runtime-core/src/apiProvide.ts
function provide(key, value) {
  if (!currentInstance) return;
  const parentProvide = currentInstance.parent && currentInstance.parent?.provides;
  let provides = currentInstance.provides;
  if (parentProvide === provides) {
    provides = currentInstance.provides = Object.create(provides);
  }
  provides[key] = value;
}
function inject(key, defaultValue) {
  if (!currentInstance) return;
  const provides = currentInstance.parent?.provides;
  if (provides && key in provides) {
    return provides[key];
  } else if (arguments.length > 1) {
    return defaultValue;
  }
}

// packages/runtime-core/src/components/Transition.ts
function nextFrame(fn) {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn);
  });
}
function resolveTransitionProps(props) {
  const {
    name = "v",
    enterFromClass = `${name}-enter-form`,
    enterActiveClass = `${name}-enter-active`,
    enterToClass = `${name}-enter-to`,
    leaveFromClass = `${name}-leave-form`,
    leaveActiveClass = `${name}-leave-active`,
    leaveToClass = `${name}-leave-to`,
    onBeforeEnter,
    onEnter,
    onLeave
  } = props;
  return {
    onBeforeEnter(el) {
      onBeforeEnter && onBeforeEnter(el);
      el.classList.add(enterFromClass);
      el.classList.add(enterActiveClass);
    },
    onEnter(el, done) {
      const resolve = () => {
        el.classList.remove(enterToClass);
        el.classList.remove(enterActiveClass);
        done && done();
      };
      onEnter && onEnter(el, resolve);
      nextFrame(() => {
        el.classList.remove(enterFromClass);
        el.classList.remove(enterToClass);
        if (!onEnter || onEnter.length <= 1) {
          el.addEventListener("transitionEnd", resolve);
        }
      });
    },
    onLeave(el, done) {
      const resolve = () => {
        el.classList.remove(enterToClass);
        el.classList.remove(enterActiveClass);
        done && done();
      };
      onLeave && onLeave(el, resolve);
      el.classList.add(leaveFromClass);
      document.body.offsetHeight;
      el.classList.add(leaveToClass);
      nextFrame(() => {
        el.classList.remove(leaveFromClass);
        el.classList.add(leaveActiveClass);
        if (!onEnter || onEnter.length <= 1) {
          el.addEventListener("transitionEnd", resolve);
        }
      });
    }
  };
}
function Transition(props, { slots }) {
  console.log(props, slots);
  return h(BaseTransitionImple, resolveTransitionProps(props), slots);
}
var BaseTransitionImple = {
  props: {
    onBeforeEnter: Function,
    onEnter: Function,
    onLeave: Function
  },
  setup(props, { slots }) {
    return () => {
      const vnode = slots.default && slots.default();
      const instance = getCurrentInstance();
      if (!vnode) {
        return console.warn("default is required !!!");
      }
      vnode.transition = {
        beforeEnter: props.onBeforeEnter,
        enter: props.onEnter,
        leave: props.onLeave
      };
      return vnode;
    };
  }
};

// packages/runtime-core/src/defineAsyncComponent.ts
function defineAsyncComponent(options) {
  if (isFunction(options)) {
    options = { loader: options };
  }
  return {
    setup() {
      const loaded = ref(false);
      const error = ref(false);
      const loading = ref(false);
      let Comp = null;
      const { loader, errorComponent, timeout, delay, loadingComponent, onError } = options;
      let loadingTimer = null;
      if (delay) {
        loadingTimer = setTimeout(() => {
          loading.value = true;
        }, delay);
      }
      let attempts = 0;
      function loadFunc() {
        return loader().catch((err) => {
          if (onError) {
            return new Promise((resolve, reject) => {
              const retry = () => resolve(loadFunc());
              const fail = () => reject(loadFunc());
              onError(err, retry, fail, ++attempts);
            });
          } else {
            throw err;
          }
        });
      }
      loadFunc().then((comp) => {
        Comp = comp;
        loaded.value = true;
      }).catch((err) => {
        error.value = err;
      }).finally(() => {
        loading.value = false;
        clearTimeout(loadingTimer);
      });
      if (timeout) {
        setTimeout(() => {
          error.value = true;
          throw new Error("\u7EC4\u4EF6\u52A0\u8F7D\u8D85\u65F6\u4E86");
        }, timeout);
      }
      const placeholder = h("div");
      return () => {
        if (loaded.value) {
          return h(Comp);
        } else if (error.value && errorComponent) {
          return h(errorComponent);
        } else if (loading.value && loadingComponent) {
          return h(loadingComponent);
        } else {
          return placeholder;
        }
      };
    }
  };
}

// packages/runtime-dom/src/nodeOps.ts
var nodeOps = {
  insert: (el, parent, anchor) => parent.insertBefore(el, anchor || null),
  remove(el) {
    const parent = el.parentNode;
    if (parent) {
      parent.removeChild(el);
    }
  },
  createElement: (type) => document.createElement(type),
  createText: (text) => document.createTextNode(text),
  setText: (node, text) => node.nodeValue = text,
  setElementText: (el, text) => el.textContent = text,
  parentNode: (node) => node.parentNode,
  nextSibling: (node) => node.nextSibling
};

// packages/runtime-dom/src/modules/patchAttr.ts
function patchAttr(el, key, value) {
  if (value === null) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, value);
  }
}

// packages/runtime-dom/src/modules/patchClass.ts
function patchClass(el, value) {
  if (value === null) {
    el.removeAttribute("class");
  } else {
    el.className = value;
  }
}

// packages/runtime-dom/src/modules/patchEvent.ts
function createInvoker(nextValue) {
  const invoker = (e) => invoker.value(e);
  invoker.value = nextValue;
  return invoker;
}
function patchEvent(el, name, nextValue) {
  const invokers = el._vei || (el._evi = {});
  const eventName = name.slice(2).toLowerCase();
  const exitingInvokers = invokers[name];
  if (nextValue && exitingInvokers) {
    return exitingInvokers.value = nextValue;
  }
  if (nextValue) {
    const invoker = invokers[name] = createInvoker(nextValue);
    return el.addEventListener(eventName, invoker);
  }
  if (exitingInvokers) {
    el.removeEventListener(eventName, exitingInvokers);
    invokers[name] = void 0;
  }
}

// packages/runtime-dom/src/modules/patchStyle.ts
function patchStyle(el, prevValue, nextValue = {}) {
  let style = el.style;
  for (let key in nextValue) {
    style[key] = nextValue[key];
  }
  if (prevValue) {
    for (let key in prevValue) {
      if (nextValue) {
        if (nextValue[key] === null) {
          style[key] = null;
        }
      }
    }
  }
}

// packages/runtime-dom/src/patchProp.ts
function patchProp(el, key, prevValue, nextValue) {
  if (key === "class") {
    return patchClass(el, nextValue);
  } else if (key === "style") {
    return patchStyle(el, prevValue, nextValue);
  } else if (/^on[^a-z]/.test(key)) {
    return patchEvent(el, key, nextValue);
  } else {
    return patchAttr(el, key, nextValue);
  }
}

// packages/runtime-dom/src/index.ts
var renderOptions = Object.assign({ patchProp }, nodeOps);
var render = (vnode, container) => {
  return createRenderer(renderOptions).render(vnode, container);
};
export {
  Fragment,
  KeepAlive,
  LifeCycle,
  ReactiveEffect,
  Teleport,
  Text,
  Transition,
  activeEffect,
  closeBlock,
  computed,
  createComponentInstance,
  createElementBlock,
  createVnode as createElementVNode,
  createRenderer,
  createVnode,
  currentInstance,
  defineAsyncComponent,
  effect,
  getCurrentInstance,
  h,
  inject,
  invokeArray,
  isKeepAlive,
  isReactive,
  isRef,
  isSameVnode,
  isTeleport,
  isVnode,
  onBeforeMount,
  onBeforeUpdate,
  onMounted,
  onUpdated,
  openBlock,
  provide,
  proxyRefs,
  reactive,
  ref,
  render,
  renderOptions,
  resolveTransitionProps,
  setCurrentInstance,
  setupBlock,
  setupComponent,
  toDisplayString,
  toReactive,
  toRef,
  toRefs,
  trackEffect,
  trackRefValue,
  triggerEffect,
  triggerRefValue,
  unsetCurrentInstance,
  watch,
  watchEffect
};
//# sourceMappingURL=runtime-dom.js.map
