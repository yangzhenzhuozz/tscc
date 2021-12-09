class VLQTools {
    public static encodeVLQ(num: number) {
        let binary_str = Math.abs(num).toString(2);//得到数字的二进制字符串
        let binary_len = binary_str.length;
        let result = [] as string[];
        if (binary_len <= 4) {
            result[0] = '0';
            for (let i = 0; i < 4 - binary_len; i++) {
                result[0] += '0';//补0
            }
            result[0] += binary_str;
        } else {
            let VLQLen: number;
            let mod = (binary_len - 4) % 5;
            if (mod == 0) {
                VLQLen = (binary_len - 4) / 5 + 1;//+1是第一个位置的4位字符
            } else {
                VLQLen = (binary_len - 4 - mod) / 5 + 2;//+2是第一个位置的4位字符和mod
            }
            let complement = '';
            for (let i = 0; i < 5 - mod; i++) {
                complement += '0';
            }
            binary_str = complement + binary_str;//补0
            for (let groupIndex = 0; groupIndex < VLQLen; groupIndex++) {
                let group = '';
                if (groupIndex == 0) {//最后一组不需要向后延续
                    group += '0';
                } else {
                    group += '1';
                }
                for (let charInGroupIndex = 0; charInGroupIndex < 5 && groupIndex * 5 + charInGroupIndex < binary_str.length; charInGroupIndex++) {
                    group += binary_str.charAt(groupIndex * 5 + charInGroupIndex);
                }
                result.unshift(group);
            }
        }
        if (num < 0) {//符号位
            result[0] += '1';
        } else {
            result[0] += '0';
        }
        return result;
    }
    public static decodeVLQ(group: string[]) {
        let result = [] as number[];
        let num: number;
        let strbuff = '';
        for (let str of group) {
            if (str.length != 6) {
                throw new Error('无效的分组');
            }
            strbuff = str.slice(1) + strbuff;//提取分组的五个字符到buff的前面
            if (str.charAt(0) == '0') {//当前数字已经结束
                num = Number.parseInt(strbuff.slice(0, -1), 2);//最后一个字符作为符号位
                if (strbuff.slice(-1) == '1') {//判断符号位
                    num = -num;
                }
                result.push(num);
                strbuff = '';
            }
        }
        return result;
    }
    public static VLQTOBase64(group: string[]) {
        let result = '';
        for (let str of group) {
            if (str.length != 6) {
                throw new Error('无效的分组');
            }
            let num = Number.parseInt(str, 2);
            if (num < 26) {//大写字母
                result += String.fromCharCode(num + 65);
            } else if (num >= 26 && num < 52) {//小写字母
                result += String.fromCharCode(num - 26 + 97);
            } else if (num >= 52 && num < 62) {//数字
                result += String.fromCharCode(num - 62 + 48);
            } else if (num == 62) {
                result += '+';
            } else if (num == 63) {
                result += '//';
            } else {
                throw new Error('非法码值');
            }
        }
        return result;
    }
    public static base64ToVLQ(base64: string) {
        let result = [] as string[];
        for (let ch of base64) {
            let num: number;
            if (ch.charCodeAt(0) >= 65 && ch.charCodeAt(0) < 91) {//大写字母
                num = ch.charCodeAt(0) - 65;
            } else if (ch.charCodeAt(0) >= 97 && ch.charCodeAt(0) < 123) {//小写字母
                num = ch.charCodeAt(0) - 97 + 26;
            } else if (ch.charCodeAt(0) >= 48 && ch.charCodeAt(0) < 58) {//数字
                num = ch.charCodeAt(0) - 48 + 52;
            } else if (ch == '+') {
                num = 62;
            }
            else if (ch == '//') {
                num = 63;
            } else {
                throw new Error('非base64范围内的字符');
            }
            let binary_str = num.toString(2);
            let complementLen = 6 - binary_str.length;
            let complement = '';
            for (let i = 0; i < complementLen; i++) {
                complement += '0';
            }
            result.push(complement + binary_str);
        }
        return result;
    }
}