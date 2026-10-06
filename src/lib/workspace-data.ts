import asian from '@/assets/asian-apex.jpg.asset.json';
import avighna from '@/assets/avighna.png.asset.json';
import ganesh from '@/assets/ganesh-inc.jpg.asset.json';
import atharva from '@/assets/atharva-associates.png.asset.json';
export const companies = [
 {id:'asian', name:'Asian Apex & Co.', short:'Asian Apex', logo:asian.url, revenue:1820000, growth:18.6},
 {id:'avighna', name:'Avighna Specialty Ingredients Pvt Ltd', short:'Avighna', logo:avighna.url, revenue:1240000, growth:12.4},
 {id:'ganesh', name:'Ganesh Inc', short:'Ganesh Inc', logo:ganesh.url, revenue:810000, growth:8.2},
 {id:'atharva', name:'Atharva Associates', short:'Atharva', logo:atharva.url, revenue:560000, growth:14.8},
] as const;
export type CompanyId = 'all' | typeof companies[number]['id'];
export type ThemeMode = 'light' | 'dark' | 'system';
export function resolveMode(mode:ThemeMode, systemDark:boolean){return mode==='system' ? (systemDark?'dark':'light') : mode;}
export const orders = [
 {id:'ORD-1024', customer:'Polar Bear Ice Creams', initials:'PB', company:'asian', amount:82500, status:'Out for delivery', date:'06 Oct, 2026', items:'Milk powder · 250 kg', owner:'Ravi Kumar'},
 {id:'ORD-1023', customer:'Sweet Treats Bakery', initials:'ST', company:'avighna', amount:45200, status:'Pending approval', date:'06 Oct, 2026', items:'Dark chocolate · 120 kg', owner:'Suresh Rao'},
 {id:'ORD-1022', customer:'Hotel Grand Palace', initials:'GP', company:'asian', amount:118400, status:'Ready to dispatch', date:'05 Oct, 2026', items:'Vanilla essence · 80 L', owner:'Ravi Kumar'},
 {id:'ORD-1021', customer:'Café Delight', initials:'CD', company:'ganesh', amount:32800, status:'Delivered', date:'05 Oct, 2026', items:'Cocoa powder · 100 kg', owner:'Arun Nair'},
 {id:'ORD-1020', customer:'Bakers Hub', initials:'BH', company:'atharva', amount:64750, status:'Procuring', date:'05 Oct, 2026', items:'Butter · 200 kg', owner:'Mahesh Patel'},
];
export type Order = typeof orders[number];
export function filterCompany<T extends {company:string}>(rows:T[], id:CompanyId){return id==='all'?rows:rows.filter(row=>row.company===id);}
export function companyRevenue(id:CompanyId){return companies.filter(c=>id==='all'||c.id===id).reduce((sum,c)=>sum+c.revenue,0);}
export const money=(value:number)=>'₹'+value.toLocaleString('en-IN');
export const initialTasks = [
 {id:1,name:'Collect payment from Polar Bear',company:'asian',due:'Today, 4:00 PM',person:'RK',priority:'High',done:false},
 {id:2,name:'Send samples to Sweet Treats',company:'avighna',due:'Today, 5:30 PM',person:'SR',priority:'Medium',done:false},
 {id:3,name:'Confirm tomorrow’s dispatch',company:'ganesh',due:'Tomorrow',person:'MP',priority:'High',done:false},
 {id:4,name:'Follow up on supplier quotation',company:'atharva',due:'08 Oct',person:'AN',priority:'Low',done:false},
];
export const products=[{name:'Skimmed milk powder',code:'SMP-001',company:'asian',onhand:1250,reserved:400,unit:'kg',category:'Dairy'},{name:'Dark chocolate compound',code:'DCC-002',company:'avighna',onhand:420,reserved:380,unit:'kg',category:'Chocolate'},{name:'Vanilla essence',code:'VE-003',company:'ganesh',onhand:120,reserved:90,unit:'L',category:'Flavours'},{name:'Unsalted butter',code:'UB-004',company:'atharva',onhand:680,reserved:180,unit:'kg',category:'Dairy'}];
