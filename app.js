import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

/* ---------- Układ biura (z planu: tylko zielone biurka, sala 82 bez miejsc) ---------- */
var NS='http://www.w3.org/2000/svg';
var PITCH=164.25, TOP=125, TW=209, TH=PITCH-10;
var COLX={L:[595,814], M:[1115,1334]};
/* s: [numer miejsca, x, rząd (0 = górny, 1 = dolny)] */
var ROOMS=[
  {id:'87',b:'L',c:0,r:0,s:[[1,764,0],[3,638,1],[2,764,1]]},
  {id:'86',b:'L',c:1,r:0,s:[[3,855,0],[4,938,0],[2,855,1],[1,981,1]]},
  {id:'88',b:'L',c:0,r:1,s:[[1,638,0],[2,764,0],[4,680,1],[3,764,1]]},
  {id:'85',b:'L',c:1,r:1,s:[[3,855,0],[4,981,0],[2,855,1],[1,938,1]]},
  {id:'79',b:'M',c:0,r:0,s:[[1,1199,0],[2,1283,0],[4,1157,1],[3,1283,1]]},
  {id:'78',b:'M',c:1,r:0,s:[[3,1375,0],[4,1458,0],[2,1375,1],[1,1501,1]]},
  {id:'80',b:'M',c:0,r:1,s:[[1,1157,0],[2,1283,0],[4,1199,1],[3,1283,1]]},
  {id:'81',b:'M',c:0,r:2,s:[[1,1199,0],[2,1283,0],[4,1157,1],[3,1283,1]]}
];
var EMPTY=[['L',0,2],['L',1,2],['L',0,3],['L',1,3],['M',1,1],['M',1,2],['M',1,3]];
var CONF={b:'M',c:0,r:3};

function $(id){return document.getElementById(id);}
function el(tag,attrs,parent){
  var n=document.createElementNS(NS,tag);
  for(var k in attrs){n.setAttribute(k,attrs[k]);}
  if(parent){parent.appendChild(n);}
  return n;
}
function text(cls,x,y,str,parent){var t=el('text',{'class':cls,x:x,y:y},parent);t.textContent=str;return t;}
function tileX(b,c){return COLX[b][c];}
function tileY(r){return TOP+PITCH*r+5;}

var svg=$('plan');
var defs=el('defs',{},svg);
var pat=el('pattern',{id:'hatch',width:10,height:10,patternUnits:'userSpaceOnUse',patternTransform:'rotate(45)'},defs);
el('line',{x1:0,y1:0,x2:0,y2:10,'class':'hatch-line'},pat);
var avClip=el('clipPath',{id:'avClip'},defs);
el('circle',{r:19.5},avClip);
var gZones=el('g',{},svg), gRooms=el('g',{},svg), gSeats=el('g',{},svg);

/* strefy orientacyjne */
el('rect',{'class':'zone',x:335,y:131,width:240,height:815,rx:18},gZones);
text('zone-label',455,520,'STREFA',gZones);
text('zone-label',455,546,'WSPÓLNA',gZones);
el('rect',{'class':'zone',x:595,y:806,width:428,height:140,rx:18},gZones);
text('zone-label',809,876,'KUCHNIA',gZones);
el('line',{'class':'door',x1:1040,y1:946,x2:1136,y2:946},gZones);
text('zone-label small',1088,974,'WEJŚCIE',gZones);

/* puste kafelki dla zachowania układu */
EMPTY.forEach(function(e){
  el('rect',{'class':'room-empty',x:tileX(e[0],e[1]),y:tileY(e[2]),width:TW,height:TH,rx:16},gRooms);
});
/* sala konferencyjna 82: bez miejsc */
(function(){
  var x=tileX(CONF.b,CONF.c), y=tileY(CONF.r);
  el('rect',{'class':'conf',x:x,y:y,width:TW,height:TH,rx:16},gRooms);
  text('conf-num',x+TW/2,y+TH/2-14,'82',gRooms);
  text('conf-text',x+TW/2,y+TH/2+20,'Sala konferencyjna',gRooms);
})();

var SEATS=[], SEATMAP={}, els={};
ROOMS.forEach(function(rm){
  var x=tileX(rm.b,rm.c), y=tileY(rm.r);
  el('rect',{'class':'room',x:x,y:y,width:TW,height:TH,rx:16},gRooms);
  text('room-num',x+TW/2,y+TH/2,rm.id,gRooms);
  rm.s.forEach(function(s){
    var sx=s[1], sy=TOP+PITCH*rm.r+(s[2]?124:40);
    var seat={id:rm.id+'-'+s[0],room:rm.id,n:s[0],x:sx,y:sy};
    SEATS.push(seat); SEATMAP[seat.id]=seat;
  });
});
SEATS.forEach(function(s){
  var g=el('g',{'class':'seat free',tabindex:0,role:'button',transform:'translate('+s.x+' '+s.y+')'},gSeats);
  el('circle',{'class':'hit',r:30},g);
  el('circle',{'class':'halo',r:24},g);
  var body=el('g',{'class':'body'},g);
  var dot=el('circle',{'class':'dot',r:21},body);
  var pic=el('image',{'class':'pic',x:-21,y:-21,width:42,height:42,preserveAspectRatio:'xMidYMid slice','clip-path':'url(#avClip)'},body);
  var face=el('text',{'class':'face',x:0,y:1},body);
  els[s.id]={g:g,dot:dot,pic:pic,face:face};
  g.addEventListener('pointerenter',function(e){
    if(e.pointerType==='touch'){return;}
    hoverId=s.id; showTip(s.id);
  });
  g.addEventListener('pointerleave',function(){
    if(hoverId===s.id){hoverId=null; hideTip();}
  });
  g.addEventListener('focus',function(){
    if(g.matches(':focus-visible')){showTip(s.id);}
  });
  g.addEventListener('blur',hideTip);
  g.addEventListener('click',function(){onSeatClick(s.id);});
  g.addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key===' '){e.preventDefault(); onSeatClick(s.id);}
  });
});

/* ---------- Stan ----------
   profiles/<uid> = {name, avatar?, seat?, seatAt?, updatedAt}  - każdy zapisuje tylko własny dokument.
   Zajęte miejsca wynikają z profili (occ: miejsce -> uid). */
var fbAuth=null, fbDb=null, unsub=null;
var uid=null, accountName='', authCode='';
/* status: init | setup | autherr | denied | loading | ready */
var status='init';
var profiles={}, occ={};
var query='', focusId=null, focusT=null, hoverId=null, cardId=null;
var dlgOpen=false, pendingSeat=null, prompted=false, conflictBusy=false;

function norm(s){return String(s||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pl');}
function cleanName(s){return String(s||'').trim().replace(/\s+/g,' ').slice(0,60);}
function colorIdx(name){
  var h=5381, s=norm(name);
  for(var i=0;i<s.length;i++){h=((h<<5)+h+s.charCodeAt(i))|0;}
  return Math.abs(h)%9;
}
function seatLabel(id){var s=SEATMAP[id];return 'Pokój '+s.room+' · miejsce '+s.n;}
function canAct(){return status==='ready' && !!uid;}

/* ---------- Obrazki: ikonki albo własne zdjęcie (JPEG zapisany w profilu) ---------- */
var EMOJI=['🦊','🐼','🐨','🦁','🐯','🐸','🐙','🦄','🐧','🦉','🐢','🐝','🦋','🐳','🌵','🌻','🍋','🍉','🥑','🚀','⚡','🎧','☕'];
var TINT=!!(window.CSS && CSS.supports && CSS.supports('color','color-mix(in srgb, red 30%, white)'));
/* dane z bazy traktujemy jak niezaufane: przepuszczamy tylko znane ikonki i czysty JPEG w base64 */
function validAv(a){
  if(!a || typeof a!=='object' || typeof a.v!=='string'){return null;}
  if(a.t==='e' && EMOJI.indexOf(a.v)!==-1){return {t:'e',v:a.v};}
  if(a.t==='i' && a.v.length<90000 && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(a.v)){return {t:'i',v:a.v};}
  return null;
}
function avKey(a){return a ? a.t+':'+a.v : '';}
function tintFill(name){
  var c='var(--c'+colorIdx(name)+')';
  return TINT ? 'color-mix(in srgb, '+c+' 30%, var(--card))' : c;
}
function paintAv(node,name,av){
  node.textContent=''; node.style.backgroundImage='none';
  if(av && av.t==='i'){node.style.backgroundImage='url("'+av.v+'")'; node.style.backgroundColor='var(--field)';}
  else if(av && av.t==='e'){node.style.backgroundColor=tintFill(name); node.textContent=av.v;}
  else{node.style.backgroundColor='var(--c'+colorIdx(name)+')';}
}

/* ---------- Wyprowadzenie zajętych miejsc ---------- */
function derive(){
  occ={};
  Object.keys(profiles).forEach(function(id){
    var p=profiles[id];
    if(!p.seat){return;}
    var cur=occ[p.seat];
    if(!cur){occ[p.seat]=id; return;}
    var a=p.seatAt||0, b=profiles[cur].seatAt||0;
    if(a<b || (a===b && id<cur)){occ[p.seat]=id;}
  });
}
function mySeat(){var p=profiles[uid]; return p && p.seat && occ[p.seat]===uid ? p.seat : null;}

/* ---------- Rysowanie ---------- */
var GATE={
  autherr:{title:'Nie udało się połączyć',text:'',btn:'Spróbuj ponownie'},
  denied:{title:'Brak dostępu do bazy',text:'Sprawdź, czy reguły Firestore są opublikowane (plik firestore.rules).',btn:''},
  setup:{title:'Dokończ konfigurację',text:'Wklej dane projektu Firebase do pliku firebase-config.js. Kroki są w pliku README.md.',btn:''}
};

function render(){
  var q=norm(query), taken=0, mine=mySeat();
  SEATS.forEach(function(s){
    var pid=occ[s.id], p=pid?profiles[pid]:null, e=els[s.id], isTaken=!!p;
    var av=isTaken ? p.avatar : null;
    if(isTaken){taken++; e.dot.style.fill=(av && av.t==='e') ? tintFill(p.name) : 'var(--c'+colorIdx(p.name)+')';}
    else{e.dot.style.removeProperty('fill');}
    e.g.classList.toggle('has-e',!!av && av.t==='e');
    e.g.classList.toggle('has-i',!!av && av.t==='i');
    var emo=(av && av.t==='e') ? av.v : '';
    if(e.face.textContent!==emo){e.face.textContent=emo;}
    if(av && av.t==='i' && e.pic.getAttribute('href')!==av.v){e.pic.setAttribute('href',av.v);}
    var match=isTaken && q!=='' && norm(p.name).indexOf(q)!==-1;
    e.g.classList.toggle('taken',isTaken);
    e.g.classList.toggle('free',!isTaken);
    e.g.classList.toggle('mine',mine===s.id);
    e.g.classList.toggle('hl',match||focusId===s.id);
    e.g.classList.toggle('dim',q!=='' && !match);
    e.g.setAttribute('aria-label',seatLabel(s.id)+', '+(isTaken?'zajęte: '+p.name+(pid===uid?' (Ty)':''):'wolne'));
  });

  var gateMode=(status==='autherr'||status==='denied'||status==='setup');
  $('gate').hidden=!gateMode;
  $('layout').hidden=gateMode || status==='init';
  if(gateMode){
    var g=GATE[status];
    var gt=g.text;
    if(status==='autherr'){
      gt=(authCode==='auth/operation-not-allowed')
        ? 'Włącz logowanie anonimowe w Firebase: Authentication → Sign-in method → Anonymous → Enable → Save.'
        : 'Sprawdź połączenie z internetem i spróbuj ponownie.';
    }
    $('gateTitle').textContent=g.title; $('gateText').textContent=gt;
    $('gateBtn').textContent=g.btn; $('gateBtn').hidden=!g.btn;
  }

  var summary='Wczytuję…';
  if(status==='ready'){summary=taken+' z '+SEATS.length+' miejsc zajętych';}
  else if(status==='loading'){summary='Wczytuję plan…';}
  else if(status==='autherr'){summary='Nie udało się połączyć';}
  else if(status==='denied'){summary='Brak dostępu';}
  else if(status==='setup'){summary='Brakuje konfiguracji';}
  $('summary').textContent=summary;
  $('meterFill').style.width=(SEATS.length?Math.round(taken/SEATS.length*100):0)+'%';

  var ids=Object.keys(profiles);
  $('count').textContent=ids.length;

  /* przycisk profilu w nagłówku */
  var meBtn=$('meBtn'), mp=profiles[uid];
  meBtn.hidden=!(status==='ready' && uid);
  if(mp){
    meBtn.classList.remove('new');
    paintAv($('meAv'),mp.name,mp.avatar);
    $('meLabel').textContent=mp.name;
  }else{
    meBtn.classList.add('new');
    $('meLabel').textContent='Utwórz profil';
  }
  $('hintText').textContent = mp
    ? 'Najedź na kółko, aby zobaczyć, kto tam siedzi. Kliknij wolne kółko, aby usiąść, albo swoje, aby wstać.'
    : 'Najedź na kółko, aby zobaczyć, kto tam siedzi. Zrób swój profil, a potem kliknij wolne kółko, aby usiąść.';

  /* lista osób */
  var people=ids.map(function(id){return {id:id,p:profiles[id]};})
    .filter(function(x){return q==='' || norm(x.p.name).indexOf(q)!==-1;})
    .sort(function(a,b){return a.p.name.localeCompare(b.p.name,'pl');});
  var list=$('list');
  list.textContent='';
  people.forEach(function(x){
    var seat=(x.p.seat && occ[x.p.seat]===x.id) ? x.p.seat : null;
    var li=document.createElement('li');
    var b=document.createElement('button');
    b.type='button'; b.className='person'+(seat?'':' noseat');
    var d=document.createElement('span'); d.className='pd'; paintAv(d,x.p.name,x.p.avatar);
    var t=document.createElement('span'); t.className='pt';
    var n=document.createElement('span'); n.className='pn';
    var nn=document.createElement('span'); nn.textContent=x.p.name; n.appendChild(nn);
    if(x.id===uid){var y=document.createElement('em'); y.className='you'; y.textContent='Ty'; n.appendChild(y);}
    var m=document.createElement('span'); m.className='pm'; m.textContent=seat?seatLabel(seat):'Brak miejsca';
    t.appendChild(n); t.appendChild(m); b.appendChild(d); b.appendChild(t); li.appendChild(b);
    if(seat){b.addEventListener('click',function(){locate(seat);});}
    list.appendChild(li);
  });
  var le=$('listEmpty');
  if(status==='loading'){le.textContent='Wczytuję osoby…';}
  else if(status!=='ready'){le.textContent='';}
  else if(people.length===0 && q!==''){le.textContent='Nie znaleziono nikogo dla „'+query.trim()+'”.';}
  else if(people.length===0){le.textContent='Nikt jeszcze nie założył profilu. Kliknij „Utwórz profil”, aby być pierwszą osobą.';}
  else{le.textContent='';}

  if(hoverId){showTip(hoverId);}
}

function locate(id){
  focusId=id; render();
  clearTimeout(focusT);
  focusT=setTimeout(function(){focusId=null; render();},3200);
  try{els[id].g.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});}catch(e){}
}

/* ---------- Dymek po najechaniu ---------- */
function showTip(id){
  if(cardId===id || dlgOpen){hideTip(); return;}
  var pid=occ[id], p=pid?profiles[pid]:null, tip=$('tip');
  if(p){
    $('tipName').textContent=p.name+(pid===uid?' (Ty)':'');
    $('tipSub').textContent=seatLabel(id);
  }else{
    var more='';
    if(canAct()){more=profiles[uid]?' · kliknij, aby usiąść':' · kliknij, aby założyć profil';}
    $('tipName').textContent='Wolne miejsce';
    $('tipSub').textContent=seatLabel(id)+more;
  }
  var r=els[id].dot.getBoundingClientRect();
  var w=tip.offsetWidth, h=tip.offsetHeight, vw=document.documentElement.clientWidth;
  var left=Math.min(Math.max(r.left+r.width/2-w/2,8),vw-w-8);
  var top=r.top-h-10;
  if(top<8){top=r.bottom+10;}
  tip.style.left=left+'px'; tip.style.top=top+'px';
  tip.classList.add('on');
}
function hideTip(){$('tip').classList.remove('on');}

/* ---------- Powiadomienie ---------- */
var toastT=null;
function toast(msg){
  var t=$('toast'); t.textContent=msg; t.classList.add('on');
  clearTimeout(toastT); toastT=setTimeout(function(){t.classList.remove('on');},3800);
}
function failToast(e){
  if(e && e.code==='permission-denied'){toast('Brak uprawnień do zapisu. Sprawdź, czy reguły Firestore są opublikowane.');}
  else{toast('Nie udało się zapisać. Spróbuj ponownie.');}
}

/* ---------- Zapis ---------- */
var chain=Promise.resolve();
function enqueue(fn){chain=chain.then(fn).catch(function(){}); return chain;}

/* zapisuje cały własny profil, zmieniając tylko pola z patch */
function writeProfile(patch){
  var cur=profiles[uid]||{};
  var next={name:cur.name,avatar:cur.avatar||null,seat:cur.seat||null,seatAt:cur.seatAt||null};
  for(var k in patch){next[k]=patch[k];}
  var data={name:next.name,updatedAt:Date.now()};
  if(next.avatar){data.avatar=next.avatar;}
  if(next.seat){data.seat=next.seat; data.seatAt=next.seatAt||Date.now();}
  return setDoc(doc(fbDb,'profiles',uid),data);
}

function claim(id){
  if(!profiles[uid]){openDlg(id); return;}
  enqueue(function(){
    if(occ[id] && occ[id]!==uid){toast('Ktoś właśnie zajął to miejsce.'); return;}
    return writeProfile({seat:id,seatAt:Date.now()})
      .then(function(){toast('Siedzisz teraz: '+seatLabel(id)+'.');})
      .catch(failToast);
  });
}
function leave(){
  enqueue(function(){
    return writeProfile({seat:null,seatAt:null})
      .then(function(){toast('Miejsce zwolnione.');})
      .catch(failToast);
  });
}
/* dwie osoby kliknęły to samo miejsce naraz: zostaje ta, która była pierwsza */
function checkConflict(){
  var p=profiles[uid];
  if(!p || !p.seat || !SEATMAP[p.seat] || !occ[p.seat] || occ[p.seat]===uid || conflictBusy){return;}
  conflictBusy=true;
  var other=profiles[occ[p.seat]];
  toast('Miejsce zajął wcześniej ktoś inny'+(other?' ('+other.name+')':'')+'. Wybierz inne.');
  enqueue(function(){
    return writeProfile({seat:null,seatAt:null}).catch(function(){}).then(function(){conflictBusy=false;});
  });
}

function onSeatClick(id){
  if(cardId===id){closeCard(); return;}
  if(occ[id]){openCard(id); return;}
  if(!canAct()){toast('Plan jeszcze się wczytuje.'); return;}
  closeCard(); claim(id);
}

/* ---------- Karta miejsca ---------- */
var card=$('card'), scrim=$('scrim');
function isSheet(){return window.matchMedia('(max-width: 640px)').matches;}
function openCard(id){
  closeCard(); hideTip(); hoverId=null;
  cardId=id;
  var pid=occ[id], p=profiles[pid], mine=(pid===uid);
  paintAv($('cardAv'),p.name,p.avatar);
  $('cardName').textContent=p.name+(mine?' (Ty)':'');
  $('cardSub').textContent=seatLabel(id);
  $('cardActions').hidden=!mine;
  if(isSheet()){
    card.style.left=''; card.style.top=''; card.classList.remove('above','below');
    scrim.classList.add('on');
  }else{
    var r=els[id].dot.getBoundingClientRect();
    var w=card.offsetWidth, h=card.offsetHeight;
    var vw=document.documentElement.clientWidth, vh=window.innerHeight;
    var cx=r.left+r.width/2;
    var left=Math.min(Math.max(cx-w/2,12),vw-w-12);
    var below=(r.bottom+14+h<=vh-12) || (r.top-14-h<12);
    var top=below ? r.bottom+14 : r.top-14-h;
    card.style.left=(left+window.scrollX)+'px';
    card.style.top=(top+window.scrollY)+'px';
    card.style.setProperty('--ax',Math.min(Math.max(cx-left,26),w-26)+'px');
    card.classList.toggle('below',below); card.classList.toggle('above',!below);
  }
  card.classList.add('on');
}
function closeCard(){
  if(cardId===null){return;}
  cardId=null;
  card.classList.remove('on');
  if(!dlgOpen){scrim.classList.remove('on');}
}
$('cardFree').addEventListener('click',function(){closeCard(); leave();});
$('cardEdit').addEventListener('click',function(){closeCard(); openDlg(null);});
document.addEventListener('pointerdown',function(e){
  if(cardId===null){return;}
  if(card.contains(e.target)){return;}
  if(e.target.closest && e.target.closest('.seat')){return;}
  closeCard();
});

/* ---------- Okno profilu ---------- */
var dlg=$('dlg'), input=$('nameInput');
var dlgAv=null, curAv=null, deleteArmed=false, deleteT=null;

function avButton(cls,label,pressed,onClick){
  var b=document.createElement('button');
  b.type='button'; b.className=cls;
  b.setAttribute('aria-pressed',pressed?'true':'false');
  if(label){b.setAttribute('aria-label',label); b.title=label;}
  b.addEventListener('click',onClick);
  return b;
}
function pickAv(a){dlgAv=a; renderPicker(); updateDlg();}
function renderPicker(){
  var grid=$('avGrid'); grid.textContent='';
  var none=avButton('av none','Sam kolor, bez obrazka',!dlgAv,function(){pickAv(null);});
  none.appendChild(document.createElement('i'));
  grid.appendChild(none);
  EMOJI.forEach(function(em){
    var b=avButton('av',null,dlgAv && dlgAv.t==='e' && dlgAv.v===em,function(){pickAv({t:'e',v:em});});
    b.textContent=em;
    grid.appendChild(b);
  });
  var th=$('photoThumb'); th.textContent='';
  var hasPhoto=!!(dlgAv && dlgAv.t==='i');
  if(hasPhoto){
    var tb=avButton('av','Twoje zdjęcie',true,function(){});
    tb.style.backgroundImage='url("'+dlgAv.v+'")';
    th.appendChild(tb);
  }
  $('photoBtn').textContent = hasPhoto ? 'Zmień zdjęcie' : 'Wgraj własne zdjęcie';
}
function updateDlg(){
  var v=cleanName(input.value), p=profiles[uid];
  paintAv($('dlgAvatar'),v||'?',dlgAv);
  var changed = !p || v!==p.name || avKey(dlgAv)!==avKey(curAv);
  $('dlgSave').disabled = v==='' || !changed;
}
function resetDelete(){
  deleteArmed=false; clearTimeout(deleteT);
  $('dlgDelete').textContent='Usuń profil';
}
function openDlg(seatId){
  closeCard(); hideTip(); hoverId=null;
  dlgOpen=true; pendingSeat=seatId||null;
  var p=profiles[uid];
  $('dlgTitle').textContent = p ? 'Twój profil' : 'Zrób swój profil';
  $('dlgSub').textContent = p
    ? 'Zmień imię i nazwisko albo obrazek. Wszystko zapisuje się na stałe.'
    : 'Wpisz, jak się nazywasz, wybierz obrazek i kliknij na planie swoje miejsce.';
  input.value = p ? p.name : cleanName(accountName);
  curAv = p && p.avatar ? p.avatar : null; dlgAv = curAv;
  resetDelete(); $('dlgDelete').hidden=!p;
  renderPicker(); updateDlg();
  scrim.classList.add('on'); dlg.classList.add('on');
  try{input.focus({preventScroll:true}); input.select();}catch(e){}
}
function closeDlg(){
  if(!dlgOpen){return;}
  dlgOpen=false; pendingSeat=null; resetDelete();
  dlg.classList.remove('on'); scrim.classList.remove('on');
  var b=$('meBtn'); if(!b.hidden){try{b.focus({preventScroll:true});}catch(e){}}
}
input.addEventListener('input',updateDlg);
$('dlgCancel').addEventListener('click',closeDlg);
scrim.addEventListener('click',function(){if(dlgOpen){closeDlg();}else{closeCard();}});
$('meBtn').addEventListener('click',function(){openDlg(null);});

dlg.addEventListener('submit',function(e){
  e.preventDefault();
  if($('dlgSave').disabled){return;}
  var name=cleanName(input.value), av=dlgAv, seat=pendingSeat, isNew=!profiles[uid];
  closeDlg();
  enqueue(function(){
    var patch={name:name,avatar:av}, sat=false;
    if(seat && (!occ[seat] || occ[seat]===uid)){patch.seat=seat; patch.seatAt=Date.now(); sat=true;}
    return writeProfile(patch).then(function(){
      if(sat){toast('Profil zapisany. Siedzisz: '+seatLabel(seat)+'.');}
      else if(seat){toast('Profil zapisany, ale to miejsce zajął już ktoś inny.');}
      else if(isNew){toast('Profil zapisany. Kliknij wolne kółko, aby usiąść.');}
      else{toast('Zmiany zapisane.');}
    }).catch(failToast);
  });
});
$('dlgDelete').addEventListener('click',function(){
  var b=$('dlgDelete');
  if(!deleteArmed){
    deleteArmed=true; b.textContent='Na pewno usunąć?';
    clearTimeout(deleteT); deleteT=setTimeout(resetDelete,4000);
    return;
  }
  closeDlg();
  enqueue(function(){
    return deleteDoc(doc(fbDb,'profiles',uid)).then(function(){toast('Profil usunięty.');}).catch(failToast);
  });
});

/* zdjęcie: kadrowanie do kwadratu i zmniejszenie do 112 px */
function viaImg(file){
  return new Promise(function(resolve,reject){
    var u=URL.createObjectURL(file), im=new Image();
    im.onload=function(){URL.revokeObjectURL(u); resolve(im);};
    im.onerror=function(){URL.revokeObjectURL(u); reject(new Error('img'));};
    im.src=u;
  });
}
function loadImage(file){
  if(window.createImageBitmap){return createImageBitmap(file).catch(function(){return viaImg(file);});}
  return viaImg(file);
}
$('photoBtn').addEventListener('click',function(){$('photoInput').click();});
$('photoInput').addEventListener('change',function(e){
  var f=e.target.files && e.target.files[0];
  e.target.value='';
  if(!f){return;}
  if(f.type && f.type.indexOf('image/')!==0){toast('Wybierz plik ze zdjęciem.'); return;}
  loadImage(f).then(function(img){
    var S=112, c=document.createElement('canvas'); c.width=S; c.height=S;
    var ctx=c.getContext('2d');
    var w=img.width||img.naturalWidth, h=img.height||img.naturalHeight, m=Math.min(w,h);
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,S,S);
    ctx.drawImage(img,(w-m)/2,(h-m)/2,m,m,0,0,S,S);
    pickAv({t:'i',v:c.toDataURL('image/jpeg',0.85)});
    if(img.close){img.close();}
  }).catch(function(){toast('Nie udało się wczytać zdjęcia. Spróbuj JPG albo PNG.');});
});

/* ---------- Klawiatura ---------- */
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    if(dlgOpen){closeDlg();} else if(cardId!==null){closeCard();}
    return;
  }
  if(e.key==='Tab' && dlgOpen){
    var f=[].slice.call(dlg.querySelectorAll('button,input')).filter(function(x){
      return !x.hidden && !x.disabled && x.type!=='file' && x.offsetParent!==null;
    });
    if(!f.length){return;}
    var first=f[0], last=f[f.length-1];
    if(e.shiftKey && document.activeElement===first){e.preventDefault(); last.focus();}
    else if(!e.shiftKey && document.activeElement===last){e.preventDefault(); first.focus();}
    else if(!dlg.contains(document.activeElement)){e.preventDefault(); first.focus();}
  }
});

/* ---------- Wyszukiwarka ---------- */
$('q').addEventListener('input',function(e){query=e.target.value; render();});
$('q').addEventListener('keydown',function(e){
  if(e.key==='Escape' && $('q').value){$('q').value=''; query=''; render();}
});

/* ---------- Logowanie (Firebase Auth) i dane (Firestore) ---------- */
function configured(){
  var c=firebaseConfig||{};
  return !!(c.apiKey && c.projectId && String(c.apiKey).indexOf('WKLEJ')!==0 && String(c.projectId).indexOf('WKLEJ')!==0);
}
function stopData(){
  if(unsub){unsub(); unsub=null;}
  profiles={}; occ={}; prompted=false; conflictBusy=false;
  closeCard(); closeDlg();
}
/* logowanie anonimowe: bez kont i haseł, przeglądarka dostaje własny, stały identyfikator */
function connect(){
  status='loading'; authCode=''; render();
  signInAnonymously(fbAuth).catch(function(e){
    authCode=(e && e.code) || ''; status='autherr'; render();
  });
}
$('gateBtn').addEventListener('click',function(){
  if(status==='autherr'){connect();}
});

function onSnap(snap){
  var m={};
  snap.docs.forEach(function(d){
    var v=d.data();
    if(!v || typeof v.name!=='string' || !v.name.trim()){return;}
    m[d.id]={
      name:cleanName(v.name),
      avatar:validAv(v.avatar),
      seat:(typeof v.seat==='string' && SEATMAP[v.seat]) ? v.seat : null,
      seatAt:typeof v.seatAt==='number' ? v.seatAt : 0
    };
  });
  profiles=m; derive(); status='ready';
  render(); checkConflict();
  /* pierwsze logowanie: od razu zaproponuj założenie profilu (dopiero po danych z serwera) */
  if(!snap.metadata.fromCache && !profiles[uid] && !prompted && !dlgOpen){
    prompted=true; openDlg(null);
  }
}
function onSnapErr(e){
  if(e && e.code==='permission-denied'){stopData(); status='denied'; render(); return;}
  toast('Połączenie z planem zostało przerwane. Odśwież stronę.');
}

function start(){
  if(!configured()){status='setup'; render(); return;}
  var app=initializeApp(firebaseConfig);
  fbAuth=getAuth(app); fbDb=getFirestore(app);
  render();
  onAuthStateChanged(fbAuth,function(user){
    stopData();
    if(!user){
      uid=null;
      if(status!=='autherr'){connect();}
      return;
    }
    uid=user.uid; accountName=user.displayName||'';
    status='loading'; render();
    unsub=onSnapshot(collection(fbDb,'profiles'),onSnap,onSnapErr);
  });
}
start();
