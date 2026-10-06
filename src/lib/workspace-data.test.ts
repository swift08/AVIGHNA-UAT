import {describe,it,expect} from 'vitest';
import {companies,filterCompany,orders,resolveMode} from './workspace-data';
describe('Fixed company context',()=>{
 it('has exactly the four specified companies',()=>{expect(companies.map(c=>c.name)).toEqual(['Asian Apex & Co.','Avighna Specialty Ingredients Pvt Ltd','Ganesh Inc','Atharva Associates']);});
 it('All Companies consolidates every company record',()=>{expect(filterCompany(orders,'all')).toHaveLength(5);});
 it('an individual company filters records without changing other companies',()=>{expect(filterCompany(orders,'asian').map(o=>o.id)).toEqual(['ORD-1024','ORD-1022']);expect(orders).toHaveLength(5);});
});
describe('Appearance mode',()=>{
 it('system follows device appearance',()=>{expect(resolveMode('system',true)).toBe('dark');expect(resolveMode('system',false)).toBe('light');});
 it('explicit appearance overrides the device',()=>{expect(resolveMode('light',true)).toBe('light');expect(resolveMode('dark',false)).toBe('dark');});
});
