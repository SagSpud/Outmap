const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false, offscreen: true } });
  try {
    await win.loadURL('about:blank');
    await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'../src/favorite-interactions.js'),'utf8'));
    const result = await win.webContents.executeJavaScript(`(async()=>{
      document.body.innerHTML='<div id="tabs" style="position:relative;display:flex;width:600px"></div>';
      const tabs=document.getElementById('tabs');
      for(const id of ['all','a','b','c']) { const b=document.createElement('button'); b.dataset.tabId=id;b.textContent=id;b.style.width='100px';tabs.appendChild(b); }
      let commits=[];OutmapFavoriteInteractions.bindSort(tabs, ids=>commits.push(ids));
      const a=tabs.children[1], r=a.getBoundingClientRect();
      a.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,pointerType:'mouse',button:0,clientX:r.left+10,clientY:r.top+5}));
      // Synthetic pointer events cannot acquire browser pointer capture.
      tabs.setPointerCapture=()=>{}; tabs.hasPointerCapture=()=>false;
      window.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,pointerType:'mouse',clientX:390,clientY:r.top+5}));
      await new Promise(r=>setTimeout(r,80));
      const preview=!!document.querySelector('.folder-drag-preview');
      window.dispatchEvent(new PointerEvent('pointerup',{pointerId:1}));
      const order=[...tabs.children].map(b=>b.dataset.tabId);
      const b=tabs.children[1], br=b.getBoundingClientRect();
      b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:2,pointerType:'mouse',button:0,clientX:br.left+10,clientY:br.top+5}));
      window.dispatchEvent(new PointerEvent('pointermove',{pointerId:2,pointerType:'mouse',clientX:390,clientY:br.top+5}));
      await new Promise(r=>setTimeout(r,30));window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
      const restored=[...tabs.children].map(b=>b.dataset.tabId);
      const icons=['view','camp','water','supply','parking','hotel','photo','hiking'].map(t=>{const i=OutmapFavoriteInteractions.icon(t); return i.width===64&&i.data.some(v=>v>0);});
      return {preview,order,restored,commits,icons,ghosts:document.querySelectorAll('.folder-drag-preview').length};
    })()`);
    assert.deepStrictEqual(result.order,['all','b','c','a']);
    assert.deepStrictEqual(result.restored,result.order);
    assert.equal(result.commits.length,1);assert(result.preview);assert.equal(result.ghosts,0);assert(result.icons.every(Boolean));
    console.log(result);
    app.exit(0);
  } catch(e) { console.error(e); app.exit(1); }
});
