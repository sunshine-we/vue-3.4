import { currentInstance } from "./component";

export function provide(key, value) {
  if (!currentInstance) return;
  const parentProvide =
    currentInstance.parent && currentInstance.parent?.provides;
  let provides = currentInstance.provides;
  if (parentProvide === provides) {
    provides = currentInstance.provides = Object.create(provides);
  }
  provides[key] = value;
}

export function inject(key, defaultValue) {
  if (!currentInstance) return;
  const provides = currentInstance.parent?.provides;

  if (provides && key in provides) {
    return provides[key];
  } else if (arguments.length > 1) {
    return defaultValue;
  }
}
