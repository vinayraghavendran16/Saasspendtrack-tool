export function rollup(lines){
 const groups=new Map();
 for(const l of lines){
  if(!['monthly','annual'].includes(l.billing_period))continue;
  if(typeof l.quantity_decimal!=='string'||typeof l.currency!=='string'||! /^[A-Z]{3}$/.test(l.currency)||!/^\d{1,9}(\.\d{1,6})?$/.test(l.quantity_decimal)||!Number.isSafeInteger(l.unit_price_minor)||l.unit_price_minor<0)throw Error('invalid line');
  const [whole,fraction='']=l.quantity_decimal.split('.');
  const scaled=BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'));
  const annual=scaled*BigInt(l.unit_price_minor)*(l.billing_period==='monthly'?12n:1n);
  for(const [dimension,id] of [['total','all'],['supplier',l.supplier_id],['reseller',l.reseller_id??null],['publisher',l.publisher_id],['product',l.product_id],['sku',l.sku_id]]){
   const key=JSON.stringify([dimension,id,l.currency]);groups.set(key,(groups.get(key)||0n)+annual);
  }
 }
 return [...groups].map(([key,value])=>{const [dimension,id,currency]=JSON.parse(key);return {dimension,id,currency,annualMinorScaled:value.toString(),scale:1000000};});
}
