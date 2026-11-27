export function priceComponent({model,quantity,unitMinor,included=0,blockSize=1}){
 if(!['fixed','seat','consumption','block'].includes(model)||![quantity,unitMinor,included,blockSize].every(n=>Number.isSafeInteger(n)&&n>=0)||blockSize===0)throw Error('invalid pricing');
 const excess=BigInt(Math.max(0,quantity-included)),size=BigInt(blockSize);
 const units=model==='fixed'?1n:model==='block'?(excess+size-1n)/size:excess;
 return {pricingUnits:String(units),amountMinor:String(units*BigInt(unitMinor))};
}

export function priceTiered({model,quantity,tiers,platformMinor=0,minimumMinor=0}){
 const valid=n=>Number.isSafeInteger(n)&&n>=0;
 if(!['graduated','volume'].includes(model)||![quantity,platformMinor,minimumMinor].every(valid)||!Array.isArray(tiers)||!tiers.length||tiers.length>100)throw Error('invalid pricing');
 let previous=0,remaining=quantity,variable=0n;
 for(let i=0;i<tiers.length;i++){
 const t=tiers[i];if(!t||!valid(t.unitMinor)||!(t.upTo===null?i===tiers.length-1:valid(t.upTo)&&t.upTo>previous))throw Error('invalid tier');
 const upper=t.upTo===null?Infinity:t.upTo;
 if(model==='graduated'){const count=Math.min(remaining,upper-previous);variable+=BigInt(count)*BigInt(t.unitMinor);remaining-=count;}
 else if(remaining>0&&quantity<=upper){variable=BigInt(quantity)*BigInt(t.unitMinor);remaining=0;}
 previous=upper;
 }
 if(remaining)throw Error('unpriced quantity');
 const subtotal=variable+BigInt(platformMinor),minimum=BigInt(minimumMinor);
 return {amountMinor:String(subtotal>minimum?subtotal:minimum),variableMinor:String(variable),basis:'scenario_estimate'};
}
