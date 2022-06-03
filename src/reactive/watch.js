import { effect } from "./effect";

//数据监听
export function watch(source, cb, options = {}){
    let getter
    let oldValue, newValue //用来接收新值和旧址
    let cleanup //用来接收作废函数触发的回调

    //两种对要监视的数据传参方式，接受函数和对像.属性
    if(typeof source === 'function'){
        getter = source
    }else {
        getter = () => traverse(source)
    }

    //作废回调钩子
    function onInvalidate(fn){
        cleanup = fn
    }

    const job = () => {
        newValue = effectfn()
        if(cleanup){
            cleanup() //如果设置了作废函数钩子则执行
        }
        cb && cb(newValue, oldValue, onInvalidate) //执行回调，并将新值和旧值还有作废函数钩子作为参数传入
        oldValue = newValue //执行完将新值赋值给旧值
    }

    const effectfn = effect(() => getter(),{
        lazy:true,
        scheduler: () => {
            //支持异步执行
            if(options.flush === 'post'){
                const p = Promise.resolve()
                p.then(job)
            }else{
                job()
            }
        }
    })

    if(options.immediate){ //已进入自动执行一次监听器
        job()
    }else{
        oldValue = effectfn() //如果不是一开始就执行的监听器，则手动拿到旧值
    }
}

//拿到监听数据
function traverse(value, seen = new Set()){
    if(value == null || typeof value !== 'object' || seen.has(value)){
        return
    }

    seen.add(value)

    for(let key in value){
        traverse(value[key], seen)
    }

    return value
}