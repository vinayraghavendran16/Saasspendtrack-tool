export function priceComponent({model,quantity,unitMinor,included=0,blockSize=1}){
 if(!['fixed','seat','consumption','block'].includes(model)||![quantity,unitMinor,included,blockSize].every(n=>Number.isSafeInteger(n)&&n>=0)||blockSize===0)throw Error('invalid pricing');
 const excess=BigInt(Math.max(0,quantity-included)),size=BigInt(blockSize);
 const units=model==='fixed'?1n:model==='block'?(excess+size-1n)/size:excess;
 return {pricingUnits:String(units),amountMinor:String(units*BigInt(unitMinor))};
}
