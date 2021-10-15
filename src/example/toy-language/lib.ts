class Address {
    public location: string;
    public value: string;
    constructor(location: string, value: string) {
        this.location = location;
        this.value = value;
    }
    public toString() {
        if (this.location == 'temporary') {
            return `$${this.value}`;
        }
        else {
            return `${this.value}`;
        }
    }
}
class Quadruple {
    public op: string;
    public arg1: Address;
    public arg2: Address | null;
    public result: Address;
    constructor(op: string, arg1: Address, arg2: Address | null, result: Address) {
        this.op = op;
        this.arg1 = arg1;
        this.arg2 = arg2;
        this.result = result;
    }
    public toString() {
        switch (this.op) {
            case '+': return `${this.result} = ${this.arg1} ${this.op} ${this.arg2}`;
            case '=': return `${this.result} = ${this.arg1}`;
            default: return '';
        }
    }
}
class Scope {
    private symTable: Set<string> = new Set();
    public addSym(id: string) {
        if (this.symTable.has(id)) {
            throw `重复定义:${id}`;
        } else {
            this.symTable.add(id);
        }
    }
    public getSym(id: string) {
        if (this.symTable.has(id)) {
            return id;
        } else {
            throw `未定义的符号:${id}`;
        }
    }
}
class TmpScope {
    private address = 0;
    public addSym():number {
        return this.address++;
    }
}
export { Scope, Quadruple, TmpScope, Address }
