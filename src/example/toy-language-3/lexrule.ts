import Lexer from "../lexer/lexer.js";
import { SemanticException, ProgramScope, program } from "./lib.js"
let userTypeDictionary = new Set<string>();
//词法规则
let lexer = new Lexer();
lexer.addRule(['( |\t|\r|\n)( |\t|\r|\n)*', undefined]);//忽略空格、制表、回车、换行
lexer.addRule(['//( |\t|a|b|c|d|e|f|g|h|i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z|A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|W|X|Y|Z|1|2|3|4|5|6|7|8|9|0)*\r\n', undefined]);//忽略注释
lexer.addRule(['(1|2|3|4|5|6|7|8|9|0)(1|2|3|4|5|6|7|8|9|0)*', (arg) => { arg.value = { value: Number(arg.yytext), type: program.getType('int') }; return "immediate_val"; }]);
lexer.addRule(['(a|b|c|d|e|f|g|h|i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z|A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|W|X|Y|Z)(a|b|c|d|e|f|g|h|i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z|A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|W|X|Y|Z|1|2|3|4|5|6|7|8|9|0)*',
    (arg) => {
        if (userTypeDictionary.has(arg.yytext)) {
            arg.value = program.getType(arg.yytext);
            return "basic_type";
        } else {
            arg.value = arg.yytext; return 'id';
        }
    }]);
lexer.addRule(['var', () => 'var']);
lexer.addRule(['val', () => 'val']);
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
lexer.addRule(['get', () => 'get']);
lexer.addRule(['set', () => 'set']);
lexer.addRule(['try', () => 'try']);
lexer.addRule(['catch', () => 'catch']);
lexer.addRule(['throw', () => 'throw']);
lexer.addRule(['super', () => 'super']);
lexer.addRule(['int', (arg) => { arg.value = program.getType('int'); return "basic_type"; }]);
lexer.addRule(['bool', (arg) => { arg.value = program.getType('bool'); return "basic_type"; }]);
export { userTypeDictionary };
export default lexer;
