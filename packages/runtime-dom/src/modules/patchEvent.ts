function createInvoker(nextValue) {
  const invoker = (e) => invoker.value(e)
  invoker.value = nextValue;
  return invoker;
}
export function patchEvent(el, name, nextValue) {
  const invokers = el._vei || (el._evi = { })
  const eventName = name.slice(2).toLowerCase();
  //  处理已经存在的函数
  const exitingInvokers = invokers[name]
  if (nextValue && exitingInvokers) {
    return exitingInvokers.value = nextValue
  }
  if (nextValue) {
    const invoker = (invokers[name] = createInvoker(nextValue))
    return el.addEventListener(eventName, invoker)
  }
  if (exitingInvokers) {
    el.removeEventListener(eventName, exitingInvokers);
    invokers[name] = undefined
  }
}