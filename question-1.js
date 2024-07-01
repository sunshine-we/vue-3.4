const person = {
  name: 'ss',
  get aliasName() {
    return this.name + 'handsome'
  }
}

let proxyPerson = new Proxy(person, {
  get(target, key, recevier) {
    console.log(key)
    // return target[key]
    return Reflect.get(target, key, recevier)
  }
})
// console.log(person.aliasName())
console.log(proxyPerson.aliasName) 