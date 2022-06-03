import { reactive } from "./reactive"

//普通类型响应式数据
export function ref(val){
    const wrapper = {
        value: val
    }
    
    //作为普通类型响应式数据的标识
    Object.defineProperty(wrapper, '__v_isRef', {
        value: true
    })

    return reactive(wrapper)
}

export function toRef(obj,key){
    const wrapper = {
        get value(){
            return obj[key]
        },
        set value(val){
            obj[key] = val
        }
    }

    Object.defineProperty(wrapper, '__v_isRef', {
        value: true
    })

    return wrapper
}

export function toRefs(obj){
    const ret = {}

    for(let key in obj){
        ret[key] = toRef(obj, key)
    }

    return ret
}

export function proxyRefs(target){
    return new Proxy(target, {
        get(target, key, receiver){
            const value = Reflect.get(target, key, receiver)
            return value.__v_isRef ? value.value : value
        },
        set(target, key, val, receiver){
            const value = target[key]
            if(value.__v_isRef){
                value.value = val
                return true
            }

            return Reflect.set(target, key, val, receiver)
        }
    })
}