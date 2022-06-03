export function mountComponent(vnode, container, anchor){
    const componentOptions = vnode.type
    const {render} = componentOptions
    const subTree = render()
    patch(null, subTree, container, anchor)
}

export function patchComponent(n1, n2, anchor){

}