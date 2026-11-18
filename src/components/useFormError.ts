import { useEffect, useState } from 'react';
export function clearFormErrors(){document.dispatchEvent(new Event('dalex:clear-errors'))}
export function useFormError(initial=''){
 const [error,setError]=useState(initial);
 useEffect(()=>{const clear=()=>setError('');document.addEventListener('input',clear,true);document.addEventListener('change',clear,true);document.addEventListener('dalex:clear-errors',clear);return()=>{document.removeEventListener('input',clear,true);document.removeEventListener('change',clear,true);document.removeEventListener('dalex:clear-errors',clear)}},[]);
 return [error,setError] as const;
}
