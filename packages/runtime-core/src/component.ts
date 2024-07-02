import { reactive } from "@vue/reactivity";
import { hasOwn, isFunction } from "@vue/shared";

export function createComponentInstance(vnode) {
  const instance = {
    data: null, // 组件的状态
    vnode, // 组件的虚拟节点
    subTree: null, // 子树
    isMounted: null, // 是否挂载完成
    update: null, // 组件的更新函数
    props: {},
    attrs: {},
    propsOptions: vnode.type.props, // 用户声明的那些属性是组件的属性
    component: null,
    proxy: null, // 用来代理 props attrs, data 让用户更方便的使用
  };
  return instance;
}
const publicProperty = {
  $attrs: (instance) => instance.attrs,
};
const handle = {
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
      return (state[key] = value);
    } else if (props && hasOwn(props, key)) {
      // return props[key] = value
      console.warn("props are readonly");
      return false;
    } 
  },
};

export function setupComponent(instance) {
  const { vnode } = instance;
  // 赋值属性
  initPorps(instance, vnode.props);

  // 赋值代理对象
  instance.proxy = new Proxy(instance, handle);

  const { data , render} = vnode.type;
  if (!isFunction(data)) return console.warn('data option must be a function')
  instance.data = reactive(data.call(instance.proxy, instance.proxy))
  
  instance.render = render
}



const initPorps = (instance, rawProps) => {
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
