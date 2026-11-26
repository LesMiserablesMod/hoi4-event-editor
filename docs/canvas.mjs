export function setupCanvas({stage,surface,hand,resetView,resetZoom}){
 let x=0,y=0,grab=null,space=false,handOn=false;
 function move(nextX,nextY){
  x=nextX;y=nextY;
  surface.style.transform='translate('+x+'px,'+y+'px)';
  stage.style.backgroundPosition=x+'px '+y+'px';
 }
 function reset(){
  move(0,0);stage.scrollTop=0;stage.scrollLeft=0;
 }
 const typing=el=>el instanceof Element&&el.closest('input,textarea,select,[contenteditable=true],dialog');
 const showCursor=()=>{
  stage.classList.toggle('can-grab',handOn||space);
  hand.setAttribute('aria-pressed',String(handOn));
 };
 hand.addEventListener('click',()=>{handOn=!handOn;showCursor();if(handOn)stage.focus({preventScroll:true});});
 resetView.addEventListener('click',()=>{resetZoom();reset();});
 stage.addEventListener('pointerdown',e=>{
  if(grab||e.button!==0&&e.button!==1||!e.isPrimary)return;
  if(e.button!==1&&!handOn&&!space&&e.target.closest('[data-encoded],a,button,input'))return;
  e.preventDefault();stage.focus({preventScroll:true});
  grab={id:e.pointerId,px:e.clientX,py:e.clientY,x,y};stage.setPointerCapture(e.pointerId);stage.classList.add('dragging');
 });
 stage.addEventListener('pointermove',e=>{
  if(grab?.id===e.pointerId)move(grab.x+e.clientX-grab.px,grab.y+e.clientY-grab.py);
 });
 function finish(){grab=null;stage.classList.remove('dragging');}
 for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(type,e=>{
  if(grab?.id===e.pointerId)finish();
 });
 stage.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});
 stage.addEventListener('dragstart',e=>{if(e.target.tagName==='IMG')e.preventDefault();});
 stage.addEventListener('wheel',e=>{
  if(e.ctrlKey||e.metaKey)return;
  e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?stage.clientHeight:1;
  move(x-(e.shiftKey&&!e.deltaX?e.deltaY:e.deltaX)*unit,y-(e.shiftKey&&!e.deltaX?0:e.deltaY)*unit);
 },{passive:false});
 document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||typing(e.target)||document.querySelector('dialog[open]'))return;
  if(e.code==='Space' && (stage.contains(document.activeElement)||stage.matches(':hover'))){
    e.preventDefault();space=true;showCursor();
  }
  if(e.target===stage&&e.key.startsWith('Arrow')){
   const dx={ArrowLeft:40,ArrowRight:-40}[e.key]||0,dy={ArrowUp:40,ArrowDown:-40}[e.key]||0;
   e.preventDefault();move(x+dx,y+dy);
  }
 });
 document.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;showCursor();}});
 window.addEventListener('blur',()=>{space=false;finish();showCursor();});
 return {reset};
}
