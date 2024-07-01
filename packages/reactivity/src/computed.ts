import { isFunction } from "@vue/shared";
import { ReactiveEffect } from "./effect";
import { trackRefValue, triggerRefValue } from "./ref";

export function computed(getterOrOptions) {
  let onlyGetter = isFunction(getterOrOptions)
  let getter;
  let setter;
  if (onlyGetter) {
    getter = onlyGetter;
    setter = () => { }
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  // console.log(getter, setter)
  return new ComputedRefImpl(getter, setter)
}


class ComputedRefImpl{
  public _value;
  public effect;
  constructor(getter, public setter) {
    // 我们需要创建一个effect，来关联当前计算属性的dirty属性
    this.effect = new ReactiveEffect(() => getter(this._value), () => {
      // 计算属性的值发生变化，我们应该触发渲染
      triggerRefValue(this)
    })
  }
  get value() {
    // 这里我么需要做额外处理
    if (this.effect.dirty) {
      this._value = this.effect.run() // 这一步触发副作用函数，收集依赖
      // 如果当前在effect中访问了这个计算属性，计算属性是可以收集这个
      trackRefValue(this)
    }
    return this._value
  }
  set value(v) {
    this.setter(v)
  }
}