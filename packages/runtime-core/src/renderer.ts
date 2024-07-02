import { ShapeFlags, hasOwn } from "@vue/shared";
import { Fragment, Text, isSameVnode } from "./createVnode";
import getSequence from "./seq";
import { ReactiveEffect, reactive } from "@vue/reactivity";
import { queueJob } from "./scheduler";
import { createComponentInstance, setupComponent } from "./component";

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
  const mountElement = (vnode, container, anchor) => {
    // console.log(vnode);
    const { type, children, props, shapeFlag } = vnode;

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
  const unmountChildren = (children) => {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i]);
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

  const patchChildren = (n1, n2, el) => {
    // children 数据类型为 array | text | null
    const c1 = n1 && n1.children;
    const prevShapeFlag = n1 ? n1.shapeFlag : 0;

    const c2 = n2.children;
    const nextShapeFlag = n2.shapeFlag;
    // console.log(prevShapeFlag, nextShapeFlag)
    if (nextShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1);
      }
      if (c1 !== c2) {
        hostSetElementText(el, c2);
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (nextShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 全量diff 算法，两个数组比对
          patchKeyChildren(c1, c2, el);
        } else {
          unmountChildren(c1);
        }
      } else {
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          hostSetElementText(el, "");
        }
        if (nextShapeFlag * ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(c2, el);
        }
      }
    }
  };
  const patchElement = (n1, n2, container) => {
    // 1 比较元素的差异， 肯定要复用dom元素
    // 2 比较属性和元素的子节点
    let el = (n2.el = n1.el);
    let oldProps = n1.props || {};
    let newProps = n2.props || {};
    // hostPatchProp 只针对一个属性进行处理
    patchProps(oldProps, newProps, el);
    patchChildren(n1, n2, el);
  };
  const setupRenderEffect = (instance, container, anchor) => {
    const { render } = instance;
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        // 第一次挂载
        const subTree = render.call(instance.proxy, instance.proxy);
        patch(null, subTree, container, anchor);
        instance.subTree = subTree;
        instance.isMounted = true;
      } else {
        const subTree = render.call(instance.proxy, instance.proxy);
        patch(instance.subTree, subTree, container, anchor);
        instance.subTree = subTree;
      }
    };
    const effect = new ReactiveEffect(componentUpdateFn, () =>
      queueJob(update)
    );
    const update = (instance.update = () => effect.run());
    update();
  };
  const mountComponent = (vnode, container, anchor) => {
    // 1 先创建组件实例
    const instance = (vnode.component = createComponentInstance(vnode));

    // 2 给实例的属性复制
    setupComponent(instance);

    // 3 创建一个effect
    setupRenderEffect(instance, container, anchor);
    // console.log(instance);
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
  const processFragment = (n1, n2, container) => {
    if (n1 === null) {
      mountChildren(n2.children, container);
    } else {
      patchChildren(n1, n2, container);
    }
  };
  // 对元素进行处理
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
      // patchComponent(n1,n2,container)
    }
  };
  // 渲染走这里，更新也走这里
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
        // console.log(type);
        processFragment(n1, n2, container);
        break;
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, anchor);
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // vue3中，赢废弃了函数式组件
          processComponent(n1, n2, container, anchor);
        }
    }
  };
  const unmount = (vnode) => hostRemove(vnode.el);
  const render = (vnode, container) => {
    // 将虚拟节点变成真实节点渲染
    // console.log(vnode, container, "render");
    if (vnode === null) {
      // 要移除
      if (container._vnode) {
        // console.log(container._vnode);
        unmount(container._vnode);
      }
    } else {
      patch(container._vnode || null, vnode, container);
      container._vnode = vnode;
    }
  };
  return { render };
}
