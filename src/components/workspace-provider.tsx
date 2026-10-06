import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {type CompanyId,type ThemeMode,companies,resolveMode} from '@/lib/workspace-data';
const Context=createContext<{company:CompanyId;setCompany:(id:CompanyId)=>void;mode:ThemeMode;setMode:(mode:ThemeMode)=>void}>({company:'all',setCompany:()=>{},mode:'light',setMode:()=>{}});
export function WorkspaceProvider({children}:{children:ReactNode}){
 const [company,setCompany]=useState<CompanyId>('all'); const [mode,setMode]=useState<ThemeMode>('light'); const [ready,setReady]=useState(false);
 useEffect(()=>{try{const saved=localStorage.getItem('workspace-appearance');const savedCompany=localStorage.getItem('workspace-company');if(saved==='dark'||saved==='light'||saved==='system')setMode(saved);if(savedCompany==='all'||companies.some(c=>c.id===savedCompany))setCompany(savedCompany as CompanyId);}catch{}setReady(true);},[]);
 useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const apply=()=>{document.documentElement.classList.toggle('dark',resolveMode(mode,media.matches)==='dark');document.documentElement.dataset.company=company;};apply();media.addEventListener('change',apply);if(ready){try{localStorage.setItem('workspace-appearance',mode);localStorage.setItem('workspace-company',company);}catch{}}return()=>media.removeEventListener('change',apply);},[mode,company,ready]);
 return <Context.Provider value={{company,setCompany,mode,setMode}}>{children}</Context.Provider>;
}
export const useWorkspace=()=>useContext(Context);
