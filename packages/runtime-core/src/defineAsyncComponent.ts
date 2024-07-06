import { ref } from "@vue/reactivity";
import { h } from "./h";
import { isFunction } from "@vue/shared";

export function defineAsyncComponent(options) {
  if (isFunction(options)) {
    options = { loader: options };
  }
  return {
    setup() {
      const loaded = ref(false);
      const error = ref(false);
      const loading = ref(false);
      let Comp = null;
      const { loader, errorComponent, timeout, delay, loadingComponent,onError} =
        options;

      let loadingTimer = null;
      if (delay) {
        loadingTimer = setTimeout(() => {
          loading.value = true;
        }, delay);
      }
      let attempts = 0
      function loadFunc() {
        return loader().catch(err => {
          if (onError) {
            return new Promise((resolve, reject) => {
              const retry = () => resolve(loadFunc())
              const fail = () => reject(loadFunc())
              onError(err, retry, fail, ++attempts)
            })
          } else {
            throw err
          }
        })
      }
      loadFunc()
        .then((comp) => {
          Comp = comp;
          loaded.value = true;
          // error.value = false
        })
        .catch((err) => {
          error.value = err;
        })
        .finally(() => {
          loading.value = false;
          clearTimeout(loadingTimer);
        });
      if (timeout) {
        setTimeout(() => {
          error.value = true;
          throw new Error("组件加载超时了");
        }, timeout);
      }

      const placeholder = h("div");
      return () => {
        if (loaded.value) {
          return h(Comp);
        } else if (error.value && errorComponent) {
          return h(errorComponent);
        } else if (loading.value && loadingComponent) {
          return h(loadingComponent);
        } else {
          return placeholder;
        }
      };
    },
  };
}
