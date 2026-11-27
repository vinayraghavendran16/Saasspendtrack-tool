export function csvCell(value){
 if(value==null)return '""';
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('invalid_number');return String(value);}
 if(typeof value!=='string')throw Error('invalid_cell');
 const safe=/^[\s\u0000-\u001f\uFEFF]*[=+@-]|^[\t\r\n]/u.test(value)?"'"+value:value;
 return '"'+safe.replaceAll('"','""')+'"';
}
export function reportCsv(headers,rows){
 if(!Array.isArray(headers)||!Array.isArray(rows)||rows.some(r=>!Array.isArray(r)||r.length!==headers.length))throw Error('invalid_rows');
 return [headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
