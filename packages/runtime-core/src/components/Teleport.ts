import { ShapeFlags } from "@vue/shared";

export const Teleport = {
  __isTeleport: true,
  process(n1, n2, container, anchor, parentComponent, internals) {
    let { mountChildren, patchChildren, move } = internals;

    if (!n1) {
      const target = (n2.target = document.querySelector(n2.props.to));
      if (target) {
        mountChildren(n2.children, target, parentComponent);
      }
    } else {
      console.log(n1, n2);
      const target = (n2.target = n1.target);
      patchChildren(n1, n2, target, parentComponent);
      if (n1.props.to !== n2.props.to) {
        const nextTarget = (n2.target = document.querySelector(n2.props.to));
        n2.children.forEach((child) => move(child, nextTarget, anchor));
      }
    }
  },
  remove(vnode, unmountChildren) {
    const { shapeFlag, children } = vnode;
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      unmountChildren(children);
    }
  },
};

export const isTeleport = (v) => v.__isTeleport;
