import { isObject } from "@vue/shared"
import { activeEffect } from "./effect"
import { track, trigger } from "./reactiveEffect"
import { reactive } from "./reactive"
import { ReactiveFlags } from "./constants"


const mutableHandlers: ProxyHandler<any> = {
  get(target, key, recevier) { 
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true
    }
    // debugger
    // 取值的时候依赖收集 todo

    
    track(target, key, recevier)
    const res = Reflect.get(target, key, recevier);
    if (isObject(res)) {
      return reactive(res)
    }
    return res
  },
  set(target, key, value, recevier) {
    // debugger
    // 触发更新 todo
    let oldValue = target[key]
    let result = Reflect.set(target, key,value, recevier)
    if (oldValue !== value) {
      // 需要触发页面更新

      trigger(target, key, oldValue, value)
    }
    return result
  },
}

export {
  ReactiveFlags, mutableHandlers
}