// 实现最长递增子序列

function getSequence(arr) {
  const p = arr.slice();
  // console.log('p', p)
  const result = [0];
  let start;
  let end;
  let middle;
  const len = arr.length;
  for (let i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      // 为了 vue3 而处理掉数组中的0的情况
      // 拿出结果集合对应的最后一项，和我当前的这一项做对比
      let resultLastIndex = result[result.length - 1];
      if (arr[resultLastIndex] < arrI) {
        result.push(i);
        continue;
      }
    }
    start = 0; // 开始位置
    end = result.length - 1; //结束位置;
    while (start < end) {
      middle = ((start + end) / 2) | 0;
      if (arr[result[middle]] < arrI) {
        start = middle + 1;
      } else {
        end = middle
      }
    }
    if (arrI < arr[result[start]]) {
      result[start] = i
    }
  }
  return result;
}

// console.log(getSequence([2,6,7,8,9,11]))
const arr = [2, 3, 1, 5, 6, 8, 7, 9, 4];
console.log(getSequence(arr));
let start = 0;
let end = arr.length - 1;
let middle = (start + end) >> 1;
console.log(middle, "middle1");
let middle2 = ((start + end) / 2) | 0;
console.log(middle2, "middle2");
