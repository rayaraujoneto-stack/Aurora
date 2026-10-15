'use strict';
const STORAGE_KEY='aurora-stream-items-v1';
const EPG_KEY='aurora-stream-epg-v1';
const PLUTO_URL='https://raw.githubusercontent.com/iprtl/m3u/live/Pluto.m3u';
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const state={items:[],epg:{},view:'tv',search:'',group:'all',active:null,hls:null};
const labels={guide:['Guia de canais','Canais, categorias e programação em um só lugar.'],tv:['TV ao vivo','Escolha um canal para começar.'],video:['Filmes e vídeos','Seus filmes e vídeos em um só lugar.'],music:['Música','Suas músicas, suas playlists.'],favorites:['Favoritos','Todos os conteúdos que você salvou.']};
function validUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)}catch{return false}}
function load(){try{const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');state.items=Array.isArray(raw)?raw.filter(x=>x&&['tv','video','music'].includes(x.type)&&validUrl(x.url)).slice(0,6000):[]}catch{state.items=[]}try{const raw=JSON.parse(localStorage.getItem(EPG_KEY)||'{}');state.epg=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}}catch{state.epg={}}}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state.items));return true}catch{toast('Não foi possível salvar. Limite de armazenamento do navegador atingido.');return false}}
let toastTimer;function toast(text){const node=$('#toast');node.textContent=text;node.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('visible'),4500)}
function id(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`}
function parseAttributes(info){const attrs={};const re=/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g;let match;while((match=re.exec(info))!==null)attrs[match[1].toLowerCase()]=match[2]??match[3]??match[4]??'';return attrs}
function parseM3U(text){const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);let pending=null;const found=[];for(const raw of lines){const line=raw.trim();if(line.startsWith('#EXTINF:')){const body=line.slice(8);const attrs=parseAttributes(body);const comma=findCommaOutsideQuotes(body);const name=comma<0?'':body.slice(comma+1).trim();pending={title:name||attrs['tvg-name']||'Canal sem nome',group:attrs['group-title']||'Sem grupo',logo:validUrl(attrs['tvg-logo']||'')?attrs['tvg-logo']:'',tvgId:attrs['tvg-id']||''};continue}if(!line||line.startsWith('#'))continue;if(pending&&validUrl(line)){found.push({...pending,url:line,type:'tv',favorite:false,id:id()});pending=null}else if(pending){pending=null}}return found}
function findCommaOutsideQuotes(s){let quote='';for(let i=0;i<s.length;i++){if(s[i]==='"'||s[i]==="'"){if(!quote)quote=s[i];else if(quote===s[i])quote=''}else if(s[i]===','&&!quote)return i}return -1}
function uniqueImport(newItems){let added=0;const existing=new Set(state.items.map(x=>`${x.type}|${x.url}`));for(const item of newItems){const key=`${item.type}|${item.url}`;if(!existing.has(key)){state.items.push(item);existing.add(key);added++}}return added}
async function loadPlutoPlaylist(){
  const buttons=[$('#loadPluto'),$('#heroPluto')];
  buttons.forEach(b=>{b.disabled=true;b.dataset.original=b.textContent;b.textContent='Carregando lista...'});
  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),25000);
    let response;
    try{response=await fetch(PLUTO_URL,{signal:controller.signal,cache:'no-store'})}finally{clearTimeout(timeout)}
    if(!response.ok)throw new Error(`Erro HTTP ${response.status}`);
    const contentLength=Number(response.headers.get('content-length')||0);
    if(contentLength>8*1024*1024)throw new Error('Playlist acima do limite de 8 MB');
    const contents=await response.text();
    if(contents.length>8*1024*1024)throw new Error('Playlist acima do limite de 8 MB');
    const parsed=parseM3U(contents).filter(x=>x.title&&!/buy me a coffee|contact:|donat/i.test(x.title));
    if(!parsed.length)throw new Error('Não foram encontrados canais M3U válidos');
    const added=uniqueImport(parsed);
    persist();setView('tv');
    toast(`Lista Pluto: ${added} novo(s) canal(is), ${parsed.length-added} duplicado(s) ignorado(s).`);
  }catch(err){
    console.error('Importação Pluto:',err);
    toast('Não foi possível carregar a lista diretamente. Use Importar M3U com o arquivo baixado do GitHub.');
  }finally{buttons.forEach(b=>{b.disabled=false;b.textContent=b.dataset.original})}
}
function currentProgram(item){const programs=state.epg[item.tvgId];if(!Array.isArray(programs))return '';const now=Date.now();const found=programs.find(x=>x.start<=now&&x.stop>now);return found?.title||''}
function XMLTVDate(s){if(!s)return NaN;const m=s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-])(\d{2})(\d{2})/);if(!m)return NaN;const [,y,mo,d,h,mi,se='00',sign,oh,om]=m;const utc=Date.UTC(+y,+mo-1,+d,+h,+mi,+se);const offset=(+oh*60 + +om)*60000;return utc-(sign==='+'?offset:-offset)}
function parseXMLTV(content){const doc=new DOMParser().parseFromString(content,'application/xml');if(doc.querySelector('parsererror'))throw Error('XMLTV inválido');const output={};const now=Date.now();for(const p of doc.getElementsByTagName('programme')){const channel=p.getAttribute('channel')||'';const start=XMLTVDate(p.getAttribute('start'));const stop=XMLTVDate(p.getAttribute('stop'));if(!channel||!Number.isFinite(start)||!Number.isFinite(stop)||stop<now-86400000||start>now+7*86400000)continue;const title=p.getElementsByTagName('title')[0]?.textContent?.trim()||'Sem título';(output[channel]??=[]).push({start,stop,title});}for(const key of Object.keys(output))output[key].sort((a,b)=>a.start-b.start);return output}
function render(){const items=state.items;$('#tvCount').textContent=items.filter(x=>x.type==='tv').length;$('#videoCount').textContent=items.filter(x=>x.type==='video').length;$('#musicCount').textContent=items.filter(x=>x.type==='music').length;$('#favoriteCount').textContent=items.filter(x=>x.favorite).length;const [title,subtitle]=labels[state.view];$('#sectionTitle').textContent=title;$('#sectionSubtitle').textContent=subtitle;$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));$$('[data-mobile-view]').forEach(b=>b.classList.toggle('selected',b.dataset.mobileView===state.view));const byView=items.filter(x=>state.view==='favorites'?x.favorite:state.view==='guide'?x.type==='tv':x.type===state.view);const groups=[...new Set(byView.map(x=>x.group).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));const select=$('#groupFilter');select.replaceChildren(new Option('Todos os grupos','all'),...groups.map(x=>new Option(x,x)));if(!groups.includes(state.group))state.group='all';select.value=state.group;select.hidden=groups.length===0;const q=state.search.toLocaleLowerCase('pt-BR');const filtered=byView.filter(x=>(state.group==='all'||x.group===state.group)&&`${x.title} ${x.group||''} ${currentProgram(x)}`.toLocaleLowerCase('pt-BR').includes(q));const isGuide=state.view==='guide';$('#guideInfo').hidden=!isGuide;$('#guideGrid').hidden=!isGuide;const grid=$('#mediaGrid');grid.hidden=isGuide;if(isGuide){renderGuide(filtered)}else{grid.replaceChildren(...filtered.slice(0,600).map(renderCard))}$('#emptyState').hidden=filtered.length>0;$('#emptyTitle').textContent=items.length===0?'Sua biblioteca começa aqui':'Nenhum conteúdo encontrado';$('#emptyText').textContent=items.length===0?'Importe uma playlist M3U própria ou adicione uma URL de mídia autorizada.':'Experimente outro filtro, ou adicione mais conteúdo à sua biblioteca.';}
function renderCard(item){const card=document.createElement('article');card.className='media-card';const poster=document.createElement('div');poster.className='poster';const fallback=document.createElement('span');fallback.className='poster-fallback';fallback.textContent=item.type==='music'?'♫':item.type==='tv'?'▣':'▤';poster.append(fallback);if(item.logo&&validUrl(item.logo)){const img=document.createElement('img');img.loading='lazy';img.referrerPolicy='no-referrer';img.alt='';img.src=item.logo;img.onerror=()=>img.remove();poster.append(img)}const type=document.createElement('span');type.className='type-label';type.textContent={tv:'AO VIVO',video:'VÍDEO',music:'MÚSICA'}[item.type];poster.append(type);const body=document.createElement('div');body.className='card-body';const h=document.createElement('h3');h.textContent=item.title;h.title=item.title;const sub=document.createElement('p');sub.textContent=currentProgram(item)||item.group||'Sem grupo';sub.title=sub.textContent;const actions=document.createElement('div');actions.className='card-actions';const play=document.createElement('button');play.className='small-button';play.textContent='▶ Reproduzir';play.onclick=()=>openPlayer(item.id);const favorite=document.createElement('button');favorite.className=`small-button heart${item.favorite?' saved':''}`;favorite.textContent=item.favorite?'♥':'♡';favorite.title=item.favorite?'Desfavoritar':'Favoritar';favorite.setAttribute('aria-label',favorite.title);favorite.onclick=()=>toggleFavorite(item.id);const remove=document.createElement('button');remove.className='small-button remove';remove.textContent='×';remove.title='Remover da biblioteca';remove.setAttribute('aria-label','Remover '+item.title);remove.onclick=()=>removeItem(item.id);actions.append(play,favorite,remove);body.append(h,sub,actions);card.append(poster,body);return card}
function renderGuide(items){
  const container=$('#guideGrid');const fragment=document.createDocumentFragment();
  for(const item of items.slice(0,1200)){
    const row=document.createElement('div');row.className='guide-row';
    const launch=document.createElement('button');launch.className='guide-channel';launch.title='Assistir '+item.title;
    const mark=document.createElement('span');mark.className='guide-logo';mark.textContent='▣';
    if(item.logo&&validUrl(item.logo)){const img=document.createElement('img');img.src=item.logo;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();mark.append(img)}
    const name=document.createElement('span');name.className='guide-name';name.textContent=item.title;
    const group=document.createElement('small');group.textContent=item.group||'TV ao vivo';
    const stack=document.createElement('span');stack.className='guide-name-block';stack.append(name,group);
    launch.append(mark,stack);launch.onclick=()=>openPlayer(item.id);
    const epg=document.createElement('div');epg.className='guide-program';
    const now=Date.now();const listings=Array.isArray(state.epg[item.tvgId])?state.epg[item.tvgId]:[];
    const current=listings.find(x=>x.start<=now&&x.stop>now);
    const next=listings.find(x=>x.start>now);
    const heading=document.createElement('strong');heading.textContent=current?current.title:'Programação indisponível';
    const subtitle=document.createElement('small');subtitle.textContent=current?`${clock(current.start)}–${clock(current.stop)}${next?' · A seguir: '+next.title:''}`:'Importe um XMLTV compatível com o tvg-id';
    epg.append(heading,subtitle);
    if(current){const progress=document.createElement('div');progress.className='epg-progress';const fill=document.createElement('span');fill.style.width=Math.max(0,Math.min(100,(now-current.start)/(current.stop-current.start)*100))+'%';progress.append(fill);epg.append(progress)}
    const actions=document.createElement('div');actions.className='guide-actions';
    const fav=document.createElement('button');fav.className='guide-fav';fav.textContent=item.favorite?'♥':'♡';fav.setAttribute('aria-label',(item.favorite?'Desfavoritar ':'Favoritar ')+item.title);fav.onclick=()=>toggleFavorite(item.id);
    const play=document.createElement('button');play.className='guide-play';play.textContent='▶ Assistir';play.onclick=()=>openPlayer(item.id);
    actions.append(fav,play);row.append(launch,epg,actions);fragment.append(row);
  }
  container.replaceChildren(fragment);
  if(items.length>1200){const info=document.createElement('p');info.className='guide-limit';info.textContent=`Exibindo 1.200 de ${items.length} canais. Refine a busca ou escolha uma categoria.`;container.append(info)}
}
function clock(timestamp){return new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date(timestamp))}
function toggleFavorite(itemId){const item=state.items.find(x=>x.id===itemId);if(!item)return;item.favorite=!item.favorite;persist();render();if(state.active===itemId)$('#playerFavorite').textContent=item.favorite?'♥ Favoritado':'♡ Favoritar'}
function removeItem(itemId){const item=state.items.find(x=>x.id===itemId);if(!item||!confirm(`Remover "${item.title}" da biblioteca?`))return;if(state.active===itemId)closePlayer();state.items=state.items.filter(x=>x.id!==itemId);persist();render();toast('Conteúdo removido.');}
function setView(view){state.view=view;state.group='all';render()}
function openForm(kind='add'){$('#formOverlay').hidden=false;$('#formMessage').textContent='';$('#addForm').hidden=kind!=='add';$('#importForm').hidden=kind!=='import';$('#epgForm').hidden=kind!=='epg';$('#formTitle').textContent={add:'Adicionar conteúdo',import:'Importar playlist M3U',epg:'Carregar guia EPG'}[kind];$('#formEyebrow').textContent='GERENCIAR BIBLIOTECA';}
function closeForm(){$('#formOverlay').hidden=true}
function stopPlayer(){if(state.hls){state.hls.destroy();state.hls=null}for(const node of [$('#videoPlayer'),$('#audioPlayer')]){node.pause();node.removeAttribute('src');node.load()}state.active=null}
function closePlayer(){stopPlayer();$('#playerOverlay').hidden=true}
function openPlayer(itemId){const item=state.items.find(x=>x.id===itemId);if(!item)return;if(window.AuroraNative&&typeof window.AuroraNative.postMessage==='function'){
  // Em Android o Media3 faz a reprodução; o player web 1.4 permanece como fallback no navegador.
  window.AuroraNative.postMessage(JSON.stringify({action:'play',title:item.title,url:item.url,type:item.type}));
  return;
}stopPlayer();state.active=itemId;$('#playerOverlay').hidden=false;$('#playerTitle').textContent=item.title;$('#playerMeta').textContent=`${item.group||'Minha biblioteca'} · ${item.type==='tv'?'TV ao vivo':item.type==='video'?'Vídeo':'Música'}`;$('#playerFavorite').textContent=item.favorite?'♥ Favoritado':'♡ Favoritar';const isAudio=item.type==='music';const player=$(isAudio?'#audioPlayer':'#videoPlayer');$('#videoPlayer').hidden=isAudio;$('#audioPlayer').hidden=!isAudio;$('#audioArt').hidden=!isAudio;$('#playerHint').hidden=true;const isHls=/\.m3u8(?:[?#]|$)/i.test(item.url);if(isHls&&!isAudio&&window.Hls&&window.Hls.isSupported()){const hls=new window.Hls({enableWorker:true});state.hls=hls;hls.loadSource(item.url);hls.attachMedia(player);hls.on(window.Hls.Events.MANIFEST_PARSED,()=>player.play().catch(()=>{}));hls.on(window.Hls.Events.ERROR,(_event,data)=>{if(data.fatal)showPlayerHint('Não foi possível reproduzir esta transmissão. Verifique URL, CORS, formato e autorização do servidor.')});}else{player.src=item.url;player.play().catch(()=>{})}if(isHls&&!isAudio&&!window.Hls&&!player.canPlayType('application/vnd.apple.mpegurl'))showPlayerHint('HLS.js não carregou. Conecte-se à internet ou use um navegador com suporte nativo a HLS.');}
function showPlayerHint(message){$('#playerHint').textContent=message;$('#playerHint').hidden=false}
function bind(){ $$('#navigation [data-view], [data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$$('[data-mobile-view]').forEach(b=>b.onclick=()=>setView(b.dataset.mobileView));$('#searchInput').addEventListener('input',e=>{state.search=e.target.value;render()});$('#groupFilter').addEventListener('change',e=>{state.group=e.target.value;render()});$('#loadPluto').onclick=$('#heroPluto').onclick=loadPlutoPlaylist;$('#openImport').onclick=$('#heroImport').onclick=()=>openForm('import');$('#openAdd').onclick=$('#heroAdd').onclick=$('#emptyAdd').onclick=()=>openForm('add');$('#openEpg').onclick=()=>openForm('epg');$('#closeForm').onclick=closeForm;$('#closePlayer').onclick=closePlayer;$('#formOverlay').addEventListener('click',e=>{if(e.target===$('#formOverlay'))closeForm()});$('#playerOverlay').addEventListener('click',e=>{if(e.target===$('#playerOverlay'))closePlayer()});document.addEventListener('keydown',e=>{if(e.key.startsWith('Arrow')&&!e.altKey&&!e.ctrlKey){if(handleRemoteArrow(e))return}if(e.key==='Escape'){closeForm();closePlayer()}if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&$('#formOverlay').hidden){e.preventDefault();$('#searchInput').focus()}});$('#addForm').addEventListener('submit',e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));const url=String(values.url||'').trim();if(!validUrl(url)){formMessage('URL inválida: use HTTP ou HTTPS.',true);return}const item={id:id(),title:String(values.title).trim(),url,type:values.type,group:String(values.group||'').trim(),logo:validUrl(values.logo||'')?values.logo:'',tvgId:'',favorite:false};if(state.items.some(x=>x.url===url&&x.type===item.type)){formMessage('Esta URL já está cadastrada nessa categoria.',true);return}state.items.push(item);persist();setView(item.type);e.currentTarget.reset();closeForm();toast('Conteúdo adicionado com sucesso.');});$('#importForm').addEventListener('submit',async e=>{e.preventDefault();const f=$('#m3uFile').files?.[0];if(!f)return;if(f.size>8*1024*1024){formMessage('Arquivo muito grande (limite: 8 MB).',true);return}try{const parsed=parseM3U(await f.text());if(parsed.length===0){formMessage('Nenhuma entrada M3U com URL HTTP(S) foi encontrada.',true);return}const count=uniqueImport(parsed);persist();setView('tv');e.currentTarget.reset();closeForm();toast(`${count} canal(is) importado(s). ${parsed.length-count} duplicado(s) ignorado(s).`)}catch{formMessage('Falha ao ler a playlist.',true)}});$('#epgForm').addEventListener('submit',async e=>{e.preventDefault();const f=$('#epgFile').files?.[0];if(!f)return;if(f.size>15*1024*1024){formMessage('XML muito grande (limite: 15 MB).',true);return}try{let epgContent;if(/\.gz$/i.test(f.name)){if(!('DecompressionStream' in window))throw Error('Seu navegador não suporta GZIP. Use um XML descompactado.');epgContent=await new Response(f.stream().pipeThrough(new DecompressionStream('gzip'))).text()}else epgContent=await f.text();const parsed=parseXMLTV(epgContent);state.epg=parsed;try{localStorage.setItem(EPG_KEY,JSON.stringify(parsed))}catch{toast('EPG grande: mantido apenas até recarregar a página.')}render();e.currentTarget.reset();closeForm();toast(`EPG carregado para ${Object.keys(parsed).length} identificadores.`)}catch(err){formMessage(err.message||'Erro ao ler XMLTV.',true)}});$('#playerFavorite').onclick=()=>toggleFavorite(state.active);$('#videoPlayer').addEventListener('error',()=>{if(state.active)showPlayerHint('O navegador não conseguiu reproduzir a mídia. Verifique o codec, o endereço e as permissões do servidor.')});$('#audioPlayer').addEventListener('error',()=>{if(state.active)showPlayerHint('Áudio indisponível ou formato não compatível com este navegador.')});$('#resetButton').onclick=()=>{if(!confirm('Apagar toda a biblioteca, favoritos e EPG salvos neste dispositivo?'))return;closePlayer();state.items=[];state.epg={};localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(EPG_KEY);state.view='tv';state.group='all';state.search='';$('#searchInput').value='';render();toast('Dados locais apagados.')};}
function handleRemoteArrow(e){
  if(!$('#playerOverlay').hidden||!$('#formOverlay').hidden)return false;
  const active=document.activeElement;
  if(['INPUT','TEXTAREA','SELECT'].includes(active.tagName))return false;
  const candidates=[...document.querySelectorAll('button:not([disabled]):not([hidden]),a[href],select')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
  if(!candidates.length)return false;
  if(!candidates.includes(active)){e.preventDefault();candidates[0].focus();return true}
  const current=active.getBoundingClientRect();const cx=current.left+current.width/2,cy=current.top+current.height/2;
  const dir=e.key;let best=null,score=Infinity;
  for(const el of candidates){if(el===active)continue;const r=el.getBoundingClientRect();const dx=r.left+r.width/2-cx,dy=r.top+r.height/2-cy;
    if((dir==='ArrowRight'&&dx<=5)||(dir==='ArrowLeft'&&dx>=-5)||(dir==='ArrowDown'&&dy<=5)||(dir==='ArrowUp'&&dy>=-5))continue;
    const main=(dir==='ArrowRight'||dir==='ArrowLeft')?Math.abs(dx):Math.abs(dy);
    const cross=(dir==='ArrowRight'||dir==='ArrowLeft')?Math.abs(dy):Math.abs(dx);
    const value=main+cross*2.2;if(value<score){score=value;best=el}
  }
  if(best){e.preventDefault();best.focus({preventScroll:true});best.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});return true}
  return false
}
function formMessage(msg,error=false){const el=$('#formMessage');el.textContent=msg;el.style.color=error?'#ff9a9a':'#7fdea9'}
load();bind();render();
