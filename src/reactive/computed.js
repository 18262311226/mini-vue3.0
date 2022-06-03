import { effect, track, trigger } from "./effect";

//计算属性
export function computed(getter){
    let value //用来缓存计算结果
    let dirty = true //用来判断是否需要重新计算

    //拿到副作用函数
    let effectfn = effect(getter, {
        lazy: true,
        scheduler(){
            dirty = true //执行副作用函数时设置为true
            trigger(obj,'value') //触发副作用函数
        }
    })

    const obj = {
        get value(){
            if(dirty){
                //需要重新计算，则手动执行副作用函数
                value = effectfn()
                dirty = false //将标识设置为false
            }
            track(obj,'value')//收集计算属性副作用函数
            return value
        }
    }

    return obj
}