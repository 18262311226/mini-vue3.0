import { track, trigger } from "./effect"
let proxys = new Set()
export const ITERATE_KEY = Symbol()

//创建响应式数据
function createReactive(obj, isShallow = false, isReadyonly = false){
    //判断是否式对象且不为null
    if(obj == null || typeof obj !== 'object'){
        throw new Error('is not a Object')
    }

    //判断该对象是否已经是响应式数据
    if(proxys.has(obj)){
        return
    }

    //创建代理对象
    let proxy = new Proxy(obj, {
        get(target,key){
            if(key === 'raw'){
                return target
            }

            //不是只读数据，则收集副作用函数
            if(!isReadyonly){
                track(target,key, receiver) 
            }

            const res = Reflect.get(target, key, receiver)

            //是浅响应式数据则直接返回该数据，不做处理
            if(isShallow){
                return res
            }

            if(typeof res === 'object' && res !== null){//如果是该数据还是对象，则对他进行处理
                return isReadyonly ? readonly(res) : reactive(res) //判断舒服只读，如果是则将它转换为只读数据 不是则继续递归转换为响应式
            }

            return res
        },
        set(target,key,value,receiver){1
            //只读属性则直接给警告，程序不向下执行
            if(isReadyonly){
                console.warn(`属性 ${key} 是只读的`)
                return true
            }

            //判断数据是否为数组，如果是则判断下标是否小于数组长度，小于则是设置，反之添加， 不是数组，就当对象处理，判断key存不存在，不存在则是添加，反之就是设置
            const type = Array.isArray(target) ? Number(key) < target.length  ? 'SET' : 'ADD' : Object.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'
            let oldVal = target[key] //拿到老值

            const res = Reflect.set(target, key, value, receiver)

            if(target === receiver.key){
                //值不相同才进行触发副作用函数
                if(oldVal !== value && (oldVal === oldVal || value === value)){
                    trigger(target,key,type,value)
                }
            }
            
            return res
        },
        deleteProperty(target, key){
            //判断属性是否存在
            const hasKey = Object.hasOwnProperty.call(target, key)

            if(isReadyonly){
                console.warn(`属性 ${key} 是只读的`)
                return true
            }

            const res =  Reflect.deleteProperty(target, key) //删除属性

            if(hasKey && res){//属性存在且删除成功才触发副作用函数
                trigger(target, key, 'DELETE')
            }

            return res
        },
        has(target,key){//对 in 操作符进行监听
            track(target,key)
            return Reflect.has(target,key)
        },
        ownKeys(target){ //for in 操作进行监听
            track(target, ITERATE_KEY)
            return Reflect.ownKeys(target)
        }
    })

    proxys.add(proxy) //添加到set中，方便进行判断数据是否已是响应式数据

    return proxy //返回代理对象
}

//创建深响应式数据
export function reactive(obj){
    return createReactive(obj)
}

//创建浅响应式数据
export function shallowReactive(obj){
    return createReactive(obj, true)
}

//创建只读响应式数据
export function readonly(obj){
    return createReactive(obj, false, true)
}

//创建只读浅响应式数据
export function shallowReadonly(obj){
    return createReactive(obj, true, true)
}