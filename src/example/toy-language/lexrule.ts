import Lexer from '../lexer/lexer.js'
import { Scope, Address, SemanticException, Type, GlobalScope, FunctionScope, ClassScope, StmtScope, StmtDescriptor, ObjectDescriptor } from './lib.js'
let oldT = new Date().getTime();
//词法规则
let lexer = new Lexer();
lexer.addRule(['( |\t|\r|\n)( |\t|\r|\n)*', undefined]);//忽略空格、制表、回车、换行
lexer.addRule(['//( |\t|a|b|c|d|e|f|g|h|i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z|A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|W|X|Y|Z|1|2|3|4|5|6|7|8|9|0)*\r\n', undefined]);//忽略注释
lexer.addRule(['(1|2|3|4|5|6|7|8|9|0)(1|2|3|4|5|6|7|8|9|0)*', (arg) => { arg.value = new Address("constant_val",Number(arg.yytext),Type.ConstructBase("int")) ; return "constant_val"; }]);
lexer.addRule(['(a|b|c|d|e|f|g|h|i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z|A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|W|X|Y|Z)(a|b|c|d|e|f|g|h|i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z|A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|W|X|Y|Z|1|2|3|4|5|6|7|8|9|0)*', (arg) => { arg.value = arg.yytext; return 'id'; }]);
lexer.addRule(['var', () => 'var']);
lexer.addRule(['=>', () => '=>']);
lexer.addRule(['...', () => '...']);
lexer.addRule([',', () => ',']);
lexer.addRule([';', () => ';']);
lexer.addRule([':', () => ':']);
lexer.addRule(['++', () => '++']);
lexer.addRule(['--', () => '--']);
lexer.addRule(['+', () => '+']);
lexer.addRule(['-', () => '-']);
lexer.addRule(['\\*', () => '*']);
lexer.addRule(['/', () => '/']);
lexer.addRule(['=', () => '=']);
lexer.addRule(['\\(', () => '(']);
lexer.addRule(['\\)', () => ')']);
lexer.addRule(['?', () => '?']);
lexer.addRule(['[', () => '[']);
lexer.addRule([']', () => ']']);
lexer.addRule(['{', () => '{']);
lexer.addRule(['}', () => '}']);
lexer.addRule(['==', () => '==']);
lexer.addRule(['!=', () => '!=']);
lexer.addRule(['>=', () => '>=']);
lexer.addRule(['<=', () => '<=']);
lexer.addRule(['>', () => '>']);
lexer.addRule(['<', () => '<']);
lexer.addRule(['&&', () => '&&']);
lexer.addRule(['\\|\\|', () => '||']);
lexer.addRule(['!', () => '!']);
lexer.addRule(['.', () => '.']);
lexer.addRule(['function', () => 'function']);
lexer.addRule(['operator', () => 'operator']);
lexer.addRule(['(int)|(double)|(void)', (arg) => { arg.value = Type.ConstructBase(arg.yytext); return 'basic_type'; }]);
lexer.addRule(['class', () => 'class']);
lexer.addRule(['new', () => 'new']);
lexer.addRule(['extends', () => 'extends']);
lexer.addRule(['do', () => 'do']);
lexer.addRule(['while', () => 'while']);
lexer.addRule(['if', () => 'if']);
lexer.addRule(['else', () => 'else']);
lexer.addRule(['for', () => 'for']);
lexer.addRule(['switch', () => 'switch']);
lexer.addRule(['case', () => 'case']);
lexer.addRule(['break', () => 'break']);
lexer.addRule(['continue', () => 'continue']);
lexer.addRule(['as', () => 'as']);
lexer.addRule(['import', () => 'import']);
lexer.addRule(['default', () => 'default']);
lexer.addRule(['valuetype', () => 'valuetype']);
lexer.addRule(['this', () => 'this']);
lexer.addRule(['return', () => 'return']);
lexer.compile();
let newT = new Date().getTime();
console.log(`编译默认词法规则耗时:${newT - oldT}ms`);
export default lexer