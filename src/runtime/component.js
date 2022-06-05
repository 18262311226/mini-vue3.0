import { effect } from "../reactive/effect"
import { reactive, shallowReactive } from "../reactive/reactive"

const queue = new Set()
let isFlushing = false
const p = Promise.resolve()
let currentInstance = null

function setCurrentInstance(instance){
    currentInstance = instance
}

export function onMounted(fn){
    if(currentInstance){
        currentInstance.mounted.push(fn)
    }else {
        console.log('onMounted函数只能在setup中调用')
    }
}

function QueueJob(job){
    queue.add(job)
    if(!isFlushing){
        isFlushing = true
        p.then(() => {
            try{
                queue.forEach(job => job())
            }finally{
                isFlushing = true
                queue.length = 0
            }
        })
    }
}

function resolveProps(options, propsData){
    const props = {}
    const attrs = {}

    for(let key in propsData){
        if(key in options || key.startsWith('on')){
            props[key] = propsData[key]
        }else {
            attrs[key] = propsData[key]
        }
    }

    return [props, attrs]
}

export function mountComponent(vnode, container, anchor){
    const componentOptions = vnode.type
    const {render, data, setup, props: propsOption, beforeCreate, created, beforeMount, mounted, beforeUpdate, updated} = componentOptions

    beforeCreate && beforeCreate()

    const state = data ? reactive(data()) : null
    const [props, attrs] = resolveProps(propsOption, vnode.props)
    const slots = vnode.children || {}
    const instance = {
        state,
        props: shallowReactive(props),
        isMounted: false,
        subTree: null,
        slots,
        mounted: []
    }

    function emit(event, ...payload){
        const eventName = `on${event[0].toUpperCase() + event.slice(1)}`
        const handler = instance.props[eventName]

        if(handler){
            handler(...payload)
        }else {
            console.error('事件不存在')
        }
    }

    const setupContext = { attrs, emit, slots }

    setCurrentInstance(instance)

    const setupResult = setup(shallowReactive(props), setupContext)

    setCurrentInstance(null)
    
    let setupState = null

    if(typeof setupResult === 'function'){
        if(render){
            console.error('setup返回渲染函数，render选项将被忽略')
        }

        render = setupResult
    }else {
        setupState = setupContext
    }

    vnode.component = instance

    const renderContext = new Proxy(instance, {
        get(t, k, r){
            const {state, props, slots} = t
            if(k === '$slots'){
                return slots
            }
            if(state && k in state){
                return state[k]
            }else if(k in props){
                return props[k]
            }else if(setupState && k in setupState){
                return setupState[k]
            }else {
                console.error('不存在')
            }
        },
        set(t, k, v, r){
            const {state, props} = t
            if(state && k in state){
                state[k] = v
            }else if(k in props){
                props[k] = v
            }else if(setupState && k in setupState){
                setupState[k] = v
            }else {
                console.error('不存在')
            }
        }
    })

    created && created.call(renderContext)

    effect(()=>{
        const subTree = render.call(renderContext, renderContext)
        if(!instance.isMounted){
            beforeMount && beforeMount.call(renderContext)

            patch(null, subTree, container, anchor)

            instance.isMounted = true
            mounted && mounted.call(renderContext)
            instance.mounted && instance.mounted.forEach(hook => hook.call(renderContext))
        }else {
            beforeUpdate && beforeUpdate.call(renderContext)

            patch(instance.subTree, subTree, container, anchor)

            updated && updated.call(renderContext)
        }
        instance.subTree = subTree
    },{
        scheduler: QueueJob
    })
}

function hasPropsChange(prevProps, nextProps){
    const nextKey = Object.keys(nextProps)

    if(nextKey.length !== Object.keys(prevProps).length){
        return true
    }

    for(let i = 0;i < nextKey.length;i++){
        const key = nextKey[i]
        if(nextProps[key] !== prevProps[key]){
            return true
        }
    }

    return false
}

export function patchComponent(n1, n2, anchor){
    const instance = (n2.component = n1.component)

    const {props} = instance

    if(hasPropsChange(n1.props, n2.props)){
        const [nextProps] = resolveProps(n2.type.props, n2.props)

        for(let k in nextProps){
            props[k] = nextProps[k]
        }

        for(let k in props){
            if(!(k in nextProps)){
                delete props[k]
            }
        }
    }
}