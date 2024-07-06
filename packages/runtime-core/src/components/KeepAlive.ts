import { ShapeFlags } from "@vue/shared";
import { onMounted, onUpdated } from "../apiLifecycle";
import { getCurrentInstance } from "../component";

export const KeepAlive = {
  __isKeepAlive: true,
  props: {
    max: Number,
  },
  setup(props, { slots }) {
    const { max } = props;
    const keys = new Set();
    const cache = new Map();
    let pendingCacheKey = null;
    const instance = getCurrentInstance();

    const { move, createElement, unmount: _unmount } = instance.ctx.renderer;
    function reset(vnode) {
      let shapeFlag = vnode.shapeFlag;
      if (shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
        shapeFlag -= ShapeFlags.COMPONENT_KEPT_ALIVE;
      } else if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
        shapeFlag -= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;
      }
      vnode.shapeFlag = shapeFlag;
    }
    function unmount(cache) {
      reset(cache) // 删除之前去除vnode 上的 shapeFlag
      _unmount(cache) // 真正的删除dom
    }

    function purneCacheEntry(key) {
      keys.delete(key);
      const cached = cache.get(key);
      unmount(cached);
    }
    instance.ctx.activate = function (vnode, container, anchor) {
      move(vnode, container, anchor);
    };
    // 卸载的时候执行
    const storageContent = createElement("div");
    instance.ctx.deactivate = function (vnode, container, anchor) {
      move(vnode, storageContent, anchor); // 将dom元素临时移动到这个 div 中但是没有被销毁
    };
    const cacheSubTree = () => {
      cache.set(pendingCacheKey, instance.subTree);
      console.log(cache);
    };
    onMounted(cacheSubTree);
    onUpdated(cacheSubTree);
    return () => {
      // debugger
      const vnode = slots.default();
      const comp = vnode.type;
      const key = vnode.key === null ? comp : vnode.key;
      const cacheVNode = cache.get(key);
      pendingCacheKey = key;
      if (cacheVNode) {
        vnode.component = cacheVNode.component;
        vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE; // 不要做初始化操作
        keys.delete(key);
        keys.add(key);
      } else {
        keys.add(key);
        console.log(max, keys.size)
        if (max && keys.size > max) {
          purneCacheEntry(keys.values().next().value);
        }
      }
      vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE; // 这个组件b不需要被真的卸载， 卸载的dom临时存放在存储容器中
      return vnode;
    };
  },
};
export const isKeepAlive = (v) => v.type.__isKeepAlive;
