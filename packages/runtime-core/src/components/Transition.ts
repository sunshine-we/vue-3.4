import { getCurrentInstance } from "../component";
import { h } from "../h";

// 下一帧进行执行
function nextFrame(fn) {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn);
  });
}
export function resolveTransitionProps(props) {
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
    onLeave,
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
        // document.body.offsetHeight;
        el.classList.add(leaveActiveClass);
        if (!onEnter || onEnter.length <= 1) {
          el.addEventListener("transitionEnd", resolve);
        }
      });
    },
  };
}

export function Transition(props, { slots }) {
  console.log(props, slots);
  // 函数式组件的功能比较少，为了方便函数式组件处理属性
  // 处理属性后传递给 状态组件 setup
  return h(BaseTransitionImple, resolveTransitionProps(props), slots);
}

const BaseTransitionImple = {
  props: {
    onBeforeEnter: Function,
    onEnter: Function,
    onLeave: Function,
  },
  setup(props, { slots }) {
    return () => {
      const vnode = slots.default && slots.default();
      const instance = getCurrentInstance();
      if (!vnode) {
        return console.warn("default is required !!!");
      }

      // const oldVnode = instance.subTree;// 之前的虚拟节点
      vnode.transition = {
        beforeEnter: props.onBeforeEnter,
        enter: props.onEnter,
        leave: props.onLeave,
      };
      return vnode;
    };
  },
};
