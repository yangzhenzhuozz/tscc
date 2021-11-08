class State {
    private static GLOBAL_INDEX = 0;//用于给State编号，在计算闭包的时候用到
    public isFinal: boolean = false;//是否为结束状态
    public gotoTable: Map<string, State[]> = new Map();//跳转表
    public index: number;
    constructor() {
        this.index = State.GLOBAL_INDEX++;
    }
    public addEdge(edge: string, dest: State) {
        let table = this.gotoTable.get(edge);
        if (table == undefined) {
            table = [];
            this.gotoTable.set(edge, table);
        }
        table.push(dest);
    }
}
//状态机
class Automaton {
    public start: State;
    public end: State;
    constructor(s: State, e: State) {
        this.start = s;
        this.end = e;
    }
}
export { State, Automaton }