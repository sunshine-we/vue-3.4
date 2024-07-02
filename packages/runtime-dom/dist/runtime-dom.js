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

// packages/runtime-core/src/createVnode.ts
function createVnode(type, props, children) {
  const shapeFlag = isString(type) ? 1 /* ELEMENT */ : isObject(type) ? 4 /* STATEFUL_COMPONENT */ : 0;
  const vnode = {
    __v_isVnode: true,
    type,
    props,
    children,
    key: props?.key,
    // diff算法后面需要的key
    el: null,
    // 虚拟节点需要对应的真实节点是谁
    shapeFlag
  };
  if (children) {
    if (Array.isArray(children)) {
      vnode.shapeFlag |= 16 /* ARRAY_CHILDREN */;
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
var activeEffect;
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
function trackEffect(effect, dep) {
  if (dep.get(effect) !== effect._trackId) {
    dep.set(effect, effect._trackId);
    let oldDep = effect.deps[effect._depsLength];
    if (oldDep !== dep) {
      if (oldDep) {
        cleanDepEffect(oldDep, effect);
      }
      effect.deps[effect._depsLength++] = dep;
    } else {
      effect._depsLength++;
    }
  }
}
function triggerEffect(deps) {
  for (const effect of deps.keys()) {
    if (effect._dirtyLevel < 4 /* Dirty */) {
      effect._dirtyLevel = 4 /* Dirty */;
    }
    if (!effect._running) {
      if (effect.scheduler) {
        effect.scheduler();
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

// packages/runtime-core/src/scheduler.ts
var queue = [];
var isFlushing = false;
var resolvePromise = Promise.resolve();
function queueJob(job) {
  debugger;
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
function createComponentInstance(vnode) {
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
    propsOptions: vnode.type.props,
    // 用户声明的那些属性是组件的属性
    component: null,
    proxy: null
    // 用来代理 props attrs, data 让用户更方便的使用
  };
  return instance;
}
var publicProperty = {
  $attrs: (instance) => instance.attrs
};
var handle = {
  get(target, key) {
    const { state, props, attrs } = target;
    if (state && hasOwn(state, key)) {
      return state[key];
    } else if (props && hasOwn(props, key)) {
      return props[key];
    }
    const getter = publicProperty[key];
    if (getter) {
      return getter(target);
    }
  },
  set(target, key, value) {
    const { state, props, attrs } = target;
    if (state && hasOwn(state, key)) {
      return state[key] = value;
    } else if (props && hasOwn(props, key)) {
      console.warn("props are readonly");
      return false;
    }
  }
};
function setupComponent(instance) {
  const { vnode } = instance;
  initPorps(instance, vnode.props);
  instance.proxy = new Proxy(instance, handle);
  const { data, render: render2 } = vnode.type;
  if (!isFunction(data)) return console.warn("data option must be a function");
  instance.data = reactive(data.call(instance.proxy, instance.proxy));
  instance.render = render2;
}
var initPorps = (instance, rawProps) => {
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
  const mountElement = (vnode, container, anchor) => {
    const { type, children, props, shapeFlag } = vnode;
    let el = vnode.el = hostCreateElement(type);
    if (props) {
      for (let key in props) {
        hostPatchProp(el, key, null, props[key]);
      }
    }
    if (shapeFlag & 8 /* TEXT_CHILDREN */) {
      hostSetElementText(el, children);
    } else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
      mountChildren(children, el);
    }
    hostInsert(el, container, anchor);
  };
  const mountChildren = (children, container) => {
    for (let i = 0; i < children.length; i++) {
      patch(null, children[i], container);
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
  const unmountChildren = (children) => {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i]);
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
  const patchChildren = (n1, n2, el) => {
    const c1 = n1 && n1.children;
    const prevShapeFlag = n1 ? n1.shapeFlag : 0;
    const c2 = n2.children;
    const nextShapeFlag = n2.shapeFlag;
    if (nextShapeFlag & 8 /* TEXT_CHILDREN */) {
      if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
        unmountChildren(c1);
      }
      if (c1 !== c2) {
        hostSetElementText(el, c2);
      }
    } else {
      if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
        if (nextShapeFlag & 16 /* ARRAY_CHILDREN */) {
          patchKeyChildren(c1, c2, el);
        } else {
          unmountChildren(c1);
        }
      } else {
        if (prevShapeFlag & 8 /* TEXT_CHILDREN */) {
          hostSetElementText(el, "");
        }
        if (nextShapeFlag * 16 /* ARRAY_CHILDREN */) {
          mountChildren(c2, el);
        }
      }
    }
  };
  const patchElement = (n1, n2, container) => {
    let el = n2.el = n1.el;
    let oldProps = n1.props || {};
    let newProps = n2.props || {};
    patchProps(oldProps, newProps, el);
    patchChildren(n1, n2, el);
  };
  const setupRenderEffect = (instance, container, anchor) => {
    const { render: render3 } = instance;
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        const subTree = render3.call(instance.proxy, instance.proxy);
        patch(null, subTree, container, anchor);
        instance.subTree = subTree;
        instance.isMounted = true;
      } else {
        const subTree = render3.call(instance.proxy, instance.proxy);
        patch(instance.subTree, subTree, container, anchor);
        instance.subTree = subTree;
      }
    };
    const effect = new ReactiveEffect(
      componentUpdateFn,
      () => queueJob(update)
    );
    const update = instance.update = () => effect.run();
    update();
  };
  const mountComponent = (vnode, container, anchor) => {
    const instance = vnode.component = createComponentInstance(vnode);
    setupComponent(instance);
    setupRenderEffect(instance, container, anchor);
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
  const processFragment = (n1, n2, container) => {
    if (n1 === null) {
      mountChildren(n2.children, container);
    } else {
      patchChildren(n1, n2, container);
    }
  };
  const processElement = (n1, n2, container, anchor) => {
    if (n1 === null) {
      mountElement(n2, container, anchor);
    } else {
      patchElement(n1, n2, container);
    }
  };
  const processComponent = (n1, n2, container, anchor) => {
    if (n1 === null) {
      mountComponent(n2, container, anchor);
    } else {
    }
  };
  const patch = (n1, n2, container, anchor = null) => {
    if (n1 === n2) {
      return;
    }
    if (n1 && !isSameVnode(n1, n2)) {
      unmount(n1);
      n1 = null;
    }
    const { type, shapeFlag } = n2;
    switch (type) {
      case Text:
        processText(n1, n2, container);
        break;
      case Fragment:
        processFragment(n1, n2, container);
        break;
      default:
        if (shapeFlag & 1 /* ELEMENT */) {
          processElement(n1, n2, container, anchor);
        } else if (shapeFlag & 6 /* COMPONENT */) {
          processComponent(n1, n2, container, anchor);
        }
    }
  };
  const unmount = (vnode) => hostRemove(vnode.el);
  const render2 = (vnode, container) => {
    if (vnode === null) {
      if (container._vnode) {
        unmount(container._vnode);
      }
    } else {
      patch(container._vnode || null, vnode, container);
      container._vnode = vnode;
    }
  };
  return { render: render2 };
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
  Text,
  createRenderer,
  createVnode,
  h,
  isSameVnode,
  isVnode,
  render,
  renderOptions
};
//# sourceMappingURL=runtime-dom.js.map
