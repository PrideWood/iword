export const CARD_FONT={min:24,max:44,step:2,default:32};
export function cardFontSize(value:unknown){
 const number=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):NaN;
 if(!Number.isFinite(number))return CARD_FONT.default;
 return Math.max(CARD_FONT.min,Math.min(CARD_FONT.max,Math.round(number/CARD_FONT.step)*CARD_FONT.step));
}
export function cardTypography(value:unknown){const word=cardFontSize(value);return {word,example:word-4,meaning:word-4,phonetic:Math.round(word*.625)}};
