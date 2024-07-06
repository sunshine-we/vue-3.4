import { proxyRefs, reactive } from "@vue/reactivity";
import { ShapeFlags, hasOwn, isFunction } from "@vue/shared";

export function createComponentInstance(vnode, parentComponent) {
  const instance = {
    data: null, // 组件的状态
    vnode, // 组件的虚拟节点
    subTree: null, // 子树
    isMounted: null, // 是否挂载完成
    update: null, // 组件的更新函数
    props: {},
    attrs: {},
    slots: {},
    propsOptions: vnode.type.props, // 用户声明的那些属性是组件的属性
    component: null,
    proxy: null, // 用来代理 props attrs, data 让用户更方便的使用
    setupState: {},
    exposed: null,
    parent: parentComponent,
    provides: parentComponent ? parentComponent.provides : Object.create(null),
    ctx: {} as any, // 如果是keepAlive 组件，就将dom api放入到这个属性上
  };
  return instance;
}
const publicProperty = {
  $attrs: (instance) => instance.attrs,
  $slots: (instance) => instance.slots,
};
const handle = {
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
      // return props[key] = value
      console.warn("props are readonly");
      return false;
    } else if (setupState && hasOwn(setupState, key)) {
      setupState[key] = value;
    }
  },
};

export function setupComponent(instance) {
  const { vnode } = instance;
  // 赋值属性
  initProps(instance, vnode.props);
  initSlots(instance, vnode.children);
  // 赋值代理对象
  instance.proxy = new Proxy(instance, handle);

  const { data = () => {}, render, setup } = vnode.type;
  if (setup) {
    const setupContext = {
      // todo...
      slots: instance.slots,
      attrs: instance.attrs,
      emit(event, ...payload) {
        const eventName = `on${event[0].toUpperCase() + event.slice(1)}`;
        const handle = instance.vnode.props[eventName];
        handle && handle(...payload);
      },
      expose: (v) => {
        instance.exposed = v;
      },
    };
    setCurrentInstance(instance);
    const setupResult = setup(instance.props, setupContext);
    unsetCurrentInstance();
    if (isFunction(setupResult)) {
      instance.render = setupResult;
    } else {
      instance.setupState = proxyRefs(setupResult); // 将返回的值，脱ref
    }
  }

  if (data && !isFunction(data)) {
    console.warn("data option must be a function");
  } else {
    instance.data = reactive(data.call(instance.proxy, instance.proxy));
  }

  if (!instance.render) {
    instance.render = render;
  }
}

const initProps = (instance, rawProps) => {
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
const initSlots = (instance, children) => {
  if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    instance.slots = children;
  } else {
    instance.slots = {};
  }
};

export let currentInstance = null;
export const getCurrentInstance = () => {
  return currentInstance;
};
export const setCurrentInstance = (instance) => {
  return (currentInstance = instance);
};
export const unsetCurrentInstance = () => {
  return (currentInstance = null);
};
