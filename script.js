(function(){
  const $=id=>document.getElementById(id);
  const KEY='cloverPlanner.v1';
  let S={tasks:[],log:{},table:'',collapsed:false,garden:[]};
  let lastPlanted=null,plantKey='';
  try{const r=localStorage.getItem(KEY);if(r)S=Object.assign(S,JSON.parse(r));}catch(e){}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S));return true}catch(e){return false}};
  const iso=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
  const todayStr=()=>iso(new Date());
  const daysTo=s=>Math.round((new Date(s+'T00:00:00')-new Date(todayStr()+'T00:00:00'))/864e5);
  const fmtDate=s=>new Date(s+'T00:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'});
  const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function toast(m){const t=$('toast');t.textContent=m;t.classList.add('on');setTimeout(()=>t.classList.remove('on'),1800)}

  /* nav */
  function go(p){
    document.querySelectorAll('.page').forEach(s=>s.classList.toggle('hide',s.id!==p));
    document.querySelectorAll('#nav button').forEach(b=>b.dataset.page===p?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
    if(p==='home')renderHome(); if(p==='tasks')renderTasks(); if(p==='timer')renderLog(); if(p==='garden')renderGarden();
    try{history.replaceState(null,'','#'+p)}catch(e){}
  }
  $('nav').onclick=e=>{const b=e.target.closest('button');if(b)go(b.dataset.page)};
  const app=$('app');
  function setCollapsed(c){S.collapsed=c;app.classList.toggle('collapsed',c);save()}
  $('toggle').onclick=()=>setCollapsed(!app.classList.contains('collapsed'));
  setCollapsed(window.innerWidth<700?true:!!S.collapsed);

  /* tasks */
  function taskLi(t,showDel){
    const d=daysTo(t.due),over=!t.done&&d<0,soon=!t.done&&d>=0&&d<=3;
    const lbl=t.done?'เสร็จแล้ว':d<0?'เลยมา '+(-d)+' วัน':d===0?'ส่งวันนี้!':d===1?'พรุ่งนี้':'อีก '+d+' วัน';
    return `<li class="task ${t.done?'done':''} ${over?'over':''}">
      <button class="chk" data-id="${t.id}" aria-label="ทำเสร็จแล้ว">${t.done?'✓':''}</button>
      <div class="info"><div class="t">${esc(t.title)}</div>
      <div class="meta">${t.subj?`<span class="tag">${esc(t.subj)}</span>`:''}ส่ง ${fmtDate(t.due)}</div></div>
      <span class="due ${over?'over':soon?'soon':''}">${lbl}</span>
      ${showDel?`<button class="del" data-del="${t.id}" aria-label="ลบงาน">🗑️</button>`:''}</li>`;
  }
  const sorted=a=>a.slice().sort((x,y)=>x.due.localeCompare(y.due));
  let filter='pending';
  function renderTasks(){
    let a=sorted(S.tasks);
    if(filter==='pending')a=a.filter(t=>!t.done); if(filter==='done')a=a.filter(t=>t.done);
    $('taskList').innerHTML=a.length?a.map(t=>taskLi(t,true)).join(''):'<li class="empty">ยังไม่มีงานในหมวดนี้ 🌿 เพิ่มงานแรกได้เลย</li>';
  }
  function renderHome(){
    const p=S.tasks.filter(t=>!t.done);
    $('sPending').textContent=p.length;
    $('sOver').textContent=p.filter(t=>daysTo(t.due)<0).length;
    $('sSoon').textContent=p.filter(t=>{const d=daysTo(t.due);return d>=0&&d<=3}).length;
    $('sStudy').textContent=Math.round((S.log[todayStr()]||{}).sec/60||0);
    $('today').textContent=new Date().toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    const a=sorted(p).slice(0,6);
    $('homeList').innerHTML=a.length?a.map(t=>taskLi(t,false)).join(''):'<li class="empty">ไม่มีงานค้างเลย เยี่ยมมาก! 🎉</li>';
  }
  function refresh(){renderTasks();renderHome()}
  document.addEventListener('click',e=>{
    const c=e.target.closest('.chk');
    if(c){const t=S.tasks.find(x=>x.id==c.dataset.id);if(t){t.done=!t.done;save();refresh();}}
    const d=e.target.closest('[data-del]');
    if(d){S.tasks=S.tasks.filter(x=>x.id!=d.dataset.del);save();refresh();toast('ลบงานแล้ว')}
  });
  $('taskForm').onsubmit=e=>{e.preventDefault();
    S.tasks.push({id:Date.now(),title:$('fTitle').value.trim(),subj:$('fSubj').value.trim(),due:$('fDue').value,done:false});
    save();e.target.reset();refresh();toast('เพิ่มงานแล้ว')};
  $('chips').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;filter=b.dataset.f;
    document.querySelectorAll('#chips .chip').forEach(x=>x.setAttribute('aria-pressed',x===b));renderTasks()};

  /* timer */
  let mins=25,isFocus=true,left=25*60,running=false,last=0,iv=null;
  const mm=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
  function drawTimer(){
    $('time').textContent=mm(Math.max(0,Math.ceil(left)));
    $('ring').style.setProperty('--p',100-(left/(mins*60))*100);
    const pr=1-left/(mins*60);
    const pk=!isFocus?'cup':left<=0?treeFor(mins):pr<.25?'seed':pr<.5?'sprout':pr<.75?'sapling':'young';
    if(pk!==plantKey){plantKey=pk;$('plant').innerHTML=px(pk)}
    $('modeLb').textContent=isFocus?'ช่วงอ่านหนังสือ 📖':'ช่วงพักผ่อน ☕';
  }
  function setMode(m,focus){stop();mins=m;isFocus=focus;left=m*60;drawTimer()}
  function stop(){running=false;clearInterval(iv)}
  function addLog(sec){
    const k=todayStr();const L=S.log[k]||(S.log[k]={sec:0,subj:{}});
    L.sec+=sec;const s=$('tSubj').value.trim()||'ทั่วไป';L.subj[s]=(L.subj[s]||0)+sec;save();renderLog();
  }
  function tick(){
    const now=Date.now(),dt=(now-last)/1000;last=now;left-=dt;
    if(isFocus)addLogThrottle(dt);
    if(left<=0){stop();left=0;flush();if(isFocus)plantTree();drawTimer();toast(isFocus?'ต้นไม้โตแล้ว! ไปดูในสวนได้เลย 🌳':'หมดเวลาพัก กลับไปอ่านต่อ 🍀');
      try{new (window.AudioContext||window.webkitAudioContext)().resume()}catch(e){}return}
    drawTimer();
  }
  let acc=0;function addLogThrottle(dt){acc+=dt;if(acc>=5){addLog(acc);acc=0}}
  function flush(){if(acc>0){addLog(acc);acc=0}}
  $('start').onclick=()=>{if(running||left<=0)return;running=true;last=Date.now();iv=setInterval(tick,500)};
  $('pause').onclick=()=>{stop();flush()};
  $('reset').onclick=()=>{stop();flush();left=mins*60;drawTimer()};
  $('modes').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;flush();
    document.querySelectorAll('#modes .chip').forEach(x=>x.setAttribute('aria-pressed',x===b));
    const m=+b.dataset.m;setMode(m,b.textContent.includes('อ่าน'))};
  $('custom').onchange=e=>{const v=Math.min(180,Math.max(1,+e.target.value||0));if(v){flush();document.querySelectorAll('#modes .chip').forEach(x=>x.setAttribute('aria-pressed',false));setMode(v,true)}};
  function renderLog(){
    const L=S.log[todayStr()]||{sec:0,subj:{}};
    $('studyToday').textContent=Math.round(L.sec/60);
    const e=Object.entries(L.subj);
    $('logList').innerHTML=e.length?e.map(([k,v])=>`<li class="task"><div class="info"><div class="t">${esc(k)}</div></div><span class="due">${Math.round(v/60)} นาที</span></li>`).join(''):'<li class="empty">เริ่มจับเวลาแล้วเวลาจะมาโชว์ตรงนี้ ✨</li>';
    $('sStudy').textContent=Math.round(L.sec/60);
  }

  /* pixel sprites */
  const PAL={"k": "#a47148", "d": "#6b4429", "g": "#a8c46a", "G": "#6f8f35", "l": "#d3e8a0", "p": "#f4a9bb", "P": "#d9708d", "w": "#fde3ea", "s": "#c99a6e", "S": "#8f6643", "y": "#f7d96b"};
  const SPR={"seed": ["................", "................", "................", "................", "................", "................", "................", "................", "................", "................", "................", ".......kk.......", "......SSSS......", "....SSssssssSS..", "..SSssssssssssSS", "..SSSSSSSSSSSSSS"], "sprout": ["................", "................", "................", "................", "................", "................", "................", "................", "......gg.gg.....", ".......ggg......", "........d.......", "........d.......", "......SSSS......", "....SSssssssSS..", "..SSssssssssssSS", "..SSSSSSSSSSSSSS"], "sapling": ["................", "................", "................", "................", "................", "......ll.ll.....", ".....lgggGgg....", "......gGggg.....", ".......gGg......", "........d.......", "........d.......", "........d.......", "......SSSS......", "....SSssssssSS..", "..SSssssssssssSS", "..SSSSSSSSSSSSSS"], "young": ["................", "................", "................", ".....gggggg.....", "....gllgggGg....", "...gllgggggGg...", "...gggggggGGg...", "....gggggGGg....", ".....GGggGG.....", ".......kd.......", ".......kd.......", ".......kd.......", "......SSSS......", "....SSssssssSS..", "..SSssssssssssSS", "..SSSSSSSSSSSSSS"], "round": ["....gggggggg....", "..gggllllgggggg.", ".gglllllggggggGg", ".gglllgggggggGGg", "gggllggggggggGGG", "gggggggggggggGGG", ".gggggggggggGGG.", ".GgggggggggGGGG.", "..GGgggggGGGGG..", "....GGGGGGGG....", ".......kd.......", ".......kd.......", "......SSSS......", "....SSssssssSS..", "..SSssssssssssSS", "..SSSSSSSSSSSSSS"], "blossom": ["....pppppppp....", "..pppwwwwpppppp.", ".ppwwwwwppppppPp", ".ppwwwpppppppPPp", "pppwwppppppppPPP", "pppppppppppppPPP", ".pppppppppppPPP.", ".PpppppppppPPPP.", "..PPpppppPPPPP..", "....PPPPPPPP....", ".......kd.......", ".......kd.......", "......SSSS......", "....SSssssssSS..", "..SSssssssssssSS", "..SSSSSSSSSSSSSS"], "pine": [".......gg.......", "......gggg......", "......gllg......", ".....ggllgg.....", "....gggggggG....", "....ggggggggGG..", "...gggggggggGGG.", "....gggggggGGG..", "..ggggggggggGGGG", "...GGGGGGGGGGG..", ".......kd.......", ".......kd.......", "......SSSS......", "....SSssssssSS..", "..SSssssssssssSS", "..SSSSSSSSSSSSSS"], "cup": ["................", "................", "................", "................", "................", "................", "....dddddddd....", "....dppppppd....", "....dppppppdddd.", "....dppppppd..d.", "....dppppppdddd.", ".....dppppppd...", "......dddddd....", "................", "................", "................"]};
  const pxCache={};
  function px(n){
    if(pxCache[n])return pxCache[n];
    let r='';
    SPR[n].forEach((row,y)=>{let x=0;while(x<16){const c=row[x];if(c==='.'){x++;continue}let e=x;while(e<16&&row[e]===c)e++;r+=`<rect x="${x}" y="${y}" width="${e-x}" height="1" fill="${PAL[c]}"/>`;x=e}});
    return pxCache[n]=`<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
  }
  /* garden */
  function treeFor(m){return m<15?'young':m<30?'round':m<45?'blossom':'pine'}
  function plantTree(){
    const g={id:Date.now(),kind:treeFor(mins),mins:mins,subj:$('tSubj').value.trim()||'ทั่วไป',date:todayStr()};
    S.garden.push(g);lastPlanted=g.id;save();
  }
  function renderGarden(){
    const a=S.garden.slice().reverse();
    $('gTotal').textContent=a.length;
    $('gToday').textContent=a.filter(g=>g.date===todayStr()).length;
    $('gMin').textContent=a.reduce((n,g)=>n+g.mins,0);
    $('lawn').innerHTML=a.length?a.map(g=>`<div class="plot ${g.id===lastPlanted?'new':''}"><div class="tr">${px(g.kind||treeFor(g.mins))}</div><div class="nm">${esc(g.subj)}</div><div class="mt">${g.mins} นาที · ${fmtDate(g.date)}</div></div>`).join(''):'<div class="empty">สวนยังว่างอยู่ 🌱 ไปจับเวลาอ่านหนังสือให้ครบรอบเพื่อปลูกต้นแรกกันเถอะ</div>';
    lastPlanted=null;
  }

  /* timetable */
  function drawTable(){
    const has=!!S.table;
    $('ttImg').classList.toggle('hide',!has);$('ttBtns').classList.toggle('hide',!has);
    if(has)$('ttImg').src=S.table;
    $('dropLb').textContent=has?'แตะเพื่อเปลี่ยนรูปตารางเรียน':'แตะเพื่อเลือกรูปตารางเรียน';
  }
  $('ttFile').onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=()=>{const im=new Image();im.onload=()=>{
      const sc=Math.min(1,1400/im.width),c=document.createElement('canvas');
      c.width=im.width*sc;c.height=im.height*sc;c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      S.table=c.toDataURL('image/jpeg',.82);
      if(!save())toast('บันทึกไม่ได้ ลองรูปที่เล็กลงนะ');else toast('อัปโหลดตารางเรียนแล้ว');
      drawTable()};im.src=r.result};
    r.readAsDataURL(f);e.target.value='';
  };
  $('ttDel').onclick=()=>{S.table='';save();drawTable();toast('ลบรูปแล้ว')};

  drawTimer();drawTable();
  const h=(location.hash||'').slice(1);
  go(['home','tasks','timer','garden','table'].includes(h)?h:'home');
})();