export function isObject(value) {
  return typeof value === "object" && value !== null;
}

export function isFunction(value) {
  return typeof value === "function";
}
export function isString(value) {
  return typeof value === "string";
}

export const hasOwnProperty = Object.prototype.hasOwnProperty;
export const hasOwn = (val, key) => hasOwnProperty.call(val, key);

export * from "./shapeFlags";

export * from "./patchFlags";
