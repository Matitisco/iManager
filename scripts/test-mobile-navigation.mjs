// Automated real-shell fixture with synthetic context; no backend or app deployment.
// Run: node scripts/test-mobile-navigation.mjs
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium, expect } from '@playwright/test';

const root = process.cwd();
const base = '2e5f50bd415643b0e3c3cd1759b5c9b5f5512853';
const files = ['DeskApp.tsx', 'hash-route.ts', 'nav.ts', 'mobile-tab-bar.tsx', 'group-tabs.tsx', 'ui.tsx', 'desk.css', 'pager.tsx', 'bulk-actions.tsx', ...['Inventory', 'Sales', 'Clients'].map(n => `screens/${n}Screen.tsx`)];
const originals = new Map(files.map(file => [`src/desk/${file}`, execFileSync('git', ['show', `${base}:src/desk/${file}`], { encoding: 'utf8' })]));
const temp = await mkdtemp(path.join(root, '.navigation-review-'));
const shots = path.join(root, 'docs/issue-450');
await mkdir(shots, { recursive: true });
let server;
let browser;
try {
  await writeFile(path.join(temp, 'context.tsx'), `
    import { useState } from 'react';
    const date = new Date().toISOString();
    const scenario = new URLSearchParams(location.search).get('scenario');
    const items = Array.from({length: 24}, (_, i) => ({id: String(i+1), model: 'Equipo sintético ' + (i+1), imei: String(i+1).padEnd(15,'0'), capacity:'128 GB', color:'Negro', condition:'NUEVO', grade:'', batteryHealth:'100%', cost:100, price:200, status:'DISPONIBLE', createdAt:date}));
    const clients = items.map((p,i) => ({id:p.id, name:'Cliente sintético '+(i+1), dni:String(30000000+i), phone:'1100000000', email:'', totalSpent:200, pendingBalance:20, lastPurchaseDate:date}));
    const context = {
      user: null, backendStatus:'ready', sessionConfirmed:true,
      appSession:{user:{id:'fixture',displayName:'Usuario de prueba',email:'fixture@example.invalid'},store:{id:'fixture',name:'Tienda sintética',currency:'ARS',exchangeMode:'manual',manualBuy:1000,manualSell:1000},membership:{role:'OWNER',sections:null},onboardingRequired:false},
      inventory:scenario === 'empty' || scenario === 'loading' ? [] : items,
      clients:scenario === 'empty' || scenario === 'loading' ? [] : clients,
      sales:scenario === 'empty' || scenario === 'loading' ? [] : items.map(p=>({id:p.id, clientId:p.id, productId:p.id, amount:200, amountCurrency:'ARS', date,status:'COMPLETADA',paymentMethod:'EFECTIVO'})),
      tradeIns:[], repairOrders:[], returns:[], expenses:[], operationDrafts:[],
      listsLoaded:scenario !== 'loading',
      operationNotifications: ['inventory','sales','clients'].map((section,i)=>({id:String(i),storeId:'fixture',section,title:'Aviso sintético',message:'Registro de prueba',createdAt:date,recordId:String(i+1),kind:'INTEGRATED_OPERATION',readAt:null})),
      loadPublicCatalog: async()=>null, publicCatalog:null, markNotificationRead:async()=>{},
      commissionSellers:[], commissionSummaries:{},commissionDetails:{},
      loadOperationDrafts: async () => { if (scenario === 'error') throw new Error('No se pudieron cargar los borradores.'); return []; },
    };
    export function useAppContext() { const [,rerender]=useState(0); window.refreshFixture=()=>rerender(v=>v+1); return context; }
  `);
  await writeFile(path.join(temp, 'fixture.tsx'), `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {DeskApp} from '/src/desk/DeskApp';
    createRoot(document.getElementById('root')).render(<React.StrictMode><DeskApp installEnabled={false}/></React.StrictMode>);
  `);
  browser = await chromium.launch();
  for (const before of [true, false]) {
    server = await createServer({ root, configFile:false, optimizeDeps:{entries:[path.join(temp,'fixture.tsx')]}, plugins:[{
      name:'navigation-review', enforce:'pre',
      resolveId(id) { if (id.endsWith('/context/AppContext')) return path.join(temp,'context.tsx'); },
      load(id) { const rel = path.relative(root,id).split('?')[0]; if (before && originals.has(rel)) return originals.get(rel); },
      configureServer(vite) { vite.middlewares.use(async(req,res,next)=>{
        if (!req.url?.startsWith('/fixture?')) return next();
        res.setHeader('Content-Type','text/html');
        res.end(await vite.transformIndexHtml('/fixture', '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}button,input{font:inherit}</style></head><body><div id="root"></div><script type="module" src="/'+path.relative(root,temp)+'/fixture.tsx"></script></body></html>'));
      }); }
    },react()],server:{host:'127.0.0.1',port:0} });
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    for (const viewport of [{width:320,height:844},{width:390,height:844},{width:1440,height:900}]) {
      const page = await browser.newPage({viewport});
      page.setDefaultTimeout(15000);
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.route('https://**',route=>route.abort());
      let visit=0;
      const open = (hash, scenario='')=>page.goto(`${origin}/fixture?scenario=${scenario}&visit=${++visit}#/${hash}`);
      const stage=page.locator('.stage');
      const shot = name=>page.screenshot({path:path.join(shots,`${before?'before':'after'}-${name}-${viewport.width}.png`),animations:'disabled'});
      await open(viewport.width<760?'mas':'analisis/reportes');
      await expect(page.locator('.desk-app')).toBeVisible();
      if (viewport.width<760) {
        await page.getByTestId('sidebar-tab-reports').scrollIntoViewIfNeeded();
        let oldTop=await stage.evaluate(el=>el.scrollTop);
        expect(oldTop).toBeGreaterThan(200);
        await page.evaluate(()=>window.addEventListener('click',()=>{window.departureTop=document.querySelector('.stage').scrollTop;},{once:true,capture:true}));
        await page.getByTestId('sidebar-tab-reports').click();
        oldTop=await page.evaluate(()=>window.departureTop);
        await expect(page.getByRole('heading',{level:1,name:'Reportes'})).toBeAttached();
        const top=await stage.evaluate(el=>el.scrollTop);
        if (before) expect(top).toBeGreaterThan(100);
        else expect(top).toBe(0);
        await shot('reports');
        if (!before) {
          await page.getByTestId('page-back').click();
          await expect(page).toHaveURL(/#\/mas$/);
          await expect.poll(()=>stage.evaluate(el=>el.scrollTop)).toBeCloseTo(oldTop,0);
          await page.goForward();
          await expect(page).toHaveURL(/#\/analisis\/reportes$/);
          await expect.poll(()=>stage.evaluate(el=>el.scrollTop)).toBe(0);
        }
      } else await shot('reports');
      for (const [route,title] of [['stock/equipos','Inventario'],['comercial/ventas','Ventas'],['atencion/clientes','Clientes']]) {
        await open(route);
        await expect(page.getByRole('heading',{name:title,level:1})).toBeVisible();
        await shot(title.toLowerCase());
        if (before) continue;
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        if (viewport.width<760) {
          const options=page.locator('.mobile-list-options');
          await expect(options).not.toHaveAttribute('open','');
          await options.locator('summary').click();
          for (const select of await options.locator('.dsel').all()) {
            await select.locator(':scope > button').click();
            await select.locator('.menu').evaluate(async node=>{await Promise.all(node.getAnimations().map(animation=>animation.finished));});
            for (const item of await select.locator('.menu button').all()) {
              const box=await item.boundingBox();
              expect(box.x).toBeGreaterThanOrEqual(0);
              expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);
              expect(box.height).toBeGreaterThanOrEqual(44);
            }
            await select.locator('.menu button').first().click();
          }
          expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
          await options.getByRole('button',{name:'Seleccionar',exact:true}).click();
          const bulk=page.getByTestId('bulk-action-bar');
          await expect(bulk).toContainText('0 seleccionados');
          await expect(page.getByTestId('mobile-dock')).toHaveCount(0);
          await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();
          await stage.evaluate(el=>el.scrollTop=el.scrollHeight);
          const pager=page.getByRole('navigation',{name:'Paginación'});
          const box=await pager.boundingBox();
          const bulkBox=await bulk.boundingBox();
          const navBox=await page.getByTestId('mobile-tab-bar').boundingBox();
          expect(box.y+box.height).toBeLessThanOrEqual(bulkBox.y+1);
          expect(bulkBox.y+bulkBox.height).toBeLessThanOrEqual(navBox.y);
          await shot(title.toLowerCase()+'-pagination');
          await page.locator('.bulk-row > .bulk-check input').first().check();
          await expect(bulk).toContainText('1 seleccionado');
          await shot(title.toLowerCase()+'-selection');
          await bulk.getByRole('button',{name:'Listo'}).click();
          await expect(page.getByTestId('mobile-dock')).toBeVisible();
        }
      }
      if (!before) {
        await open('atencion/clientes');
        const search=page.getByPlaceholder('Buscar por nombre, DNI o teléfono');
        await search.fill('sintético');
        await page.getByRole('button',{name:'Página 2',exact:true}).click();
        await stage.evaluate(el=>el.scrollTop=el.scrollHeight);
        // Modal opens over the list; closing preserves query, page and scroll.
        await page.getByTestId(/^client-row-/).first().click();
        const dialog=page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(search).toHaveValue('sintético');
        await page.evaluate(()=>window.refreshFixture());
        const currentTop=await stage.evaluate(el=>el.scrollTop);
        await page.evaluate(()=>location.hash='#/analisis/reportes');
        await expect(page.getByRole('heading',{name:'Reportes',level:1})).toBeVisible();
        await page.goBack();
        await expect(search).toHaveValue('sintético');
        await expect(page.getByRole('button',{name:'Página 2',exact:true})).toHaveAttribute('aria-current','page');
        await expect.poll(()=>stage.evaluate(el=>el.scrollTop)).toBeCloseTo(currentTop,0);
        // Fresh navigation does not inherit a previous history entry's filters.
        await page.evaluate(()=>location.hash='#/analisis/reportes');
        await expect(page.getByRole('heading',{name:'Reportes',level:1})).toBeVisible();
        await page.evaluate(()=>location.hash='#/atencion/clientes');
        await expect(search).toHaveValue('');
        for (const scenario of ['empty','loading','error']) {
          await open('stock/equipos',scenario);
          await expect(page.getByRole('heading',{name:'Inventario',level:1})).toBeVisible();
          if (scenario==='empty') await expect(page.getByTestId('inventory-empty')).toBeVisible();
          if (scenario==='error') await expect(page.getByText('No se pudieron cargar los borradores.',{exact:true})).toBeVisible();
          if (scenario==='loading') await expect(page.getByRole('status',{name:'Cargando'})).toBeVisible();
          await shot(scenario);
        }
      }
      expect(errors).toEqual([]);
      console.log(`${before?'baseline':'updated'} ${viewport.width}: navigation/list checks passed`);
      await page.close();
    }
    await server.close();server=undefined;
  }
} finally { await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true}); }
