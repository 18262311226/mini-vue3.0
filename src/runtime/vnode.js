export const Text = Symbol() //文本节点
export const Comment = Symbol() //注释节点
export const Fragment = Symbol()

export function vnode(){

}

let classString = []

export function normalizeClass(data){
    let str = ''
    let arr = []
    if(!Array.isArray(data)){
        arr.push(data)
    }else {
        arr = data
    }
    for(let i = 0;i < arr.length;i++){
        let value = arr[i]
        if(typeof value === 'string'){
            if(i < arr.length - 1){
                str += value + ' '
            }else {
                str += value 
            }
        }else {
            for(let key in value){
                if(value[key]){
                    str += key + ' '
                }
            }
        }
    }
    return str
}