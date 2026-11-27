// Resolver must enforce current artifact permissions before returning canonical text.
export async function verifyDocumentEvidence(accountId,reference,resolveAuthorized){
 if(typeof accountId!=='string'||!accountId||!reference||typeof reference.artifactId!=='string'||!reference.artifactId||reference.artifactId.length>256||! /^[a-f0-9]{64}$/.test(reference.artifactDigest??''))return {status:'invalid_reference'};
 const l=reference.locator;
 if(!l||!Number.isSafeInteger(l.page)||l.page<1||!Number.isSafeInteger(l.start)||!Number.isSafeInteger(l.end)||l.start<0||l.end<=l.start||l.end-l.start>4000||typeof l.quote!=='string'||!l.quote.trim()||l.quote.length!==l.end-l.start)return {status:'invalid_locator'};
 const artifact=await resolveAuthorized(accountId,reference.artifactId,reference.artifactDigest);
 if(!artifact||artifact.accountId!==accountId||artifact.id!==reference.artifactId)return {status:'unavailable'};
 if(artifact.digest!==reference.artifactDigest)return {status:'version_mismatch'};
 if(!Array.isArray(artifact.pages)||typeof artifact.pages[l.page-1]!=='string')return {status:'invalid_locator'};
 // Digest is over the canonical extracted page array, not the original PDF bytes.
 const bytes=new TextEncoder().encode(JSON.stringify(artifact.pages));
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 if(digest!==reference.artifactDigest)return {status:'version_mismatch'};
 const page=artifact.pages[l.page-1];
 if(l.end>page.length||page.slice(l.start,l.end)!==l.quote)return {status:'quote_mismatch'};
 return {status:'verified_text_span',artifactId:artifact.id,page:l.page,start:l.start,end:l.end};
}
