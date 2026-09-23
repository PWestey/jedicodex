// Run: NODE_PATH=/path/to/node_modules node tests/practice.cjs
// Requires Playwright; CHROME_PATH can select a local Chrome executable.
const { chromium }=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
(async()=>{
 const root=require('node:path').resolve(__dirname,'..');
 const html=fs.readFileSync(root+'/index.html','utf8');
 const original=execFileSync('git',['show','54df7ef:index.html'],{cwd:root,encoding:'utf8'});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(req.url==='/old'?original:html);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const url=`http://127.0.0.1:${server.address().port}`;
 await page.goto(url+'/old');
 const before=await page.evaluate(()=>{
   const lid=state.cards.find(c=>c.front==='The Law of the Lid');lid.box=6;lid.due='2027-01-01';
   state.cards.find(c=>c.front==='Get them talking').back='My personal version';
   state.cards=state.cards.filter(c=>c.front!=='Processes unlock scale');save();
   return {id:lid.id,created:lid.created};
 });
 await page.goto(url);await page.locator('[data-tab="library"]').click();
 await page.locator('#applyContent').click();
 const migrated=await page.evaluate(()=>({cards:state.cards,updates:state.contentUpdates}));
 assert.equal(migrated.cards.length,323);
 const lid=migrated.cards.find(c=>c.id===before.id);
 assert.equal(lid.box,6);assert.equal(lid.due,'2027-01-01');assert.equal(lid.created,before.created);assert.match(lid.back,/bottleneck/);
 assert.equal(migrated.cards.find(c=>c.front==='Get them talking').back,'My personal version');
 assert(!migrated.cards.some(c=>c.front==='Processes unlock scale'));
 await page.reload();await page.locator('[data-tab="library"]').click();assert.equal(await page.locator('#applyContent').count(),0);
 await page.locator('#lsearch').fill('Who is better');await page.locator('.item').click();await page.locator('#practiceCard').click();
 await page.locator('#pinPractice').click();assert.equal(await page.evaluate(()=>state.practice),null);
 await page.locator('#practiceAction').fill('Give a teammate decision ownership <test>');await page.locator('#practiceWhen').fill('Tuesday at 10');await page.locator('#pinPractice').click();
 const progress=await page.evaluate(()=>JSON.stringify(state.meta));
 await page.reload();assert.match(await page.locator('#practicePanel').innerText(),/Tuesday at 10/);
 await page.locator('#bReveal').click();await page.locator('#bGot').click();assert(await page.evaluate(()=>!!state.practice));
 await page.evaluate(()=>{state.cards.forEach(c=>c.due='2027-01-01');initSession();render();});
 assert.match(await page.locator('#reviewPanel').innerText(),/archive rests/);assert.match(await page.locator('#practicePanel').innerText(),/decision ownership <test>/);
 await page.locator('#practicePanel summary').first().click();await page.locator('#reflect-tried').fill('Let them decide.');await page.locator('#reflect-happened').fill('They explained the tradeoff.');await page.locator('#reflect-adjust').fill('Clarify the boundary earlier.');
 await page.reload();assert.equal(await page.evaluate(()=>state.practice.reflection.adjust),'Clarify the boundary earlier.');
 await page.locator('#practicePanel summary').first().click();await page.locator('#finishPractice').click();assert.equal(await page.evaluate(()=>state.practice),null);assert.equal(await page.evaluate(()=>state.practiceHistory.length),1);
 const backup=await page.evaluate(()=>JSON.stringify(backupData()));
 await page.evaluate(()=>{state.practiceHistory=[];save();});page.once('dialog',d=>d.accept());
 await page.locator('#importFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});
 await page.waitForFunction(()=>state.practiceHistory.length===1);
 assert.equal(await page.evaluate(()=>JSON.stringify(backupData())),backup);
 await page.evaluate(()=>localStorage.clear());await page.reload();assert.equal(await page.evaluate(()=>state.cards.length),324);
 await page.locator('#bReveal').click();await page.getByRole('button',{name:'Practice this week',exact:true}).click();assert.equal(await page.locator('#practiceAction').count(),1);
 await page.locator('#cancelPractice').click();assert.equal(await page.evaluate(()=>JSON.stringify(state.meta)),progress);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:root+'/../practice-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: safe migration, idempotence, pinning, recall independence, reflection persistence, backup round-trip, new installs, mobile layout.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
