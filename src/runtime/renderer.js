import {Text, Comment, Fragment} from './vnode';
import { mountComponent, patchComponent } from './component';

export function createRender(){
    function patch(n1, n2, container, anchor){
        if(n1 && n1.type !== n2.type){
            unmount(n1)
            n1 = null
        }

        const {type} = n2
        if(typeof type === 'string'){
            if(!n1){
                mountElement(n2, container, anchor)
            }else{
                patchElement(n1, n2)
            }
        }else if(type === Text){
            if(!n1){
                const el = n2.el = createTextNode(n2.children)
                insert(container, el)
            }else{
                const el = n2.el = n1.el
                if(n2.children !== n1.children){
                    setText(el, n2.children)
                }
            }
        }else if(type === Fragment){
            if(!n1){
                n2.children.forEach(c => patch(null, c, container))
            }else{
                patchChildren(n1, n2, container)
            }
        }else if(typeof type === 'object'){
            if(!n1){
                mountComponent(n2, container, anchor)
            }else {
                patchComponent(n1, n2, anchor)
            }
        }else{

        }
        
    }

    //挂载
    function mountElement(vnode, container,anchor){
        let el = vnode.el = createElement(vnode.type)

        if(typeof vnode.children === 'string'){
            setElementText(el,vnode.children)
        }else {
            vnode.children.forEach(child => {
                patch(null,child,el,anchor)
            })
        }
        
        if(vnode.props){
            for(let key in vnode.props){
                patchProps(el,key, null, vnode.props[key])
            }
        }

        insert(el, container,anchor)
    }

    //对比虚拟dom
    function patchElement(n1, n2){
        const el = n2.el = n1.el
        const oldProps = n1.props || {}
        const newProps = n2.props || {}

        for(let key in newProps){
            if(newProps[key] !== oldProps[key]){
                patchProps(el,key, oldProps[key], newProps[key])
            }
        }

        for(let key in oldProps){
            if(!(key in newProps)){
                patchProps(el,key,oldProps[key], null)
            }
        }

        patchChildren(n1,n2,el)
    }

    function patchChildren(n1,n2,container){
        if(typeof n2.children === 'string'){
            if(Array.isArray(n1.children)){
                n1.children.forEach(c => unmount(c))
            }

            setElementText(container, n2.children)
        }else if(Array.isArray(n2.children)){
            const oldChildren = n1.children
            const newChildren = n2.children

            let lastIndex = 0;

            const oldLen = oldChildren.length
            const newLen = newChildren.length
            const commonLen = Math.min(oldLen,newLen)
            if(oldChildren[0].key && newChildren[0].key){
                patchKeyedChildren(n1, n2, container)
            }else{
                for(let i = 0;i < commonLen;i++){
                    patch(oldChildren[i], newChildren[i])
                }

                if(newLen > oldLen){
                    for(let i = commonLen;i < newLen;i++){
                        patch(null, newChildren[i], container)
                    }
                }else if(newLen < oldLen){
                    for(let i = commonLen;i < oldLen;i++){
                        unmount(oldChildren[i])
                    }
                }
            }
        }else{
            if(Array.isArray(n1.children)){
                n1.children.forEach(c => unmount(c))
            }else if(typeof n1.children === 'string'){
                setElementText(container, '')
            }
        }
    }

    //快速diff算法
    function patchKeyedChildren(n1, n2, container){
        const newChildren = n2.children
        const oldChildren = n1.children

        let j = 0
        let oldVNode = oldChildren[j]
        let newVNode = newChildren[j]

        while(oldVNode.key === newVNode.key){
            patch(oldVNode, newVNode, container)
            j++
            oldVNode = oldChildren[j]
            newVNode = newChildren[j]
        }

        let oldEnd = oldChildren.length - 1
        let newEnd = newChildren.length - 1

        oldVNode = oldChildren[oldEnd]
        newVNode = newChildren[newEnd]

        while(oldVNode.key === newVNode.key){
            patch(oldVNode, newVNode, container)
            oldEnd--
            newEnd--
            oldVNode = oldChildren[oldEnd]
            newVNode = newChildren[newEnd]
        }

        if(j <= newEnd && j > oldEnd){
            const anchorIndex = newEnd + 1
            const anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null

            while(j <= newEnd){
                patch(null, newChildren[j++], container, anchor)
            }
        }else if(j > newEnd && j <= oldEnd){
            while(j <= oldEnd){
                unmount(oldChildren[j++])
            }
        }else{
            const count = newEnd + j + 1
            const source = new Array(count)
            source.fill(-1)

            const oldStart = j
            const newStart = j

            const keyIndex = {}
            let moved = false
            let pos = 0
            for(let i = newStart;i <= newEnd;i++){
                keyIndex[newChildren[i].key] = i
            }

            let patched = 0

            for(let i = oldStart;i <= oldEnd;i++){
                oldVNode = oldChildren[i]
                if(patched <= count){
                    const k = keyIndex[oldVNode.key]
                    if(k !== 'undefined'){
                        newVNode = newChildren[k]
                        patch(oldVNode, newVNode, container)
                        patched++
                        source[k - newStart] = i
                        if(k < pos){
                            moved = true
                        }else {
                            pos = k
                        }
                    }else {
                        unmount(oldVNode)
                    }
                }else{
                    unmount(oldVNode)
                }
            }

            if(moved){
                const seq = getSequence(source)
                let s = seq.length - 1
                let i = count - 1

                for(i;i >= 0;i--){
                    if(source[i] === -1){
                        const pos = i + newStart
                        const newVNode = newChildren[pos]
                        const nextPos = pos + 1
                        const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null
                        patch(null, newVNode, container, anchor)
                    }else if(i !== seq[s]){
                        const pos = i + newStart
                        const newVNode = newChildren[pos]
                        const nextPos = pos + 1
                        const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null
                        insert(newVNode.el, container, anchor)
                    }else{
                        s--
                    }
                }
            }
        }
    }

    //最长上升子序列算法
    function getSequence(arr){
        const p = arr.slice()
        const result = [0]
        let i,j,u,v,c
        const len = arr.length

        for(i = 0;i < len;i++){
            const arrI = arr[i]

            if(arrI !== 0){
                j = result[result.length - 1]
                if(arr[j] < arrI){
                    p[i] = j
                    result.push(i)
                    continue
                }

                u = 0
                v = result.length - 1

                while(u < v){
                    c = ((u + v) / 2) | 0
                    if(arr[result[c]] < arrI){
                        u = c + 1
                    }else {
                        v = c
                    }
                }

                if(arrI < arr[result[u]]){
                    if(u > 0){
                        p[i] = result[u - 1]
                    }
                    result[u] = i
                }
            }
        }

        u = result.length
        v = result[u - 1]

        while(u-- > 0){
            result[u] = v
            v = p[v]
        }

        return result
    }

    //卸载
    function unmount(vnode){
        if(vnode.type === Fragment){
            vnode.children.forEach(c => unmount(c))
            return
        }

        const parent = vnode.el.parentNode
        if (parent) parent.removeChild(vnode.el)
    }

    //更新属性
    function patchProps(el, key, prevValue, nextValue){
        if(/^on/.test(key)){
            let invokers = el._vei || (el._vei = {})
            let invoker = invokers[key]
            const name = key.slice(2).toLowerCase()
            if(nextValue){
                if(!invoker){
                    invoker = el._vei[key] = (e) => {
                        if(e.timeStamp < invoker.attached) return
                        if(Array.isArray(invoker.value)){
                            invoker.value.forEach(fn => fn(e))
                        }else {
                            invoker.value(e)
                        }
                    }
                    invoker.value = nextValue
                    invoker.attached = Performance.now()
                    el.addEventListener(name, invoker)
                }else{
                    invoker.value = nextValue
                }
            }else if(invoker){
                el.removeEventListener(name, invoker)
            }
        }else if(key === 'style'){
            //todo
        }else if(key === 'class'){
            el.className = nextValue || ''
        }else if(shouldSetAsProps(el,key,nextValue)){
            let type = typeof el[key]
            if(type === 'boolean' && value === ''){
                el[key] = true
            }else {
                el[key] = nextValue
            }
        }else {
           el.setAttribute(key, nextValue) 
        }
    }

    function render(vnode, container){
        if(vnode){
            patch(container._vnode, vnode, container)
        }else{
            if(container._vnode){
                unmount(container._vnode)
            }
        }

        container._vnode = vnode
    }

    return {
        render
    }
}

function shouldSetAsProps(el, key, value){
    if(key === 'form' && el.tagName === 'INPUT'){
        return false
    }
    
    return key in el
}

function createElement(tag){
    return document.createElement(tag)
}

function setElementText(el, text){
    el.textContent = text
}

function insert(el, parent, anchor = null){
    parent.insertBefore(el, anchor)
}

function createTextNode(text){
    return document.createTextNode(text)
}

function setText(el,text){
    el.nodeValue = text
}