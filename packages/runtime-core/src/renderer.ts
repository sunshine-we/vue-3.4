import { PatchFlags, ShapeFlags, hasOwn } from "@vue/shared";
import { Fragment, Text, createVnode, isSameVnode } from "./createVnode";
import getSequence from "./seq";
import { ReactiveEffect, isRef, reactive } from "@vue/reactivity";
import { queueJob } from "./scheduler";
import { createComponentInstance, setupComponent } from "./component";
import { invokeArray } from "./apiLifecycle";
import { isKeepAlive } from "./components/KeepAlive";

export function createRenderer(renderOptions) {
  const {
    insert: hostInsert,
    remove: hostRemove,
    createElement: hostCreateElement,
    createText: hostCreateText,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    patchProp: hostPatchProp,
  } = renderOptions;
  const mountElement = (vnode, container, anchor, parentComponent) => {
    // console.log(vnode);
    const { type, children, props, shapeFlag, transition } = vnode;

    let el = (vnode.el = hostCreateElement(type));
    if (props) {
      for (let key in props) {
        hostPatchProp(el, key, null, props[key]);
      }
    }
    // 9 & 8 > 0  说明儿子是文本元素
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      hostSetElementText(el, children);
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
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
        if (
          typeof children[i] === "string" ||
          typeof children[i] === "number"
        ) {
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
    // 新的要全部生效
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
  // const patchKeyChildren = (c1, c2, el) => {
  //   let i = 0;
  //   const l2 = c2.length;
  //   let e1 = c1.length - 1;
  //   let e2 = l2 - 1;

  //   // 头头比较
  //   while (i <= el && i <= e2) {
  //     const n1 = c1[i];
  //     const n2 = c2[i];
  //     if (!isSameVnode(n1, n2)) {
  //       patch(n1, n2, el);
  //     } else {
  //       break;
  //     }
  //     i++;
  //   }
  //   // 尾尾比较
  //   while (i <= el && i <= e2) {
  //     const n1 = c1[el];
  //     const n2 = c2[e2];
  //     if (isSameVnode(n1, n2)) {
  //       patch(n1, n2, el);
  //     } else {
  //       break;
  //     }
  //     e1--;
  //     e2--;
  //   }
  //   // 新的多
  //   if (i > el) {
  //     if (i <= e2) {
  //       const nextPos = e2 + 1;
  //       const anchor = c2[nextPos];
  //       while (i <= e2) {
  //         patch(null, c2[i], el, anchor);
  //         i++;
  //       }
  //     }
  //   } else if (i > e2) {
  //     while (i <= e1) {
  //       unmount(c1[i]);
  //       i++;
  //     }
  //   } else {
  //     const s1 = i;
  //     const s2 = i;

  //     const keyToNewIndexMap = new Map();
  //     let toBePatched = e2 - s2 + 1; //要倒序插入的个数

  //     const newIndexToOldIndexMap = new Array(toBePatched).fill(0);

  //     for (let i = s2; i <= e2; i++) {
  //       const nextChild = c2[i];
  //       keyToNewIndexMap.set(nextChild.key, i);
  //     }
  //     for (let i = s1; i <= el; i++) {
  //       const prevChild = c1[i];
  //       let newIndex;
  //       newIndex = keyToNewIndexMap.get(prevChild.key);

  //       if (newIndex === undefined) {
  //         unmount(prevChild);
  //       } else {
  //         newIndexToOldIndexMap[newIndex - s2] = i + 1;
  //         patch(prevChild, c2, el);
  //       }
  //     }
  //     let increasingSeq = getSequence(newIndexToOldIndexMap);
  //     let j = increasingSeq.length - 1;
  //     for (let i = toBePatched - 1; i >= 0; i--) {
  //       let nextIndex = s2 + i;
  //       let nextChild = c2[nextIndex];
  //       let anchor = c2[nextIndex + 1]?.el;
  //       if (!nextChild.el) {
  //         patch(null, nextChild, el, anchor);
  //       } else {
  //         if (i != increasingSeq[j]) {
  //           hostInsert(nextChild.el, el, anchor);
  //         } else {
  //           j--;
  //         }
  //       }
  //     }
  //   }
  // };
  // vue3 中分为两种 全量diff（递归diff） 快速diff(靶向更新)->基于模板编译的
  const patchKeyChildren = (c1, c2, el, parentComponent) => {
    // 比较两个儿子的差异更新el
    // appendChild  removeChild  inserBefore
    // [a,b,c,e,f,d]
    // [a,b,c,e,f]
    // 1.减少比对范围， 先从头开始比，在从尾部开始比较  确定不一样的范围
    // 2. 从头比对， 在从尾巴比对，如果有多余的或者新增的直接操作即可

    // [a,b,c];
    // [a,b,d,e];

    let i = 0; // 开始比对的索引
    let e1 = c1.length - 1; // 第一个数组的尾部索引
    let e2 = c2.length - 1; // 第二个数组的尾部索引

    while (i <= e1 && i <= e2) {
      // 有任何一方循环结束了 就要终止比较
      const n1 = c1[i];
      const n2 = c2[i];
      if (isSameVnode(n1, n2)) {
        patch(n1, n2, el); // 更新当前节点的属性和儿子（递归比较子节点）
      } else {
        break;
      }
      i++;
    }
    // 到c的位置终止了
    // 到d的位置 终止
    // c
    // d e
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1];
      const n2 = c2[e2];
      // i =0
      // [a,b,c]  // e1 = 2
      // [d,a,b,c]; // e2 = 3
      if (isSameVnode(n1, n2)) {
        patch(n1, n2, el); // 更新当前节点的属性和儿子（递归比较子节点）
      } else {
        break;
      }
      e1--;
      e2--;
    }
    // [a,b] [a,b,c]  |  [a,b] [c,a,b ]
    // 处理增加和删除的特殊情况 [a,b,c] [a,b] |  [c,a,b] [a,b]

    // 最终比对乱序的情况

    // a b
    // a b c  ->   i = 2 , e1 = 1, e2 = 2     i>e1 && i<=e2

    //   a b
    // c a b ->    i = 0, e1 = -1  e2 = 0     i> e1 && i <=e2  新多老的少

    if (i > e1) {
      // 新的多
      if (i <= e2) {
        // 有插入的部分
        // insert()
        let nextPos = e2 + 1; // 看一下当前下一个元素是否存在
        let anchor = c2[nextPos]?.el;
        while (i <= e2) {
          patch(null, c2[i], el, anchor);
          i++;
        }
      }
      // a,b,c
      // a,b   i = 2   e1 = 2  e2 = 1    i>e2   i<=e1
    } else if (i > e2) {
      if (i <= e1) {
        // c,a,b
        // a,b    i = 0  e1= 1    e2=-1    i>e2   i<=e1
        while (i <= e1) {
          unmount(c1[i], parentComponent); // 将元素一个个删除
          i++;
        }
      }
    } else {
      // 以上确认不变化的节点，并且对插入和移除做了处理

      // 后面就是特殊的比对方式了

      let s1 = i;
      let s2 = i;

      const keyToNewIndexMap = new Map(); // 做一个映射表用于快速查找， 看老的是否在新的里面还有，没有就删除，有的话就更新
      let toBePatched = e2 - s2 + 1; // 要倒序插入的个数

      let newIndexToOldMapIndex = new Array(toBePatched).fill(0);

      // [4,2,3,0]  -> [1,2] 根据最长递增子序列求出对应的 索引结果

      // 格局新的节点，找到对应老的位置

      for (let i = s2; i <= e2; i++) {
        const vnode = c2[i];
        keyToNewIndexMap.set(vnode.key, i);
      }
      for (let i = s1; i <= e1; i++) {
        const vnode = c1[i];
        const newIndex = keyToNewIndexMap.get(vnode.key); // 通过key找到对应的索引
        if (newIndex == undefined) {
          // 如果新的里面找不到则说明老的有的要删除掉
          unmount(vnode, parentComponent);
        } else {
          // 比较前后节点的差异，更新属性和儿子
          // 我们i 可能是0的情况，为了保证0 是没有比对过的元素，直接 i+1
          newIndexToOldMapIndex[newIndex - s2] = i + 1; // [5,3,4,0]
          patch(vnode, c2[newIndex], el); // 服用
        }
      }

      // 调整顺序
      // 我们可以按照新的队列 倒序插入insertBefore 通过参照物往前面插入

      // 插入的过程中，可能新的元素的多，需要创建

      // 先从索引为3的位置倒序插入

      let increasingSeq = getSequence(newIndexToOldMapIndex);
      let j = increasingSeq.length - 1; // 索引
      for (let i = toBePatched - 1; i >= 0; i--) {
        // 3 2 1 0
        let newIndex = s2 + i; // h 对应的索引，找他的下一个元素作为参照物，来进行插入
        let anchor = c2[newIndex + 1]?.el;
        let vnode = c2[newIndex];
        if (!vnode.el) {
          // 新列表中新增的元素
          patch(null, vnode, el, anchor); // 创建h插入
        } else {
          if (i == increasingSeq[j]) {
            j--; // 做了diff算法有的优化
          } else {
            hostInsert(vnode.el, el, anchor); // 接着倒序插入
          }
        }
      }
      // 倒序比对每一个元素，做插入操作
    }
  };

  const patchChildren = (n1, n2, el, anchor, parentComponent) => {
    // children 数据类型为 array | text | null
    const c1 = n1 && n1.children;
    const prevShapeFlag = n1 ? n1.shapeFlag : 0;

    const c2 = normalize(n2.children);
    const nextShapeFlag = n2.shapeFlag;
    // console.log(prevShapeFlag, nextShapeFlag)
    if (nextShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1, parentComponent);
      }
      if (c1 !== c2) {
        hostSetElementText(el, c2);
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (nextShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 全量diff 算法，两个数组比对
          patchKeyChildren(c1, c2, el, parentComponent);
        } else {
          unmountChildren(c1, parentComponent);
        }
      } else {
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          hostSetElementText(el, "");
        }
        if (nextShapeFlag * ShapeFlags.ARRAY_CHILDREN) {
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
    // 1 比较元素的差异， 肯定要复用dom元素
    // 2 比较属性和元素的子节点
    let el = (n2.el = n1.el);
    let oldProps = n1.props || {};
    let newProps = n2.props || {};

    // 靶向更新逻辑开始
    const { patchFlag, dynamicChildren } = n2;
    if (patchFlag) {
      if (patchFlag & PatchFlags.TEXT) {
        if (n1.children !== n2.children) {
          hostSetElementText(el, n2.children);
        }
        if (patchFlag & PatchFlags.CLASS) {
          // todo
          if (oldProps.class !== newProps.class) {
            hostPatchProp(el, "class", null, newProps.class);
          }
        }
        if (patchFlag & PatchFlags.STYLE) {
          //to do
          hostPatchProp(el, "style", oldProps.style, newProps.style);
        }
      }
    } else {
      patchProps(oldProps, newProps, el);
    }
    if (dynamicChildren) {
      patchBlockChildren(n1, n2, el, anchor, parentComponent);
    } else {
      // 全量diff
      patchChildren(n1, n2, el, anchor, parentComponent);
    }
    // 靶向更新逻辑结束

    // hostPatchProp 只针对一个属性进行处理
  };
  const updateComponentPreRender = (instance, next) => {
    instance.next = null;
    instance.vnode = next;
    updateProps(instance, instance.props, next.props || {});
    // 组件更新的时候，需要更新插槽
    Object.assign(instance.slots, next.children);
  };

  function renderComponent(instance) {
    const { render, vnode, proxy, attrs, slots, props } = instance;
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      return render.call(proxy, proxy);
    } else {
      return vnode.type(attrs, { slots });
    }
  }
  const setupRenderEffect = (instance, container, anchor, parentComponent) => {
    const { render } = instance;
    const componentUpdateFn = () => {
      // 我们这里区分是第一次的还是之后的额
      const { bm, m } = instance;
      if (!instance.isMounted) {
        if (bm) {
          invokeArray(bm);
        }
        // 第一次挂载
        // const subTree = render.call(instance.proxy, instance.proxy);
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
        // const subTree = render.call(instance.proxy, instance.proxy);
        const subTree = renderComponent(instance);
        patch(instance.subTree, subTree, container, anchor, instance);
        instance.subTree = subTree;
        if (u) {
          invokeArray(u);
        }
      }
    };
    const effect = new ReactiveEffect(componentUpdateFn, () =>
      queueJob(update)
    );
    const update = (instance.update = () => effect.run());
    update();
  };
  const mountComponent = (vnode, container, anchor, parentComponent) => {
    // 1 先创建组件实例
    const instance = (vnode.component = createComponentInstance(
      vnode,
      parentComponent
    ));

    if (isKeepAlive(vnode)) {
      instance.ctx.renderer = {
        createElement: hostCreateElement, // 内部需要创建一个div来缓存dom
        move(vnode, container, anchor) {
          // 需要把之前渲染的dom放入到容器中
          hostInsert(vnode.component.subTree.el, container, anchor);
        },
        unmount, // 如果切换组件需要讲现在容器中的元素移除
      };
    }

    // 2 给实例的属性复制
    setupComponent(instance);

    // 3 创建一个effect
    setupRenderEffect(instance, container, anchor, parentComponent);
  };
  const processText = (n1, n2, container) => {
    if (n1 === null) {
      // 1 虚拟节点要关联真实节点
      // 2 将节点插入到页面中
      hostInsert((n2.el = hostCreateText(n2.children)), container);
    } else {
      const el = (n2.el = n1.el);
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
  // 对元素进行处理
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

    if (prevChildren || nextChildren) return true; // 有插槽，直接更新渲染即可
    if (prevProps === nextProps) return false;
    // updateProps(instance, prevProps, nextProps)
    return hasPropsChange(prevProps, nextProps || {});
  };
  const updateComponent = (n1, n2) => {
    const instance = (n2.component = n1.component);
    if (shouldComponentUpdate(n1, n2)) {
      instance.next = n2; // 如果调用update 有next属性，说明是属性更新，或者插槽更新

      instance.update();
    }
    // const { props: prevProps } = n1
    // const { props: nextProps } = n2
    // updateProps(instance, prevProps, nextProps)
  };
  const processComponent = (n1, n2, container, anchor, parentComponent) => {
    if (n1 === null) {
      if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
        // 需要走keepAlivede 激活逻辑
        parentComponent.ctx.activate(n2, container, anchor);
      } else {
        mountComponent(n2, container, anchor, parentComponent);
      }
    } else {
      // patchComponent(n1,n2,container)
      updateComponent(n1, n2);
    }
  };
  // 渲染走这里，更新也走这里
  const patch = (n1, n2, container, anchor = null, parentComponent = null) => {
    if (n1 === n2) {
      return;
    }
    if (n1 && !isSameVnode(n1, n2)) {
      unmount(n1, parentComponent);
      n1 = null;
    }
    const { type, shapeFlag, ref } = n2;

    switch (type) {
      case Text:
        processText(n1, n2, container);
        break;
      case Fragment:
        // console.log(type);
        processFragment(n1, n2, container, anchor, parentComponent);
        break;
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, anchor, parentComponent);
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // vue3中，赢废弃了函数式组件
          processComponent(n1, n2, container, anchor, parentComponent);
        } else if (shapeFlag & ShapeFlags.TELEPORT) {
          type.process(n1, n2, container, anchor, parentComponent, {
            mountChildren,
            patchChildren,
            move(vnode, container, anchor) {
              hostInsert(
                vnode.component ? vnode.component.subTree.el : vnode.el,
                container,
                anchor
              );
            },
          });
        }
    }
    if (ref !== null) {
      setRef(ref, n2);
    }
  };
  const setRef = (rawRef, vnode) => {
    let value =
      vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT
        ? vnode.component.exposed || vnode.component.proxy
        : vnode.el;
    if (isRef(rawRef)) {
      rawRef.value = value;
    }
  };
  const unmount = (vnode, parentComponent) => {
    const { shapeFlag, transition, el } = vnode;
    const performRemove = () => hostRemove(vnode.el);
    if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
      // 需要找keep 走失活逻辑
      parentComponent.ctx.deactivate(vnode);
    }
    if (vnode.type === Fragment) {
      unmountChildren(vnode.children, parentComponent);
    } else if (shapeFlag & ShapeFlags.COMPONENT) {
      unmount(vnode.component.subTree, parentComponent);
    } else if (shapeFlag & ShapeFlags.TELEPORT) {
      vnode.type.remove(vnode, unmountChildren);
    } else {
      if (transition) {
        transition.leave(el, performRemove);
      } else {
        performRemove();
      }
      // hostRemove(vnode.el);
    }
  };
  const render = (vnode, container) => {
    // 将虚拟节点变成真实节点渲染
    // console.log(vnode, container, "render");
    if (vnode === null) {
      // 要移除
      if (container._vnode) {
        // console.log(container._vnode);
        unmount(container._vnode, null);
      }
    } else {
      patch(container._vnode || null, vnode, container);
      container._vnode = vnode;
    }
  };
  return { render };
}
