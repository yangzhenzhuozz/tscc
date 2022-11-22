import { IR, _Symbol } from './ir.js'
import { TypeUsedSign } from './lib.js';
//全局变量
export const globalVariable = {
    pointSize: 8,//指针大小
    stackFrameMapIndex: 0,//栈帧序号
}
export let symbols: _Symbol[] = [];//符号表
export let addRelocationTable: { sym: string, ir: IR }[] = [];//重定位表
export let typeRelocationTable: { sym: string, ir: IR }[] = [];//type重定向表
export let stackFrameRelocationTable: { sym: string, ir: IR }[] = [];//stackFrame重定向表
export let stackFrameMap: { [key: string]: { baseOffset: number, frame: { name: string, type: TypeUsed }[] } } = {};//栈布局记录
export let typeTable: { [key: string]: { index: number, type: TypeUsed } } = {};//类型表
let typeIndex = 0;
//注册类型
export function registerType(type: TypeUsed): number {
    let sign = TypeUsedSign(type);
    if (typeTable[sign] != undefined) {
        return typeTable[sign].index;
    } else {
        typeTable[sign] = { index: typeIndex, type: type };
        return typeIndex++;
    }
}