import Parser from "./parser.js";
interface Token {
    type: string;
    value: any;
}
interface YYTOKEN extends Token {
    yytext: string;
}
//解析正则表达式的分析器
class LexForREG {
    private source: string = '';
    private char_index = 0;
    private keyWord = new Set<string>(['(', ')', '|', '*']);
    public setSource(src: string) {
        this.char_index = 0;
        this.source = src;
    }
    public lex(): YYTOKEN {
        if (this.char_index >= this.source.length) {
            return {
                type: "$",
                value: "",
                yytext: ""
            };
        }
        let ch = this.source.charAt(this.char_index++);
        if (this.keyWord.has(ch)) {
            return {
                type: ch,
                value: ch,
                yytext: ch
            };
        }
        else if (ch == '\\') {//遇到反斜杠，需要对后面字符进行转义
            if (this.char_index >= this.source.length - 1) {
                throw `反斜杠'\\'后面没有任何字符`;
            }
            ch = this.source.charAt(this.char_index++);//取后面一个字符
            return {
                type: "normal_ch",
                value: ch,
                yytext: ch
            };
        } else {
            return {
                type: "normal_ch",
                value: ch,
                yytext: ch
            };
        }
    }
}
class State {
    private static GLOBAL_INDEX = 0;//用于给State编号，在计算闭包的时候用到
    public isFinal;//是否为结束状态
    public gotoTable: Map<string, State[]> = new Map();//跳转表
    public index: number;
    constructor(final: boolean = false) {
        this.index = State.GLOBAL_INDEX++;
        this.isFinal = final;
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
class Lexer {
    private parser = new Parser();
    private lexer = new LexForREG();
    private rules: Map<string, Automaton> = new Map();
    private StartState: State | undefined;
    public addRule(reg: string) {//添加规则
        this.lexer.setSource("a|b");
        let automaton: Automaton = this.parser.parse(this.lexer);
        automaton.end.isFinal = true;
        this.rules.set(reg, automaton);
    }
    public compile() {
        this.StartState = new State();//创建一个开始状态，然后将该状态连接到所有规则生成的自动机
        for (let rule of this.rules) {
            this.StartState.addEdge("", rule[1].start);
        }
        this.generateDFA(this.StartState);//构造DFA
    }
    private epsilon_closure(set: State[]) {
        //因为不知道js的容器怎么实现comparable,所以这些容器都使用cache判断重复
        let cache: Set<number> = new Set();//状态集合，保证各个State不重复
        let closure: State[] = [];//闭包集合
        let isFinal = false;//是否结束状态
        let gotoTableCache: Map<string, { cache: Set<number>, states: State[] }> = new Map();//本闭包能接受的字符以及能到达的状态
        for (let s of set) {
            if (!cache.has(s.index)) {
                cache.add(s.index);
                closure.push(s);
            }
        }
        for (let i = 0; i < closure.length; i++) {
            if (closure[i].isFinal) {
                isFinal = true;
            }
            for (let edge of closure[i].gotoTable.keys()) {
                let targets = closure[i].gotoTable.get(edge)!;
                if (edge == "") {//接受epsilon
                    for (let s of targets) {
                        if (!cache.has(s.index)) {
                            cache.add(s.index);
                            closure.push(s);
                        }
                    }
                } else {//接受非空字符，记录本闭包接受该字符的可达状态集合
                    let targetsOfNonEpsilon = gotoTableCache.get(edge);
                    if (targetsOfNonEpsilon == undefined) {
                        targetsOfNonEpsilon = { cache: new Set(), states: [] };
                        gotoTableCache.set(edge, targetsOfNonEpsilon);
                    }
                    for (let s of targets) {
                        if (!targetsOfNonEpsilon!.cache.has(s.index)) {
                            targetsOfNonEpsilon!.cache.add(s.index);
                            targetsOfNonEpsilon!.states.push(s);
                        }
                    }
                }
            }
        }
        let sign = [...cache];//签名，在生成DFA时用到
        sign.sort((a, b) => {
            return a - b;
        });
        return { states: closure, isFinal: isFinal, sign: sign.toString(), gotoTable: gotoTableCache };
    }
    private generateDFA(start: State) {
        let startItems = this.epsilon_closure([start]);
        let cache = new Map<string, number>();
        let StateFamily: {
            states: State[];
            isFinal: boolean;
            sign: string;
            gotoTable: Map<string, {
                cache: Set<number>;
                states: State[];
            }>;
        }[] = [];
        let NFAStates: State[] = [];//NFA集合，保持和StateFamily同步
        cache.set(startItems.sign, 0);
        StateFamily.push(startItems);
        NFAStates.push(new State(startItems.isFinal));

        for (let i = 0; i < StateFamily.length; i++) {//处理每个闭包
            let s = StateFamily[i];
            for (let edge of s.gotoTable.keys()) {//遍历每个可接受字符
                let targetClosure = this.epsilon_closure(s.gotoTable.get(edge)!.states);//对每个可达集合计算闭包
                let targetIncache = cache.get(targetClosure.sign);
                if (targetIncache == undefined) {//如果缓存中没有该闭包
                    let NFATarget = new State(targetClosure.isFinal);//登记集合
                    NFAStates[i].addEdge(edge, NFATarget);
                    StateFamily.push(targetClosure);
                    NFAStates.push(NFATarget);
                } else {
                    NFAStates[i].addEdge(edge, NFAStates[targetIncache]);
                }
            }
        }
        return NFAStates[0];
    }
}
export { State, Automaton }
export default Lexer