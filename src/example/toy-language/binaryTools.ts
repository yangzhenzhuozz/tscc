import { globalVariable, IR, IRContainer, OPCODE, stackFrameRelocationTable, irAbsoluteAddressRelocationTable, irContainerList, typeRelocationTable, typeTable as irTypeTable } from "./ir.js";
import { TypeUsedSign } from "./lib.js";
import { ProgramScope } from "./scope.js";

class Buffer {
    private buffer: number[] = [];
    public writeInt8(n: number): number {
        let ret = this.buffer.length;
        this.buffer.push(n);
        return ret;
    }
    public writeUInt8(n: number): number {
        let ret = this.buffer.length;
        this.buffer.push(n & 0xff);
        return ret;
    }
    public writeInt64(n: bigint): number {
        let ret = this.buffer.length;
        this.buffer.push(Number((n >> 0n) & 0xffn));
        this.buffer.push(Number((n >> 8n) & 0xffn));
        this.buffer.push(Number((n >> 16n) & 0xffn));
        this.buffer.push(Number((n >> 24n) & 0xffn));
        this.buffer.push(Number((n >> 32n) & 0xffn));
        this.buffer.push(Number((n >> 40n) & 0xffn));
        this.buffer.push(Number((n >> 48n) & 0xffn));
        this.buffer.push(Number((n >> 56n) & 0xffn));
        return ret;
    }
    public writeStringUTF8(str: string): number {
        let ret = this.buffer.length;
        let encoder = new TextEncoder();
        let bytes = encoder.encode(str);
        for (let byte of bytes) {
            this.buffer.push(byte);
        }
        this.buffer.push(0);//写\0
        return ret;
    }
    public setInt64(n: bigint, offset: number) {
        this.buffer[offset + 0] = Number((n >> 0n) & 0xffn);
        this.buffer[offset + 1] = Number((n >> 8n) & 0xffn);
        this.buffer[offset + 2] = Number((n >> 16n) & 0xffn);
        this.buffer[offset + 3] = Number((n >> 24n) & 0xffn);
        this.buffer[offset + 4] = Number((n >> 32n) & 0xffn);
        this.buffer[offset + 5] = Number((n >> 40n) & 0xffn);
        this.buffer[offset + 6] = Number((n >> 48n) & 0xffn);
        this.buffer[offset + 7] = Number((n >> 56n) & 0xffn);
    }
    public toBinary(): ArrayBuffer {
        return Uint8Array.from(this.buffer).buffer;
    }
}
class StringPool {
    private pool: Map<string, number> = new Map();
    public items: string[] = [];
    private index = 0;
    public register(str: string): number {
        if (this.pool.has(str)) {
            return this.pool.get(str)!;
        } else {
            let ret = this.index;
            this.pool.set(str, this.index++);
            this.items.push(str);
            return ret;
        }
    }
    public toBinary() {
        let buffer: Buffer = new Buffer();
        buffer.writeInt64(BigInt(this.pool.size));//写入长度
        for (let i = 0; i < this.pool.size; i++) {
            buffer.writeInt64(0n);//指针暂时置0
        }
        for (let i = 0; i < this.items.length; i++) {
            let stringOffset = buffer.writeStringUTF8(this.items[i]);
            buffer.setInt64(BigInt(stringOffset), (i + 1) * 8);
        }
        return buffer.toBinary();
    }
}
class ClassTable {
    private classNameMap: Map<number, number> | undefined;
    public items: { size: number, name: number, isValueType: boolean, props: { name: number, type: number }[] }[] = [];
    public getClassIndex(className: string): number {
        if (!this.classNameMap) {
            this.classNameMap = new Map();
            for (let i = 0; i < this.items.length; i++) {
                let item = this.items[i];
                this.classNameMap!.set(item.name, i);
            }
        }
        return this.classNameMap!.get(stringPool.register(className))!;
    }
    public toBinary() {
        let buffer = new Buffer();
        buffer.writeInt64(BigInt(this.items.length));//写ClassTable.length
        //预留ClassTable.items
        for (let i = 0; i < this.items.length; i++) {
            buffer.writeInt64(0n);//指针暂时置0
        }
        for (let i = 0; i < this.items.length; i++) {
            let classDesc = this.items[i];
            let classOffset = buffer.writeInt64(BigInt(classDesc.size));//写PropertyDesc的属性
            buffer.setInt64(BigInt(classOffset), (i + 1) * 8);
            buffer.writeInt64(BigInt(classDesc.name));
            buffer.writeInt64(BigInt(classDesc.isValueType));
            buffer.writeInt64(BigInt(classDesc.props.length));
            let propLocs = [] as number[];
            //预留PropertyDesc.items
            for (let j = 0; j < classDesc.props.length; j++) {
                let propLoc = buffer.writeInt64(0n);//指针暂时置0
                propLocs.push(propLoc);
            }
            for (let j = 0; j < classDesc.props.length; j++) {
                let prop = classDesc.props[j];
                let propOffset = buffer.writeInt64(BigInt(prop.name));
                buffer.setInt64(BigInt(propOffset), propLocs[j]);
                buffer.writeInt64(BigInt(prop.type));
            }
        }
        return buffer.toBinary();
    }
}
class StackFrameTable {
    private items: { baseOffset: number, props: { name: number, type: number }[] }[] = [];
    public nameMap: Map<string, number> = new Map();
    public push(item: { baseOffset: number, props: { name: number, type: number }[] }, name: string) {
        this.nameMap.set(name, this.items.length);
        this.items.push(item);
    }
    public getItems() {
        return this.items;
    }
    public toBinary() {
        let buffer = new Buffer();
        buffer.writeInt64(BigInt(this.items.length));//写length
        //预留StackFrameTable.items
        for (let i = 0; i < this.items.length; i++) {
            buffer.writeInt64(0n);//指针暂时置0
        }
        for (let i = 0; i < this.items.length; i++) {
            let item = this.items[i];
            let itemOffset = buffer.writeInt64(BigInt(item.baseOffset));//写StackFrameItem.baseOffset(写item的第一个属性的时候，这个偏移也是item的起始偏移)
            buffer.setInt64(BigInt(itemOffset), (i + 1) * 8);
            buffer.writeInt64(BigInt(item.props.length));//写写StackFrameItem.length
            let propItemLocs = [] as number[];
            //预留StackFrameItem.items
            for (let j = 0; j < item.props.length; j++) {
                let propLoc = buffer.writeInt64(0n);//指针暂时置0
                propItemLocs.push(propLoc);
            }
            for (let j = 0; j < item.props.length; j++) {
                let prop = item.props[j];
                let propOffset = buffer.writeInt64(BigInt(prop.name));
                buffer.setInt64(BigInt(propOffset), propItemLocs[j]);
                buffer.writeInt64(BigInt(prop.type));
            }
        }
        return buffer.toBinary();
    }
}
//和ir.ts中的typeTable不同
class TypeTable {
    /**
     * innerType：对于array是数组元素类型，对于plainObj是classTable的类型，对于function无意义
     */
    public items: { name: number, desc: number, innerType: number }[] = [];
    public toBinary() {
        let buffer = new Buffer();
        for (let item of this.items) {
            buffer.writeInt64(BigInt(item.desc));
            buffer.writeInt64(BigInt(item.innerType));
            buffer.writeInt64(BigInt(item.name));
        }
        return buffer.toBinary();
    }
}
function assertion(obj: any, name: string) {
    if (obj == undefined || obj == null) {
        throw `link失败,找不到符号:${name}`;
    }
}
export function link(programScope: ProgramScope) {
    let main = programScope.getProp('main').prop.type?.FunctionType;
    if (main == undefined || Object.keys(main._arguments).length != 0 || TypeUsedSign(main.retType!) != 'void') {
        throw `必须在program域定义一个函数main,类型为: ()=>void (无参,无返回值),后续再考虑有参数和返回值的情况`;
    }
    let start = new IRContainer('@start', 'begin');//在代码的最前面生成@start
    IRContainer.setContainer(start);
    let new_p = new IR('_new', undefined, undefined, undefined);
    typeRelocationTable.push({ t1: '@program', ir: new_p });    
    new IR('p_store');
    let call = new IR('abs_call', undefined, undefined, undefined);//初始化@program
    irAbsoluteAddressRelocationTable.push({ sym: '@program_init', ir: call });
    new IR('p_load');
    new IR('p_getfield', programScope.getPropOffset('main'));
    new IR('call');
    new IR('__exit');


    let irTable: Map<string, number> = new Map();//用于调试的符号表
    let debugIRS: IR[] = [];//用于调试的ir列条
    let irIndex = 0;
    //重新计算符号表
    for (let ircontainer of irContainerList) {
        if (irTable.has(ircontainer.name)) {
            throw `符号:${ircontainer.name}重复`;
        }
        irTable.set(ircontainer.name, irIndex);
        irIndex += ircontainer.irs.length;
    }
    //push_stack_map重定位
    for (let item of stackFrameRelocationTable) {
        item.ir.operand1 = stackFrameTable.nameMap.get(item.sym);
        assertion(item.ir.operand1, item.sym);
    }
    //修改需要重定位的指令
    for (let item of irAbsoluteAddressRelocationTable) {
        item.ir.operand1 = irTable.get(item.sym);
        assertion(item.ir.operand1, item.sym);
    }
    //类型重定位
    for (let item of typeRelocationTable) {
        if (item.t1) {
            item.ir.operand1 = irTypeTable[item.t1].index;
            assertion(item.ir.operand1, item.t1);
        }
        if (item.t2) {
            item.ir.operand2 = irTypeTable[item.t2].index;
            assertion(item.ir.operand2, item.t2);
        }
        if (item.t3) {
            item.ir.operand3 = irTypeTable[item.t3].index;
            assertion(item.ir.operand3, item.t3);
        }
    }
    //将ir变成二进制
    let irBuffer = new Buffer();
    for (let ircontainer of irContainerList) {
        for (let ir of ircontainer.irs) {
            debugIRS.push(ir);
            irBuffer.writeInt64(BigInt(OPCODE[ir.opCode]));
            irBuffer.writeInt64(BigInt(ir.operand1 ?? 0));
            irBuffer.writeInt64(BigInt(ir.operand2 ?? 0));
            irBuffer.writeInt64(BigInt(ir.operand3 ?? 0));
        }
    }
    //指令参照表
    let irTableBuffer = new Buffer();
    for (let item of irTable) {
        irTableBuffer.writeInt64(BigInt(stringPool.register(item[0])));
        irTableBuffer.writeInt64(BigInt(item[1]));
    }
    return { text: irBuffer.toBinary(), irTableBuffer: irTableBuffer.toBinary(), irTable, debugIRS };
}
export enum typeItemDesc {
    PlaintObj,
    Array,
    Function
};
export const stackFrameTable = new StackFrameTable();
export const typeTable = new TypeTable();
export const classTable = new ClassTable();
export const stringPool = new StringPool();