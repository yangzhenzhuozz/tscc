class scope {
    private symTable: Map<string, number> = new Map();
    private localAddress: number = 0;//符号地址
    public addSym(id: string) {
        if (this.symTable.has(id)) {
            throw `重复定义:${id}`;
        } else {
            this.symTable.set(id, this.localAddress++);
        }
    }
}
export {scope}