export function formatMinor(n,currency,denominator='1'){
 if(!/^-?[0-9]+$/.test(n)||!/^[A-Z]{3}$/.test(currency)||!/^[0-9]+$/.test(denominator)||BigInt(denominator)<=0n)throw Error('invalid monetary value');
 const digits=new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits;
 const a=BigInt(n),b=BigInt(denominator),abs=a<0n?-a:a,rounded=(abs*2n+b)/(2n*b),scale=10n**BigInt(digits);
 const whole=(rounded/scale).toLocaleString('en-US'),fraction=digits?'.'+String(rounded%scale).padStart(digits,'0'):'';
 return currency+' '+(a<0n&&rounded!==0n?'-':'')+whole+fraction;
}
