import {useEffect,useState} from 'react';
export function navigate(path:string,replace=false){
 if(!path.startsWith('/')||path.startsWith('//'))throw Error('Only local navigation is supported');
 history[replace?'replaceState':'pushState'](null,'',path);
 window.dispatchEvent(new Event('africore:navigate'));
}
export function usePathname(){
 const [path,setPath]=useState(()=>window.location.pathname.replace(/\/$/,'')||'/');
 useEffect(()=>{const changed=()=>setPath(window.location.pathname.replace(/\/$/,'')||'/');window.addEventListener('popstate',changed);window.addEventListener('africore:navigate',changed);return()=>{window.removeEventListener('popstate',changed);window.removeEventListener('africore:navigate',changed);};},[]);
 return path;
}
