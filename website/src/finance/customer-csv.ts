/** Conservative RFC4180 customer import. Rejects malformed quotes and unknown columns. */
export function parseCustomerCSV(text:string){
 if(text.length>512000)throw new Error('Use a CSV smaller than 500 KB.');
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}if(c==='"'){if(cell||closed)throw new Error('Unexpected CSV quote.');quoted=true;continue;}if(c===','||c==='\n'||c==='\r'){row.push(cell);cell='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v.trim()))rows.push(row);row=[];}continue;}if(closed&&c.trim())throw new Error('Unexpected characters after a quoted field.');if(!closed)cell+=c;}
 if(quoted)throw new Error('Unclosed CSV quote.');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 const headers=(rows.shift()||[]).map(v=>v.replace(/^\uFEFF/,'').trim().toLowerCase());if(!headers.includes('name')||headers.some(v=>!['name','email','phone','id','status'].includes(v))||new Set(headers).size!==headers.length)throw new Error('CSV headings must include name; email and phone are optional.');
 if(!rows.length||rows.length>500)throw new Error('Import between 1 and 500 customers.');
 return rows.map(r=>{if(r.length!==headers.length)throw new Error('Each CSV row must have the same columns as its header.');const data=Object.fromEntries(headers.map((h,i)=>[h,r[i].trim()]));if(!data.name)throw new Error('Every customer needs a name.');return {name:data.name,email:data.email||'',phone:data.phone||''};});
}
