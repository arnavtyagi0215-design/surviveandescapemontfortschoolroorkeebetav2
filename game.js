const THREE = window.THREE;
const $ = s => document.querySelector(s);
const game = $('#game');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111b20);
scene.fog = new THREE.FogExp2(0x111416, .034);
const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, .1, 110);
const renderer = new THREE.WebGLRenderer({antialias:!matchMedia('(pointer: coarse)').matches, powerPreference:'high-performance'});
let graphicsMode = 'high';
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.45 : 2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
game.appendChild(renderer.domElement);

const ambient = new THREE.HemisphereLight(0xb9c9d3,0x100f13,.62);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight(0xc5d3dc,1.0);
keyLight.position.set(-14,22,10); keyLight.castShadow=true;
keyLight.shadow.camera.left=-28;keyLight.shadow.camera.right=28;keyLight.shadow.camera.top=36;keyLight.shadow.camera.bottom=-36;
keyLight.shadow.camera.near=.5;keyLight.shadow.camera.far=90;keyLight.shadow.bias=-.00018;keyLight.shadow.normalBias=.025;keyLight.shadow.radius=3;
keyLight.shadow.mapSize.set(2048,2048); scene.add(keyLight);
function setGraphicsMode(mode,announce=false){
 graphicsMode=mode==='balanced'?'balanced':'high';
 const mobile=matchMedia('(pointer: coarse)').matches||innerWidth<760;
 renderer.shadowMap.enabled=graphicsMode==='high';
 const ratioCap=graphicsMode==='high'?(mobile?1.45:2): (mobile?1:1.25);
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,ratioCap));renderer.setSize(innerWidth,innerHeight,false);
 const shadowSize=graphicsMode==='high'?(mobile?1024:2048):768;
 keyLight.shadow.mapSize.set(shadowSize,shadowSize);keyLight.shadow.map?.dispose();keyLight.shadow.map=null;keyLight.shadow.needsUpdate=true;
 renderer.toneMappingExposure=graphicsMode==='high'?1.02:.96;
 document.querySelectorAll('.quality-btn').forEach(button=>button.classList.toggle('selected',button.dataset.quality===graphicsMode));
 const status=$('#qualityStatus');if(status)status.textContent=graphicsMode==='high'?'High detail · device adaptive':'Smoother play · reduced render cost';
 if(announce&&typeof say==='function')say(graphicsMode==='high'?'High detail graphics enabled':'Smoother graphics enabled');
}
setGraphicsMode(matchMedia('(pointer: coarse)').matches?'balanced':'high');
const flashlight = new THREE.SpotLight(0xffe7bd,34,19,Math.PI/7,.5,1.2);
camera.add(flashlight); flashlight.position.set(0,0,0);
flashlight.target.position.set(0,0,-1); camera.add(flashlight.target); scene.add(camera);

const T=3,W=17,H=23;
let TOTAL_TIME=480;
let difficulty='normal';
const difficultySettings={
 easy:{time:720,vision:7.5,darkVision:5.2,hearing:5.2,chase:2.2,investigate:1.7,patrol:.88,search:4},
 normal:{time:480,vision:10,darkVision:6.5,hearing:6.5,chase:2.65,investigate:2.1,patrol:1.05,search:5.5},
 hard:{time:360,vision:12,darkVision:8,hearing:8,chase:3.15,investigate:2.5,patrol:1.3,search:7}
};
let active=false, selected='Senior', grid=[], keys=[], gateParts=[], teachers=[], doors=[], noise=null, smoke=null, exitPos=null, gatePos=null;
let player={x:0,z:0,yaw:0,pitch:0,stamina:100};
let crouching=false;
let found=0, gateFound=0, elapsed=0, timeLeft=TOTAL_TIME, last=performance.now(), blackoutRemaining=0, untilBlackout=55, lightsOn=true, lightPower=1, caughtLock=0, outside=false;
const held=new Set(), colors={Senior:0x5a978b,Middle:0x617da8,Primary:0xb18b54};
let noiseCharges=4, smokeCharges=2, audioCtx=null, touchMove={x:0,y:0}, touchRun=false, lookPointer=null, stickPointerId=null, mapRefresh=0;
const JUMP_DURATION=.72;let jumpTime=0,jumpCooldown=0;
function makeCanvasTexture(kind){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d');
 if(kind==='wall'){
  c.fillStyle='#e9e5da';c.fillRect(0,0,512,256);c.fillStyle='#526b7b';c.fillRect(0,143,512,113);
  c.fillStyle='#344e61';c.fillRect(0,139,512,5);c.fillStyle='#d8dedb';c.fillRect(0,134,512,4);
  c.fillStyle='#263e50';c.fillRect(0,0,512,24);c.fillStyle='#456174';c.fillRect(0,24,512,6);
  for(let i=0;i<340;i++){let x=Math.random()*512,y=Math.random()*256;c.fillStyle=y>144?'rgba(92,52,55,.035)':'rgba(100,77,47,.035)';c.fillRect(x,y,1+Math.random()*3,1+Math.random()*2)}
  for(let i=0;i<16;i++){let x=Math.random()*500,y=150+Math.random()*100;c.strokeStyle='rgba(90,55,48,.07)';c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.random()*12,y+Math.random()*8);c.stroke()}
 }else{
  c.fillStyle='#555b59';c.fillRect(0,0,512,256);c.strokeStyle='#383e3d';c.lineWidth=3;
  for(let x=0;x<=512;x+=64){c.beginPath();c.moveTo(x,0);c.lineTo(x,256);c.stroke()}
  for(let y=0;y<=256;y+=64){c.beginPath();c.moveTo(0,y);c.lineTo(512,y);c.stroke()}
  for(let i=0;i<1100;i++){let v=Math.random()>.5?'rgba(255,255,255,.04)':'rgba(0,0,0,.04)';c.fillStyle=v;c.fillRect(Math.random()*512,Math.random()*256,2,2)}
 }
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=Math.min(graphicsMode==='high'?8:2,renderer.capabilities.getMaxAnisotropy());return tex
}
const wallMat=new THREE.MeshStandardMaterial({color:0xffffff,map:makeCanvasTexture('wall'),roughness:.88});
const floorMat=new THREE.MeshStandardMaterial({color:0xffffff,map:makeCanvasTexture('floor'),roughness:.72});
const ceilMat=new THREE.MeshStandardMaterial({color:0xe0dfd6,roughness:.96});
const wallBoxes=[], furniture=[], students=[], practicalLights=[], fans=[];
const worldGroup=new THREE.Group(); scene.add(worldGroup);
const mapCanvas=$('#mapCanvas'),mapCtx=mapCanvas?.getContext('2d');

function world(c,r){return {x:(c-(W-1)/2)*T,z:(r-(H-1)/2)*T}}
function cell(x,z){return {c:Math.round(x/T+(W-1)/2),r:Math.round(z/T+(H-1)/2)}}
function floorAt(c,r){return r>=0&&r<H&&c>=0&&c<W&&grid[r]&&grid[r][c]!== '#'}

function drawMiniMap(){
 if(!mapCtx||!grid.length)return;
 const ctx=mapCtx,w=mapCanvas.width,h=mapCanvas.height,cw=w/W,ch=h/H;
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#182329';ctx.fillRect(0,0,w,h);
 for(let r=0;r<H;r++)for(let c=0;c<W;c++){
  const floor=floorAt(c,r),hall=c===8||r===9||r===10||(r===3&&c>=5&&c<=11)||(r===15&&c>=5&&c<=11);
  ctx.fillStyle=!floor?'#303b42':r>=19?'#53634e':hall?'#607582':'#b9b5a7';
  ctx.fillRect(c*cw+.55,r*ch+.55,cw-1.1,ch-1.1);
  if(floor&&r<19){ctx.fillStyle='rgba(14,24,29,.11)';ctx.fillRect(c*cw+1,r*ch+1,cw-2,1)}
 }
 for(const d of doors){
  const x=(d.c+.5)*cw,y=(d.r+.5)*ch;ctx.strokeStyle=d.kind==='exit'?'#8dffc1':'#c9d8dc';ctx.lineWidth=2.1;ctx.beginPath();
  if(d.orientation==='x'){ctx.moveTo(x-cw*.37,y);ctx.lineTo(x+cw*.37,y)}else{ctx.moveTo(x,y-ch*.37);ctx.lineTo(x,y+ch*.37)}ctx.stroke();
 }
 if(gatePos){const gx=(gatePos.x/T+(W-1)/2)*cw,gy=(gatePos.z/T+(H-1)/2)*ch;ctx.strokeStyle='#e5bf76';ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(gx-cw*.62,h-2);ctx.lineTo(gx+cw*.62,h-2);ctx.stroke()}
 for(const k of keys)if(!k.userData.taken){const x=(k.position.x/T+(W-1)/2)*cw,y=(k.position.z/T+(H-1)/2)*ch;ctx.fillStyle='#ffd270';ctx.beginPath();ctx.arc(x,y,2.7,0,Math.PI*2);ctx.fill()}
 if(outside)for(const part of gateParts)if(!part.userData.taken){const x=(part.position.x/T+(W-1)/2)*cw,y=(part.position.z/T+(H-1)/2)*ch;ctx.fillStyle='#ffc65e';ctx.fillRect(x-2.2,y-2.2,4.4,4.4)}
 for(const t of teachers){const x=(t.position.x/T+(W-1)/2)*cw,y=(t.position.z/T+(H-1)/2)*ch;ctx.fillStyle=t.userData.mode==='chase'?'#ff363f':'#ff7770';ctx.beginPath();ctx.arc(x,y,t.userData.mode==='chase'?3.6:2.8,0,Math.PI*2);ctx.fill()}
 const px=(player.x/T+(W-1)/2)*cw,py=(player.z/T+(H-1)/2)*ch;ctx.save();ctx.translate(px,py);ctx.rotate(-player.yaw);ctx.fillStyle='#72ffe1';ctx.shadowColor='#72ffe1';ctx.shadowBlur=7;ctx.beginPath();ctx.moveTo(0,-6.5);ctx.lineTo(4.6,4);ctx.lineTo(0,2.5);ctx.lineTo(-4.6,4);ctx.closePath();ctx.fill();ctx.restore();
}

function buildGrid(wing){
  grid=Array.from({length:H},()=>Array(W).fill('#'));
  function room(x1,z1,x2,z2){for(let z=z1;z<=z2;z++)for(let x=x1;x<=x2;x++)grid[z][x]='.'}
  // Wider 15 m classrooms with a broad central hall and a cross-corridor.
  room(1,1,5,5);room(11,1,15,5);room(1,13,5,17);room(11,13,15,17);
  for(let z=1;z<=18;z++)grid[z][8]='.';
  for(let c=5;c<=8;c++)grid[3][c]='.';
  for(let c=8;c<=11;c++)grid[3][c]='.';
  for(let c=5;c<=8;c++)grid[15][c]='.';
  for(let c=8;c<=11;c++)grid[15][c]='.';
  for(let c=5;c<=11;c++){grid[9][c]='.';grid[10][c]='.'}
  grid[18][8]='.';
  // Enclosed yard and the main gate beyond the school exit.
  for(let z=19;z<=22;z++)for(let c=6;c<=10;c++)grid[z][c]='.';
  if(wing==='Middle'){grid[7][8]='.';grid[11][8]='.';grid[9][7]='.'}
  if(wing==='Primary'){grid[7][8]='.';grid[11][8]='.';grid[10][9]='.'}
}

function clearWorld(){
  for(const obj of [...worldGroup.children]){worldGroup.remove(obj);obj.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)if(m!==wallMat&&m!==floorMat&&m!==ceilMat)m.dispose()}})}
  keys=[];gateParts=[];teachers=[];doors=[];students.length=0;practicalLights.length=0;fans.length=0;furniture.length=0;wallBoxes.length=0;noise=null;smoke=null;
}

function addWallSection(x,z,width,depth,collide=true){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,3.5,depth),wallMat);
 mesh.position.set(x,1.68,z);mesh.castShadow=true;mesh.receiveShadow=true;worldGroup.add(mesh);
 if(collide)wallBoxes.push({x,z,halfX:width/2,halfZ:depth/2});
}
function addClassroomPartition(boundaryC,firstR,lastR,doorR){
 const x=world(boundaryC,doorR).x,doorWidth=T*.76,sideWidth=(T-doorWidth)/2,doorZ=world(boundaryC,doorR).z;
 for(let r=firstR;r<=lastR;r++){
  const z=world(boundaryC,r).z;
  if(r!==doorR){addWallSection(x,z,.18,T);continue}
  for(const side of [-1,1])addWallSection(x,doorZ+side*(doorWidth/2+sideWidth/2),.18,sideWidth);
  const header=new THREE.Mesh(new THREE.BoxGeometry(.18,3.5-2.45,doorWidth),wallMat);
  header.position.set(x,(3.5+2.45)/2,doorZ);header.castShadow=true;header.receiveShadow=true;worldGroup.add(header);
 }
}
function addExitPartition(x,z){
 const doorWidth=T*.76,sideWidth=(T-doorWidth)/2;
 for(const side of [-1,1])addWallSection(x+side*(doorWidth/2+sideWidth/2),z,sideWidth,.18);
 const header=new THREE.Mesh(new THREE.BoxGeometry(doorWidth,3.5-2.45,.18),wallMat);
 header.position.set(x,(3.5+2.45)/2,z);header.castShadow=true;header.receiveShadow=true;worldGroup.add(header);
}
function addDoor(c,r,orientation='x',kind='room'){
 const p=world(c,r),g=new THREE.Group(),leaf=new THREE.Group();
  const wood=new THREE.MeshStandardMaterial({color:kind==='exit'?0x28363b:0x303b43,metalness:.22,roughness:.62});
  const dark=new THREE.MeshStandardMaterial({color:0x1c2931,roughness:.76});
  const brass=new THREE.MeshStandardMaterial({color:0x8c9ca0,metalness:.62,roughness:.32});
 const w=T*.76,h=2.45;
 leaf.position.set(orientation==='x'?-w/2:0,0,orientation==='x'?0:-w/2);
 const leafDetails=new THREE.Group();leafDetails.position.set(orientation==='x'?w/2:0,0,orientation==='x'?0:w/2);leaf.add(leafDetails);
 const panel=new THREE.Mesh(new THREE.BoxGeometry(orientation==='x'?w:.13,h,orientation==='x'?.13:w),wood);
 panel.position.y=h/2;panel.castShadow=true;panel.receiveShadow=true;leafDetails.add(panel);
 const inset=new THREE.Mesh(new THREE.BoxGeometry(orientation==='x'?w*.72:.035,h*.68,orientation==='x'?.035:w*.72),dark);
 inset.position.set(orientation==='x'?0:.082,h*.51,orientation==='x'?.082:0);leafDetails.add(inset);
  const glassMat=new THREE.MeshStandardMaterial({color:0x9fc4c6,roughness:.28,metalness:.08,transparent:true,opacity:.72,emissive:0x263f42,emissiveIntensity:.16});
  // Twin narrow wired-glass windows and a center seam give this a school-hall look.
  for(const side of [-1,1]){
   const frameBox=new THREE.Mesh(new THREE.BoxGeometry(orientation==='x'?.59:.06,.78,orientation==='x'?.06:.59),brass);
   frameBox.position.set(orientation==='x'?side*w*.23:.091,1.91,orientation==='x'?.091:side*w*.23);leafDetails.add(frameBox);
   const glass=new THREE.Mesh(new THREE.BoxGeometry(orientation==='x'?.46:.035,.64,orientation==='x'?.035:.46),glassMat);
   glass.position.set(orientation==='x'?side*w*.23:.13,1.91,orientation==='x'?.13:side*w*.23);glass.castShadow=false;leafDetails.add(glass);
   const pushBar=new THREE.Mesh(new THREE.BoxGeometry(orientation==='x'?.39:.045,.055,orientation==='x'?.045:.39),brass);
   pushBar.position.set(orientation==='x'?side*w*.22:.145,1.08,orientation==='x'?.145:side*w*.22);leafDetails.add(pushBar);
  }
  const seam=new THREE.Mesh(new THREE.BoxGeometry(orientation==='x'?.035:.14,2.05,orientation==='x'?.14:.035),dark);seam.position.set(orientation==='x'?0:.105,1.15,orientation==='x'?.105:0);leafDetails.add(seam);
  const plate=new THREE.Mesh(new THREE.BoxGeometry(orientation==='x'?.58:.045,.25,orientation==='x'?.045:.58),new THREE.MeshStandardMaterial({color:kind==='exit'?0x315e4b:0x243c4d,metalness:.42,roughness:.48,emissive:kind==='exit'?0x10291c:0x101b20,emissiveIntensity:.35}));plate.position.set(orientation==='x'?0:.105,2.16,orientation==='x'?-.105:0);leafDetails.add(plate);
  const frame=new THREE.MeshStandardMaterial({color:0x243b4b,roughness:.72,metalness:.16});
 for(const side of [-1,1]){const post=new THREE.Mesh(new THREE.BoxGeometry(orientation==='x'?.16:.2,2.62,orientation==='x'?.2:.16),frame);post.position.set(orientation==='x'?side*w/2:0,1.31,orientation==='x'?0:side*w/2);g.add(post)}
 const top=new THREE.Mesh(new THREE.BoxGeometry(orientation==='x'?w+.16:.2,.16,orientation==='x'?.2:w+.16),frame);top.position.y=2.62;g.add(top);
 g.add(leaf);g.position.set(p.x,0,p.z);worldGroup.add(g);
 const door={c,r,x:p.x,z:p.z,orientation,kind,group:g,leaf,angle:0,open:false};doors.push(door);return door
}
function updateDoors(dt){
 for(const d of doors){const want=d.open?1.48:0;d.angle+=Math.sign(want-d.angle)*Math.min(Math.abs(want-d.angle),dt*2.3);d.leaf.rotation.y=d.orientation==='x'?d.angle:-d.angle}
}
function nearestDoor(){
 let best=null,bestScore=Infinity;
 const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
 for(const d of doors){const dx=d.x-player.x,dz=d.z-player.z,dist=Math.hypot(dx,dz);if(dist>2.45||dist<.05)continue;const facing=(dx*fx+dz*fz)/dist;if(facing<.28)continue;const score=dist+(1-facing)*.75;if(score<bestScore){best=d;bestScore=score}}
 return best
}

function addTable(c,r,accent){
  const p=world(c,r), group=new THREE.Group();
  const wood=new THREE.MeshStandardMaterial({color:accent,roughness:.7});
  const top=new THREE.Mesh(new THREE.BoxGeometry(1.55,.16,.92),wood);top.position.y=.82;top.castShadow=true;top.receiveShadow=true;group.add(top);
  for(const dx of [-.62,.62])for(const dz of [-.34,.34]){
   const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,.72,.1),new THREE.MeshStandardMaterial({color:0x30373a}));
   leg.position.set(dx,.37,dz);group.add(leg);
  }
  group.position.set(p.x,0,p.z);worldGroup.add(group);furniture.push({x:p.x,z:p.z,r:.62});
}
function makeBench(c,r){
 const p=world(c,r),g=new THREE.Group();
 const wood=new THREE.MeshStandardMaterial({color:0x93683f,roughness:.68}),edge=new THREE.MeshStandardMaterial({color:0x5e4933,roughness:.82}),metal=new THREE.MeshStandardMaterial({color:0x30383a,metalness:.38,roughness:.5});
 const seat=new THREE.Mesh(new THREE.BoxGeometry(1.42,.12,.38),wood);seat.position.y=.48;seat.castShadow=true;seat.receiveShadow=true;g.add(seat);
 for(const x of [-.68,.68])for(const z of [-.13,.13]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.09,.48,.09),metal);leg.position.set(x,.25,z);leg.castShadow=true;g.add(leg)}
 const back=new THREE.Mesh(new THREE.BoxGeometry(1.42,.42,.1),wood);back.position.set(0,.75,.2);back.castShadow=true;g.add(back);
 g.position.set(p.x,0,p.z+.4);worldGroup.add(g)
}
function makeStudent(c,r,index){
 const p=world(c,r),g=new THREE.Group(),arms=[],legs=[],uniforms=[0x24455d,0x6d4140,0x3d5748,0x33415b],uniform=new THREE.MeshStandardMaterial({color:uniforms[index%uniforms.length],roughness:.78}),skin=new THREE.MeshStandardMaterial({color:[0xb98262,0xc89776,0xae7658,0xc08a69][index%4],roughness:.9}),hair=new THREE.MeshStandardMaterial({color:[0x211c1a,0x30231f,0x171b1b][index%3],roughness:.95}),dark=new THREE.MeshStandardMaterial({color:0x1e2426,roughness:.85}),shirt=new THREE.MeshStandardMaterial({color:0xe9e3d6,roughness:.8});
 const hips=new THREE.Mesh(new THREE.BoxGeometry(.38,.16,.35),dark);hips.position.set(0,.56,-.02);g.add(hips);
 const torso=new THREE.Mesh(new THREE.BoxGeometry(.52,.58,.34),uniform);torso.position.set(0,.94,0);torso.castShadow=true;g.add(torso);
 const collar=new THREE.Mesh(new THREE.BoxGeometry(.25,.1,.035),shirt);collar.position.set(0,1.18,-.185);g.add(collar);
 for(const s of [-1,1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.16,.14,.52),dark);leg.position.set(s*.12,.49,-.32);g.add(leg);legs.push(leg);const shoe=new THREE.Mesh(new THREE.BoxGeometry(.17,.1,.24),new THREE.MeshStandardMaterial({color:0x252526,roughness:.75}));shoe.position.set(s*.12,.43,-.56);g.add(shoe);const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.35,4,8),uniform);arm.position.set(s*.24,.82,-.13);arm.rotation.x=-.72;arm.rotation.z=s*.14;g.add(arm);arms.push(arm);const hand=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),skin);hand.position.set(s*.22,.68,-.38);g.add(hand)}
 const neck=new THREE.Mesh(new THREE.CylinderGeometry(.09,.1,.18,12),skin);neck.position.y=1.28;g.add(neck);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.235,20,16),skin);head.position.set(0,1.48,-.015);head.castShadow=true;g.add(head);
 const cap=new THREE.Mesh(new THREE.SphereGeometry(.24,16,10,0,Math.PI*2,0,Math.PI*.62),hair);cap.position.set(0,1.56,.005);g.add(cap);
 for(const s of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),dark);eye.position.set(s*.078,1.49,-.228);g.add(eye)}
 const nose=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),skin);nose.position.set(0,1.445,-.24);g.add(nose);
 const book=new THREE.Mesh(new THREE.BoxGeometry(.36,.035,.25),new THREE.MeshStandardMaterial({color:index%2?0xd8b96e:0x91a59b,roughness:.7}));book.position.set(0,.68,-.47);g.add(book);
 g.position.set(p.x,0,p.z+.58);g.userData={index,arms,legs,gait:Math.random()*6};worldGroup.add(g);students.push(g)
}
function addClassroomBoard(c,r){
 const p=world(c,r),g=new THREE.Group(),frame=new THREE.MeshStandardMaterial({color:0x654a32,roughness:.82}),green=new THREE.MeshStandardMaterial({color:0x1e4b3d,roughness:.9});
 const outer=new THREE.Mesh(new THREE.BoxGeometry(2.55,1.35,.14),frame);outer.castShadow=true;g.add(outer);
 const panel=new THREE.Mesh(new THREE.BoxGeometry(2.36,1.16,.045),green);panel.position.z=.095;g.add(panel);
 const rail=new THREE.Mesh(new THREE.BoxGeometry(2.45,.08,.2),frame);rail.position.set(0,-.73,.08);g.add(rail);
 const chalkMat=new THREE.MeshStandardMaterial({color:0xe7e1cb,emissive:0x4b493e,emissiveIntensity:.12});
 for(let i=0;i<4;i++){const line=new THREE.Mesh(new THREE.BoxGeometry(.8+(i%2)*.45,.018,.012),chalkMat);line.position.set(-.35+i%2*.18,.34-i*.16,.125);g.add(line)}
 g.position.set(p.x,2.02,p.z-1.35);worldGroup.add(g)
}
function addSmartBoard(c,r){
 const p=world(c,r),frame=new THREE.MeshStandardMaterial({color:0x202a30,metalness:.38,roughness:.38}),screen=new THREE.MeshStandardMaterial({color:0x152c36,emissive:0x176077,emissiveIntensity:.72,roughness:.3});
 const g=new THREE.Group(),outer=new THREE.Mesh(new THREE.BoxGeometry(2.25,1.28,.13),frame),display=new THREE.Mesh(new THREE.BoxGeometry(2.08,1.1,.035),screen);
 outer.castShadow=true;g.add(outer);display.position.z=.085;g.add(display);
 const bar=new THREE.Mesh(new THREE.BoxGeometry(1.2,.045,.025),new THREE.MeshStandardMaterial({color:0x8deaff,emissive:0x2c95b2,emissiveIntensity:.8}));bar.position.set(-.2,.18,.11);g.add(bar);
 for(let i=0;i<3;i++){const line=new THREE.Mesh(new THREE.BoxGeometry(.58,.025,.02),new THREE.MeshStandardMaterial({color:i===0?0xffd58b:0xd9e6e6,emissive:0x25434a,emissiveIntensity:.35}));line.position.set(-.45,-.08-i*.13,.11);g.add(line)}
 g.position.set(p.x,2.02,p.z-1.35);worldGroup.add(g);
 const glow=new THREE.PointLight(0x4ac9ed,.48,5);glow.position.set(p.x,2.1,p.z-1.3);worldGroup.add(glow)
}
function addTeacherDesk(c,r){
 const p=world(c,r),g=new THREE.Group(),wood=new THREE.MeshStandardMaterial({color:0x67482f,roughness:.62}),dark=new THREE.MeshStandardMaterial({color:0x303639,metalness:.28,roughness:.52});
 const top=new THREE.Mesh(new THREE.BoxGeometry(2.05,.14,1.02),wood);top.position.y=.86;top.castShadow=true;top.receiveShadow=true;g.add(top);
 const modesty=new THREE.Mesh(new THREE.BoxGeometry(1.35,.54,.09),dark);modesty.position.set(0,.53,.34);g.add(modesty);
 for(const x of [-.87,.87])for(const z of [-.38,.38]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.09,.78,.09),dark);leg.position.set(x,.4,z);leg.castShadow=true;g.add(leg)}
 const book=new THREE.Mesh(new THREE.BoxGeometry(.34,.045,.24),new THREE.MeshStandardMaterial({color:0x9e5847,roughness:.8}));book.position.set(-.4,.96,-.14);g.add(book);
 g.position.set(p.x,0,p.z+.45);worldGroup.add(g);
}
function addScienceLab(c,r){
 const p=world(c,r),g=new THREE.Group(),cabinet=new THREE.MeshStandardMaterial({color:0x39464a,roughness:.7}),topMat=new THREE.MeshStandardMaterial({color:0xb9b5a7,roughness:.34}),glass=new THREE.MeshStandardMaterial({color:0x9fe4e8,transparent:true,opacity:.55,roughness:.12});
 const counter=new THREE.Mesh(new THREE.BoxGeometry(2.35,.16,.78),topMat);counter.position.set(0,.92,.25);counter.castShadow=true;counter.receiveShadow=true;g.add(counter);
 const base=new THREE.Mesh(new THREE.BoxGeometry(2.2,.82,.67),cabinet);base.position.set(0,.43,.25);g.add(base);
 for(let i=0;i<5;i++){const tube=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.42,10),glass);tube.position.set(-.78+i*.38,1.2,.2);g.add(tube);const liquid=new THREE.Mesh(new THREE.CylinderGeometry(.065,.08,.12,10),new THREE.MeshStandardMaterial({color:i%2?0x68ad95:0xd29b63,emissive:i%2?0x174c3d:0x593815,emissiveIntensity:.25}));liquid.position.set(-.78+i*.38,1.02,.2);g.add(liquid)}
 for(const x of [-.98,.98]){const stool=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.12,16),new THREE.MeshStandardMaterial({color:0x52636a,metalness:.35,roughness:.5}));stool.position.set(x,.58,1.05);g.add(stool)}
 g.position.set(p.x,0,p.z);worldGroup.add(g)
}
function addCorridorFixture(c,r,index){
 const p=world(c,r),body=new THREE.Mesh(new THREE.BoxGeometry(1.15,.06,.28),new THREE.MeshStandardMaterial({color:0xddd8c9,emissive:0xc5b68e,emissiveIntensity:.35,roughness:.45}));
 body.position.set(p.x,3.27,p.z);worldGroup.add(body);
 const lamp=new THREE.PointLight(index%2?0xffd5a0:0xc7deea,1.6,8,1.8);lamp.position.set(p.x,2.85,p.z);lamp.userData.baseIntensity=lamp.intensity;practicalLights.push(lamp);worldGroup.add(lamp)
}
function addClassroomLighting(c,r,index){
 const p=world(c,r),panelMat=new THREE.MeshStandardMaterial({color:0xfff3d7,emissive:0xffe9bc,emissiveIntensity:.8,roughness:.32}),frameMat=new THREE.MeshStandardMaterial({color:0xc3c4bf,metalness:.22,roughness:.56});
 for(const offset of [-1.25,1.25]){
  const frame=new THREE.Mesh(new THREE.BoxGeometry(2.05,.045,.78),frameMat);frame.position.set(p.x+offset,3.39,p.z);worldGroup.add(frame);
  const panel=new THREE.Mesh(new THREE.BoxGeometry(1.86,.035,.59),panelMat);panel.position.set(p.x+offset,3.36,p.z);worldGroup.add(panel);
 }
 const lamp=new THREE.PointLight(index%2?0xffe5bb:0xe0edff,1.15,12,1.7);lamp.position.set(p.x,2.95,p.z);lamp.userData.baseIntensity=lamp.intensity;practicalLights.push(lamp);worldGroup.add(lamp)
}
function addFan(c,r){
 const p=world(c,r),assembly=new THREE.Group(),motor=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,.22,12),new THREE.MeshStandardMaterial({color:0x465052,metalness:.58,roughness:.48}));
 motor.position.y=3.12;assembly.add(motor);
 const rotor=new THREE.Group();rotor.position.y=3.02;
 for(let i=0;i<3;i++){const blade=new THREE.Mesh(new THREE.BoxGeometry(.18,.045,1.18),new THREE.MeshStandardMaterial({color:0x747d78,metalness:.25,roughness:.6}));blade.position.z=.67;blade.rotation.y=i*Math.PI*2/3;rotor.add(blade)}
 assembly.add(rotor);assembly.position.set(p.x,0,p.z);worldGroup.add(assembly);fans.push(rotor)
}
function makeTeacher(c,r,accent){
 const p=world(c,r),g=new THREE.Group(),teacherIndex=teachers.length;
 const legs=[];
 const uniform=new THREE.MeshStandardMaterial({color:accent,roughness:.68}),skin=new THREE.MeshStandardMaterial({color:[0xc49a7c,0xb78366,0xd0a589,0x9e6f59][teacherIndex%4],roughness:.88}),hair=new THREE.MeshStandardMaterial({color:[0x25211f,0x171819,0x382920,0x2d2826][teacherIndex%4],roughness:.96}),trouser=new THREE.MeshStandardMaterial({color:0x242a2c,roughness:.82}),shirt=new THREE.MeshStandardMaterial({color:0xe5ddcd,roughness:.8}),shoeMat=new THREE.MeshStandardMaterial({color:0x17191a,roughness:.68});
 const coat=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.52,5,12),uniform);coat.position.y=1.16;coat.castShadow=true;coat.receiveShadow=true;g.add(coat);
 const shirtFront=new THREE.Mesh(new THREE.BoxGeometry(.27,.72,.035),shirt);shirtFront.position.set(0,1.18,-.336);g.add(shirtFront);
 const lapelMat=new THREE.MeshStandardMaterial({color:accent,roughness:.76});for(const s of [-1,1]){const lapel=new THREE.Mesh(new THREE.BoxGeometry(.12,.48,.055),lapelMat);lapel.position.set(s*.105,1.35,-.365);lapel.rotation.z=s*.24;g.add(lapel)}
 const tie=new THREE.Mesh(new THREE.ConeGeometry(.075,.42,4),new THREE.MeshStandardMaterial({color:0x9d694c,roughness:.75}));tie.position.set(0,1.2,-.375);tie.rotation.x=-Math.PI/2;g.add(tie);
 const neck=new THREE.Mesh(new THREE.CylinderGeometry(.12,.13,.22,12),skin);neck.position.y=1.78;g.add(neck);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.285,24,18),skin);head.position.set(0,2.02,0);head.castShadow=true;g.add(head);
 const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.3,20,12,0,Math.PI*2,0,Math.PI*.58),hair);hairCap.position.set(0,2.105,.015);g.add(hairCap);
 const hairBack=new THREE.Mesh(new THREE.SphereGeometry(.23,16,12),hair);hairBack.scale.set(1,teacherIndex%2===0?1.12:.58,.68);hairBack.position.set(0,1.96,.12);g.add(hairBack);
 for(const s of [-1,1]){if(teacherIndex%2===0){const lock=new THREE.Mesh(new THREE.CapsuleGeometry(.055,.2,3,8),hair);lock.position.set(s*.255,2.0,.015);lock.rotation.z=s*.16;g.add(lock)}
  const eyeWhite=new THREE.Mesh(new THREE.SphereGeometry(.052,10,8),shirt);eyeWhite.position.set(s*.105,2.035,-.255);g.add(eyeWhite);
  const eye=new THREE.Mesh(new THREE.SphereGeometry(.027,8,6),new THREE.MeshStandardMaterial({color:0x282322}));eye.position.set(s*.105,2.035,-.301);g.add(eye);
  const brow=new THREE.Mesh(new THREE.BoxGeometry(.12,.025,.025),hair);brow.position.set(s*.105,2.11,-.273);g.add(brow);
  const legPivot=new THREE.Group();legPivot.position.set(s*.17,.82,0);
  const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.58,4,10),trouser);leg.position.y=-.33;leg.castShadow=true;legPivot.add(leg);
  const shoe=new THREE.Mesh(new THREE.BoxGeometry(.24,.13,.4),shoeMat);shoe.position.set(0,-.69,-.09);legPivot.add(shoe);g.add(legPivot);legs.push(legPivot)
 }
 if(teacherIndex%3===1){const frame=new THREE.MeshStandardMaterial({color:0x3b3027,metalness:.35,roughness:.42});for(const s of [-1,1]){const lens=new THREE.Mesh(new THREE.TorusGeometry(.068,.012,6,16),frame);lens.position.set(s*.105,2.035,-.286);g.add(lens)}const bridge=new THREE.Mesh(new THREE.BoxGeometry(.07,.014,.014),frame);bridge.position.set(0,2.035,-.291);g.add(bridge)} const nose=new THREE.Mesh(new THREE.SphereGeometry(.05,10,8),skin);nose.position.set(0,1.99,-.29);g.add(nose);
 const mouth=new THREE.Mesh(new THREE.BoxGeometry(.11,.018,.02),new THREE.MeshStandardMaterial({color:0x70463e}));mouth.position.set(0,1.91,-.275);g.add(mouth);
 const arms=[];for(const s of [-1,1]){const pivot=new THREE.Group();pivot.position.set(s*.39,1.55,0);const upper=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.42,4,10),uniform);upper.position.y=-.3;upper.castShadow=true;pivot.add(upper);const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,.11,10),shirt);cuff.position.y=-.57;pivot.add(cuff);const hand=new THREE.Mesh(new THREE.SphereGeometry(.105,12,10),skin);hand.position.y=-.68;pivot.add(hand);g.add(pivot);arms.push(pivot)}
 const lanyard=new THREE.Mesh(new THREE.TorusGeometry(.12,.018,6,24,Math.PI),new THREE.MeshStandardMaterial({color:0xd0b05f,metalness:.2}));lanyard.position.set(0,1.49,-.36);lanyard.rotation.x=Math.PI/2;g.add(lanyard);
 const badge=new THREE.Mesh(new THREE.BoxGeometry(.16,.2,.035),new THREE.MeshStandardMaterial({color:0xd8c795,metalness:.25,roughness:.5}));badge.position.set(.22,1.28,-.37);g.add(badge);
 const corridor=Math.abs(c-8)<.65;
 const route=corridor?[[8,2],[8,7],[8,11],[8,17]]:c<8?[[2,2],[4,4],[4,14],[2,16]]:[[12,2],[14,4],[14,14],[12,16]];
 g.position.set(p.x,0,p.z);g.userData={c,r,mode:'patrol',target:null,wait:.3+Math.random(),routeTimer:0,route,routeIndex:0,spotted:false,lastKnown:{x:p.x,z:p.z},searchTime:0,arms,legs,gait:Math.random()*6};worldGroup.add(g);teachers.push(g)
}
function addKey(c,r,index){
  const p=world(c,r),g=new THREE.Group();
  const gold=new THREE.MeshStandardMaterial({color:0xffce69,emissive:0xb87919,emissiveIntensity:1.2,metalness:.72,roughness:.24});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.23,.07,8,20),gold);ring.position.y=.75;g.add(ring);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.52,10),gold);shaft.rotation.z=Math.PI/2;shaft.position.set(.31,.75,0);g.add(shaft);
  const tooth=new THREE.Mesh(new THREE.BoxGeometry(.17,.11,.12),gold);tooth.position.set(.5,.62,0);g.add(tooth);
  const glow=new THREE.PointLight(0xffc454,1.5,4);glow.position.y=1;g.add(glow);
  g.position.set(p.x,0,p.z);g.userData={taken:false,index};worldGroup.add(g);keys.push(g);
}
function addGatePart(c,r,index){
 const p=world(c,r),g=new THREE.Group(),gold=new THREE.MeshStandardMaterial({color:0xe8bd62,metalness:.68,roughness:.25,emissive:0x704411,emissiveIntensity:.45}),steel=new THREE.MeshStandardMaterial({color:0x75828a,metalness:.72,roughness:.3});
 if(index===0){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.3,.075,10,24),gold);wheel.position.y=.42;g.add(wheel);const hub=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.16,12),steel);hub.rotation.x=Math.PI/2;hub.position.y=.42;g.add(hub)}
 else if(index===1){const body=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.62,12),steel);body.position.y=.4;g.add(body);const cap=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.08,12),gold);cap.position.y=.72;g.add(cap);const glow=new THREE.PointLight(0x8ad9d1,.65,3);glow.position.y=.5;g.add(glow)}
 else{const ring=new THREE.Mesh(new THREE.TorusGeometry(.22,.065,8,20),gold);ring.position.y=.47;g.add(ring);const shaft=new THREE.Mesh(new THREE.BoxGeometry(.42,.08,.08),gold);shaft.position.set(.28,.47,0);g.add(shaft);const tooth=new THREE.Mesh(new THREE.BoxGeometry(.12,.18,.1),gold);tooth.position.set(.45,.38,0);g.add(tooth)}
 const glow=new THREE.PointLight(0xffc85f,.9,3.2);glow.position.y=.85;g.add(glow);g.position.set(p.x,0,p.z);g.userData={index,taken:false};worldGroup.add(g);gateParts.push(g)
}
function addYardFence(x,z,length,alongZ=true){
 const fence=new THREE.Group(),iron=new THREE.MeshStandardMaterial({color:0x343d40,metalness:.58,roughness:.48}),postMat=new THREE.MeshStandardMaterial({color:0x596363,metalness:.52,roughness:.45});
 const bar=new THREE.Mesh(new THREE.BoxGeometry(alongZ?.1:length,1.7,alongZ?length:.1),iron);bar.position.y=1.05;fence.add(bar);
 for(let y=0;y<2;y++){const rail=new THREE.Mesh(new THREE.BoxGeometry(alongZ?.18:length,.12,alongZ?length:.18),postMat);rail.position.y=.55+y*.75;fence.add(rail)}
 const n=Math.max(2,Math.ceil(length/1.4));for(let i=0;i<=n;i++){const t=-length/2+length*i/n,post=new THREE.Mesh(new THREE.BoxGeometry(.13,2,.13),postMat);post.position.set(alongZ?0:t,1,alongZ?t:0);post.castShadow=true;fence.add(post)}
 fence.position.set(x,0,z);worldGroup.add(fence)
}
function buildYard(){
 const left=world(6,20),right=world(10,20),south=world(8,22),fenceZ=south.z+T/2,iron=new THREE.MeshStandardMaterial({color:0x273337,metalness:.6,roughness:.42}),stone=new THREE.MeshStandardMaterial({color:0x77776c,roughness:.9});
 addYardFence(left.x-T/2,world(6,20.5).z,12,true);addYardFence(right.x+T/2,world(10,20.5).z,12,true);
 const yardLeft=left.x-T/2,yardRight=right.x+T/2,gateHalf=1.16,leftEnd=south.x-gateHalf,rightStart=south.x+gateHalf;
 addYardFence((yardLeft+leftEnd)/2,fenceZ,leftEnd-yardLeft,false);addYardFence((rightStart+yardRight)/2,fenceZ,yardRight-rightStart,false);
 gatePos={x:south.x,z:fenceZ};
 const gate=new THREE.Group(),postMat=new THREE.MeshStandardMaterial({color:0x3c484b,metalness:.65,roughness:.4});
 for(const x of [-1.1,1.1]){const post=new THREE.Mesh(new THREE.BoxGeometry(.18,2.5,.22),postMat);post.position.set(x,1.25,0);post.castShadow=true;gate.add(post)}
 for(let side of [-1,1]){const leaf=new THREE.Group(),w=1.08;for(const y of [.25,1.1,1.95]){const rail=new THREE.Mesh(new THREE.BoxGeometry(w,.09,.09),iron);rail.position.set(side*w/2,y,0);leaf.add(rail)}for(let x=0;x<=3;x++){const bar=new THREE.Mesh(new THREE.BoxGeometry(.07,2,.07),iron);bar.position.set(side*x*w/3,1,0);leaf.add(bar)}gate.add(leaf);gate.userData.leaves??=[];gate.userData.leaves.push(leaf)}
 gate.position.set(south.x,0,fenceZ);worldGroup.add(gate);gate.userData.isOpen=false;worldGroup.userData.mainGate=gate;
 const sign=new THREE.Mesh(new THREE.BoxGeometry(1.5,.4,.08),new THREE.MeshStandardMaterial({color:0x243b40,emissive:0x152f32,emissiveIntensity:.4}));sign.position.set(south.x,2.35,fenceZ-.15);worldGroup.add(sign);
 const lettering=new THREE.Mesh(new THREE.BoxGeometry(.95,.035,.025),new THREE.MeshStandardMaterial({color:0xe0c78f,emissive:0x68532c,emissiveIntensity:.4}));lettering.position.set(south.x,2.38,fenceZ-.205);worldGroup.add(lettering);
 // A marked stone route, low shrubs and warm yard lamps make the outdoor section readable.
 for(let r=19;r<=21;r++){const p=world(8,r),tile=new THREE.Mesh(new THREE.BoxGeometry(1.55,.06,2.35),stone);tile.position.set(p.x,.015,p.z);tile.receiveShadow=true;worldGroup.add(tile)}
 for(const q of [[6,19],[10,19],[6,21],[10,21]]){const p=world(q[0],q[1]),bush=new THREE.Mesh(new THREE.IcosahedronGeometry(.62,1),new THREE.MeshStandardMaterial({color:0x2e4837,roughness:.96}));bush.position.set(p.x,.47,p.z);bush.scale.set(1,.75,1);bush.castShadow=true;worldGroup.add(bush)}
 for(const q of [[7,19],[9,21]]){const p=world(q[0],q[1]),pole=new THREE.Mesh(new THREE.CylinderGeometry(.07,.1,3.1,10),postMat);pole.position.set(p.x,1.55,p.z);worldGroup.add(pole);const bulb=new THREE.Mesh(new THREE.SphereGeometry(.16,12,10),new THREE.MeshStandardMaterial({color:0xffd99a,emissive:0xffbd69,emissiveIntensity:1.25}));bulb.position.set(p.x,3.15,p.z);worldGroup.add(bulb);const l=new THREE.PointLight(0xffc88b,1.35,9,1.6);l.position.copy(bulb.position);l.userData.baseIntensity=l.intensity;practicalLights.push(l);worldGroup.add(l)}
}
function buildWorld(wing){
  clearWorld();buildGrid(wing);
  const accent=colors[wing], floors=[],yardFloors=[],walls=[],ceilings=[];
  for(let r=0;r<H;r++)for(let c=0;c<W;c++){
   const p=world(c,r);
   if(floorAt(c,r)){if(r>=19)yardFloors.push(p);else{floors.push(p);ceilings.push(p)}}
   else if(!(r>=19&&r<=22&&(c===5||c===11)))walls.push(p);
  }
  const flo=new THREE.InstancedMesh(new THREE.BoxGeometry(T,.16,T),floorMat,floors.length);
  const wal=new THREE.InstancedMesh(new THREE.BoxGeometry(T,3.5,T),wallMat,walls.length);
  const cei=new THREE.InstancedMesh(new THREE.BoxGeometry(T,.14,T),ceilMat,ceilings.length);
  const lawnMat=new THREE.MeshStandardMaterial({color:0x59644a,roughness:.98});
  const lawn=new THREE.InstancedMesh(new THREE.BoxGeometry(T,.16,T),lawnMat,yardFloors.length);
  const dummy=new THREE.Object3D();
  floors.forEach((p,i)=>{dummy.position.set(p.x,-.08,p.z);dummy.updateMatrix();flo.setMatrixAt(i,dummy.matrix)});
  walls.forEach((p,i)=>{dummy.position.set(p.x,1.68,p.z);dummy.updateMatrix();wal.setMatrixAt(i,dummy.matrix)});
  ceilings.forEach((p,i)=>{dummy.position.set(p.x,3.5,p.z);dummy.updateMatrix();cei.setMatrixAt(i,dummy.matrix)});
  yardFloors.forEach((p,i)=>{dummy.position.set(p.x,-.08,p.z);dummy.updateMatrix();lawn.setMatrixAt(i,dummy.matrix)});
  flo.receiveShadow=true;lawn.receiveShadow=true;wal.castShadow=true;wal.receiveShadow=true;worldGroup.add(flo,lawn,wal,cei);
  const trimMat=new THREE.MeshStandardMaterial({color:accent,metalness:.15,roughness:.55,emissive:accent,emissiveIntensity:.08});
  for(let r=3;r<=17;r+=2){const p=world(8,r),stripe=new THREE.Mesh(new THREE.BoxGeometry(.12,.025,1.65),trimMat);stripe.position.set(p.x,.015,p.z);worldGroup.add(stripe)}
  // Broad, bright classrooms with neat desk rows, a teacher's desk and ceiling panels.
  let deskNo=0;
  const rooms=[[1,1],[11,1],[1,13],[11,13]];
  for(const [x0,z0] of rooms){
   if(x0===11&&z0===13)continue;
   for(const x of [x0+1.2,x0+2.5,x0+3.8])for(const z of [z0+1.15,z0+2.1,z0+3.05,z0+4]){
     addTable(x,z,deskNo%2?0x896846:0x775334);makeBench(x,z);makeStudent(x,z,deskNo++);
    }
    addTeacherDesk(x0+2.5,z0+.7);
    addClassroomLighting(x0+2.5,z0+2.5,deskNo);
   }
   addClassroomBoard(3,1);addSmartBoard(13,1);addSmartBoard(3,13);addScienceLab(13,15.4);
   for(const q of [[3,3],[13,3],[3,15],[13,15]])addFan(q[0],q[1]);
   // The science room has its own bright ceiling panels too.
   addClassroomLighting(13,15,4);
   for(const r of [2,5,8,11,14,17])addCorridorFixture(8,r,r);
   // Classroom entries open onto the cross hall; the exit opens into the yard.
   addClassroomPartition(5.5,1,5,3);addClassroomPartition(10.5,1,5,3);
   addClassroomPartition(5.5,13,17,15);addClassroomPartition(10.5,13,17,15);
   addDoor(5.5,3,'z','room');addDoor(10.5,3,'z','room');addDoor(5.5,15,'z','room');addDoor(10.5,15,'z','room');
   const ep=world(8,18.5);exitPos=ep;addExitPartition(ep.x,ep.z);addDoor(8,18.5,'x','exit');
   const exitSign=new THREE.Mesh(new THREE.BoxGeometry(1.05,.32,.07),new THREE.MeshStandardMaterial({color:0x48bb87,emissive:0x0b5135,emissiveIntensity:1.2}));exitSign.position.set(ep.x,2.25,ep.z-.4);worldGroup.add(exitSign);
   // School keys unlock the outer door; three separate parts release the main gate.
   addKey(1.35,4.8,0);addKey(14.65,4.8,1);addKey(1.35,16.2,2);
   addGatePart(6.8,20.1,0);addGatePart(9.2,20.5,1);addGatePart(8.8,21.5,2);
   // Four staff patrols total: two hall monitors and two inside classrooms.
   makeTeacher(8,4,0x29394a);makeTeacher(8,13,0x3e3034);
   makeTeacher(3.4,2.5,0x344c59);makeTeacher(13.3,15.5,0x51473d);
   buildYard();
   const sp=world(1.25,1.35);player.x=sp.x;player.z=sp.z;player.yaw=0;player.pitch=0;
  camera.position.set(player.x,1.62,player.z);
  scene.background.set(wing==='Primary'?0x161412:0x111416);
  scene.fog.color.set(wing==='Primary'?0x161412:0x111416);
  $('#wingLabel').textContent=wing+' Wing';$('#mapWing').textContent=wing.toUpperCase();drawMiniMap();
}
function isBlocked(x,z){
  const q=cell(x,z);if(!floorAt(q.c,q.r))return true;
  // Keep collision away from the center lines of solid walls.
  for(const w of wallBoxes)if(Math.abs(x-w.x)<w.halfX+.22&&Math.abs(z-w.z)<w.halfZ+.22)return true;
  for(const f of furniture){const dx=x-f.x,dz=z-f.z;if(dx*dx+dz*dz<f.r*f.r)return true}
  for(const d of doors)if(d.angle<.85&&Math.hypot(x-d.x,z-d.z)<1.4)return true;
  if(outside&&gatePos&&worldGroup.userData.mainGate?.userData.isOpen!==true&&Math.abs(z-gatePos.z)<.55&&Math.abs(x-gatePos.x)<7.4)return true;
  return false;
}
function segmentHitsWall(x1,z1,x2,z2,wall){
  let enter=0,leave=1;
  const dx=x2-x1,dz=z2-z1;
  for(const [origin,delta,min,max] of [[x1,dx,wall.x-wall.halfX,wall.x+wall.halfX],[z1,dz,wall.z-wall.halfZ,wall.z+wall.halfZ]]){
   if(Math.abs(delta)<1e-8){if(origin<min||origin>max)return false;continue}
   let a=(min-origin)/delta,b=(max-origin)/delta;if(a>b)[a,b]=[b,a];
   enter=Math.max(enter,a);leave=Math.min(leave,b);if(enter>leave)return false;
  }
  return leave>=0&&enter<=1;
}
function clearPath(x1,z1,x2,z2){
  for(const wall of wallBoxes)if(segmentHitsWall(x1,z1,x2,z2,wall))return false;
  const d=Math.hypot(x2-x1,z2-z1),steps=Math.ceil(d/.45);
  for(let i=1;i<steps;i++){const t=i/steps,x=x1+(x2-x1)*t,z=z1+(z2-z1)*t,q=cell(x,z);if(!floorAt(q.c,q.r))return false;for(const door of doors)if(door.angle<.85&&Math.hypot(x-door.x,z-door.z)<.72)return false}
  return true;
}
function bfsStep(from,to){
  const a=cell(from.x,from.z),b=cell(to.x,to.z),start=a.r+','+a.c,goal=b.r+','+b.c;
  if(start===goal)return to;
  const queue=[[a.c,a.r]],prev=new Map([[start,null]]);
  for(let i=0;i<queue.length;i++){
   const [c,r]=queue[i];if(c===b.c&&r===b.r)break;
   for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nc=c+dc,nr=r+dr,k=nr+','+nc;
    if(floorAt(nc,nr)&&!prev.has(k)){prev.set(k,r+','+c);queue.push([nc,nr])}
   }
  }
  let k=goal;if(!prev.has(k))return from;
  while(prev.get(k)&&prev.get(k)!==start)k=prev.get(k);
  const bits=k.split(',').map(Number),p=world(bits[1],bits[0]);return p;
}
function playTone(freq=500,duration=.09,type='sine',gain=.035){
 try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(gain,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration)}catch(e){}
}
function say(text,ms=1800){const h=$('#hint');h.textContent=text;h.style.opacity='1';clearTimeout(say.timer);say.timer=setTimeout(()=>h.style.opacity='0',ms)}
function collectNearby(){
 for(const k of keys)if(!k.userData.taken&&Math.hypot(player.x-k.position.x,player.z-k.position.z)<1.05){
  k.userData.taken=true;k.visible=false;found++;$('#keyLabel').textContent=found+' / 3';playTone(880,.18,'triangle',.06);
  say('Key found · '+found+' of 3');$('#message').textContent=found===3?'All keys found. Get to the green exit sign.':'Keep searching the classrooms.';
 }
 if(outside)for(const part of gateParts)if(!part.userData.taken&&Math.hypot(player.x-part.position.x,player.z-part.position.z)<1.12){
  part.userData.taken=true;part.visible=false;gateFound++;$('#keyLabel').textContent=gateFound+' / 3';playTone(780,.16,'triangle',.055);say(['Gate wheel found','Generator fuse found','Gate key found'][part.userData.index]);
 }
}
function interact(){
 if(!active)return;
 const door=nearestDoor();
 if(door){
  if(door.kind==='exit'&&!door.open&&found<3){say('The school exit is locked. Find all 3 classroom keys.',2300);return}
  door.open=!door.open;playTone(door.open?310:220,.12,'triangle',.045);say(door.kind==='exit'?(door.open?'Exit open. Get outside and reach the main gate.':'Exit closed.'):(door.open?'Door opened.':'Door closed.'));return
 }
 if(outside&&gatePos&&Math.hypot(player.x-gatePos.x,player.z-gatePos.z)<3){
  if(gateFound<3){say('Main gate needs 3 parts: wheel, fuse and gate key. '+gateFound+'/3 found.',2500);return}
  const gate=worldGroup.userData.mainGate;if(gate){gate.userData.isOpen=true;gate.userData.leaves.forEach((leaf,i)=>{leaf.rotation.y=i===0?-.95:.95})}
  active=false;$('#won').style.display='grid';playTone(660,.3,'triangle',.06);setTimeout(()=>playTone(880,.45,'triangle',.05),180);return
 }
 say(outside?'Search the yard for the wheel, fuse and gate key.':'Collect classroom keys and use E at doors. Q distracts; G throws smoke.',2300);
}
function jump(){if(!active||jumpCooldown>0)return;jumpTime=JUMP_DURATION;jumpCooldown=.88;playTone(245,.08,'triangle',.025)}
function distract(){
 if(!active)return;
 if(noiseCharges<1){say('No noisemakers left. Find a different route.');return}
 noiseCharges--;const dist=3.2;
 noise={x:player.x-Math.sin(player.yaw)*dist,z:player.z-Math.cos(player.yaw)*dist,life:8};
 const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.18,1),new THREE.MeshStandardMaterial({color:0x9bfff0,emissive:0x39ffd1,emissiveIntensity:2}));
 orb.position.set(noise.x,.35,noise.z);worldGroup.add(orb);noise.mesh=orb;
 playTone(950,.25,'sine',.04);say('Noisemaker tossed · '+noiseCharges+' left');
}
function throwSmoke(){
 if(!active)return;if(smokeCharges<1){say('No smoke pellets left.');return}smokeCharges--;
 const dist=2.7,x=player.x-Math.sin(player.yaw)*dist,z=player.z-Math.cos(player.yaw)*dist,g=new THREE.Group();
 const mat=new THREE.MeshStandardMaterial({color:0xb8c5c0,transparent:true,opacity:.22,roughness:1,depthWrite:false});
 for(let i=0;i<7;i++){const puff=new THREE.Mesh(new THREE.SphereGeometry(.48+Math.random()*.2,10,8),mat);puff.position.set((Math.random()-.5)*1.5,.5+Math.random()*1.4,(Math.random()-.5)*1.5);g.add(puff)}
 g.position.set(x,0,z);worldGroup.add(g);smoke={x,z,life:9,mesh:g};playTone(180,.22,'sawtooth',.025);say('Smoke pellet used · '+smokeCharges+' left')
}
function toggleLight(){flashlight.visible=!flashlight.visible;say(flashlight.visible?'Flashlight on':'Flashlight off');playTone(flashlight.visible?420:280,.07)}
function caught(){
 if(caughtLock>0)return;caughtLock=3;active=false;playTone(120,.45,'sawtooth',.07);
 crouching=false;updateCrouchUI();
 $('#alert').classList.add('show');$('#vignette').classList.add('danger');
 setTimeout(()=>{$('#alert').classList.remove('show');$('#vignette').classList.remove('danger');$('#caught').style.display='grid'},600);
  player.x=world(1.25,1.35).x;player.z=world(1.25,1.35).z;player.yaw=0;player.pitch=0;timeLeft=Math.max(0,timeLeft-20);elapsed=TOTAL_TIME-timeLeft;outside=false;
 for(const t of teachers){t.userData.mode='patrol';t.userData.spotted=false}
}
function updateCrouchUI(){
 const button=$('#crouchButton'),status=$('#stealthStatus');
 button?.classList.toggle('active',crouching);button?.setAttribute('aria-pressed',String(crouching));
 if(status){status.textContent=crouching?'CROUCHED · HARDER TO SPOT':'STANDING · VISIBLE';status.classList.toggle('crouched',crouching)}
}
function toggleCrouch(){
 if(!active)return;
 crouching=!crouching;
 if(crouching)touchRun=false;
 updateCrouchUI();playTone(crouching?190:280,.07,'triangle',.025);
 say(crouching?'Crouched · move slowly and stay out of sight.':'Standing · teachers can spot you more easily.');
}
function restartAfterTag(){if(timeLeft<=0){$('#caught').style.display='none';startGame();return}$('#caught').style.display='none';caughtLock=0;last=performance.now();active=true}
function startGame(){
  if(matchMedia('(pointer: coarse)').matches){
   if(document.documentElement.requestFullscreen&&!document.fullscreenElement)document.documentElement.requestFullscreen().catch(()=>{});
   if(screen.orientation?.lock)screen.orientation.lock('landscape').catch(()=>{});
  }
 difficulty=document.querySelector('.difficulty-btn.selected')?.dataset.difficulty||'normal';
 TOTAL_TIME=difficultySettings[difficulty].time;
 selected=$('.card.selected').dataset.wing;buildWorld(selected);found=0;gateFound=0;noiseCharges=4;smokeCharges=2;elapsed=0;timeLeft=TOTAL_TIME;blackoutRemaining=0;untilBlackout=55+Math.random()*15;lightsOn=true;lightPower=1;outside=false;active=true;held.clear();touchMove={x:0,y:0};touchRun=false;crouching=false;updateCrouchUI();player.stamina=100;caughtLock=0;
 jumpTime=0;jumpCooldown=0;
 $('#collectTitle').textContent='Classroom keys';$('#keyLabel').textContent='0 / 3';$('#timeLabel').textContent=String(Math.floor(TOTAL_TIME/60)).padStart(2,'0')+':'+String(TOTAL_TIME%60).padStart(2,'0');$('#dayLabel').textContent='DAY 1 / 2';
 $('.dialog h2').textContent='Back to class.';$('.dialog p').textContent='You were tagged. You keep the items you found, but lose precious time. Take another route, or use a distraction to slip away.';
 $('#message').textContent='Find three classroom keys. Listen for footsteps.';$('#menu').style.display='none';$('#caught').style.display='none';$('#won').style.display='none';$('#hud').style.display='block';game.style.display='block';
 last=performance.now();if(innerWidth>680)playTone(460,.12);
}
document.querySelectorAll('.card').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.card').forEach(c=>c.classList.remove('selected'));b.classList.add('selected')}));
document.querySelectorAll('.difficulty-btn').forEach(b=>b.addEventListener('click',()=>{
 document.querySelectorAll('.difficulty-btn').forEach(button=>{
  button.classList.remove('selected');button.setAttribute('aria-pressed','false');
 });
 b.classList.add('selected');b.setAttribute('aria-pressed','true');
}));
document.querySelectorAll('.quality-btn').forEach(b=>b.addEventListener('click',()=>setGraphicsMode(b.dataset.quality,true)));
$('#start').addEventListener('click',startGame);
$('#retry').addEventListener('click',restartAfterTag);
$('#again').addEventListener('click',()=>{active=false;$('#won').style.display='none';$('#hud').style.display='none';game.style.display='none';$('#menu').style.display='grid'});
document.addEventListener('keydown',e=>{
 if(['KeyW','KeyA','KeyS','KeyD','KeyG','KeyC','ShiftLeft','ShiftRight','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
 held.add(e.code);if(e.repeat)return;
 if(e.code==='KeyE')interact();if(e.code==='Space')jump();if(e.code==='KeyQ')distract();if(e.code==='KeyG')throwSmoke();if(e.code==='KeyF')toggleLight();if(e.code==='KeyC')toggleCrouch();
 if(e.code==='Escape'&&active)say('Drag the view to look around.');
});
document.addEventListener('keyup',e=>held.delete(e.code));
const stick=$('#stick'),nub=$('#nub');
function resetStick(){stickPointerId=null;touchMove={x:0,y:0};nub.style.transform='translate(0,0)'}
stick.addEventListener('pointerdown',e=>{e.preventDefault();stickPointerId=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e)});
stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointerId)moveStick(e)});
stick.addEventListener('pointerup',e=>{if(e.pointerId===stickPointerId)resetStick()});
stick.addEventListener('pointercancel',resetStick);
function moveStick(e){const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let x=e.clientX-cx,y=e.clientY-cy;const len=Math.hypot(x,y),max=38;if(len>max){x*=max/len;y*=max/len}touchMove={x:x/max,y:y/max};nub.style.transform='translate('+x+'px,'+y+'px)'}
renderer.domElement.addEventListener('pointerdown',e=>{if(innerWidth>680&&e.button!==0)return;lookPointer={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{if(lookPointer&&lookPointer.id===e.pointerId){const sensitivity=e.pointerType==='touch'?.010:.007;player.yaw-=(e.clientX-lookPointer.x)*sensitivity;player.pitch=Math.max(-1.1,Math.min(1.1,player.pitch-(e.clientY-lookPointer.y)*sensitivity*.86));lookPointer={id:e.pointerId,x:e.clientX,y:e.clientY}}});
renderer.domElement.addEventListener('pointerup',e=>{if(lookPointer?.id===e.pointerId)lookPointer=null});
renderer.domElement.addEventListener('pointercancel',()=>lookPointer=null);
document.querySelectorAll('.mbtn').forEach(b=>{
 b.addEventListener('pointerdown',e=>{e.preventDefault();const a=b.dataset.action;if(a==='run'&&!crouching)touchRun=true;if(a==='crouch')toggleCrouch();if(a==='jump')jump();if(a==='use')interact();if(a==='noise')distract();if(a==='smoke')throwSmoke();if(a==='light')toggleLight()});
 b.addEventListener('pointerup',()=>{if(b.dataset.action==='run')touchRun=false});
 b.addEventListener('pointerleave',()=>{if(b.dataset.action==='run')touchRun=false});
 b.addEventListener('pointercancel',()=>{if(b.dataset.action==='run')touchRun=false});
});

function updateTeachers(dt){
 const rules=difficultySettings[difficulty];
 for(const t of teachers){
  const u=t.userData,dx=player.x-t.position.x,dz=player.z-t.position.z,d=Math.hypot(dx,dz);
  const faceX=-Math.sin(t.rotation.y),faceZ=-Math.cos(t.rotation.y);
  const toward=(dx*faceX+dz*faceZ)/(d||1);
  const hiddenInSmoke=smoke&&smoke.life>0&&Math.hypot(player.x-smoke.x,player.z-smoke.z)<3.8;
  const visionRange=(lightsOn?rules.vision:rules.darkVision)*(crouching ? .58 : 1);
  const sees=!hiddenInSmoke&&d<visionRange&&toward>.32&&clearPath(t.position.x,t.position.z,player.x,player.z);
  const movingInput=held.has('KeyW')||held.has('KeyA')||held.has('KeyS')||held.has('KeyD')||held.has('ArrowUp')||held.has('ArrowDown')||held.has('ArrowLeft')||held.has('ArrowRight')||Math.abs(touchMove.x)+Math.abs(touchMove.y)>.18;
  const hearsRunning=(held.has('ShiftLeft')||held.has('ShiftRight')||touchRun)&&movingInput&&d<rules.hearing&&clearPath(t.position.x,t.position.z,player.x,player.z);
  if(sees){
   if(!u.spotted){$('#alert').textContent='SPOTTED!';$('#alert').classList.add('show');playTone(150,.24,'sawtooth',.055);setTimeout(()=>$('#alert').classList.remove('show'),700)}
   u.mode='chase';u.spotted=true;u.lastKnown={x:player.x,z:player.z};u.searchTime=rules.search
  }
  let target;
  if(smoke&&smoke.life>0&&Math.hypot(smoke.x-t.position.x,smoke.z-t.position.z)<12){u.mode='investigate';target=smoke}
  else if(noise&&noise.life>0&&Math.hypot(noise.x-t.position.x,noise.z-t.position.z)<12){u.mode='investigate';target=noise}
  else if(hearsRunning&&!sees){u.mode='investigate';u.lastKnown={x:player.x,z:player.z};u.searchTime=Math.max(u.searchTime,rules.search*.4);target=u.lastKnown}
  else if(u.mode==='chase'&&u.searchTime>0){u.searchTime-=dt;target=u.lastKnown}
  else if(u.mode==='investigate'&&u.searchTime>0){u.searchTime-=dt;target=u.lastKnown}
  else{u.mode='patrol';u.spotted=false;u.wait-=dt;if(!u.target||u.wait<=0){u.routeIndex=(u.routeIndex+1)%u.route.length;const point=u.route[u.routeIndex];u.target=world(point[0],point[1]);u.wait=2.2+Math.random()*1.2}target=u.target}
  if(target){
   u.routeTimer-=dt;if(!u.next||u.routeTimer<=0){u.next=bfsStep(t.position,target);u.routeTimer=.45}
   const vx=u.next.x-t.position.x,vz=u.next.z-t.position.z,len=Math.hypot(vx,vz);
   if(len>.12){const speed=u.mode==='chase'?rules.chase:u.mode==='investigate'?rules.investigate:rules.patrol;const nx=t.position.x+vx/len*speed*dt,nz=t.position.z+vz/len*speed*dt;const lockedExit=doors.some(door=>door.kind==='exit'&&!door.open&&found<3&&Math.hypot(nx-door.x,nz-door.z)<1.35);if(!lockedExit){for(const door of doors)if(!door.open&&Math.hypot(nx-door.x,nz-door.z)<1.45&&(door.kind!=='exit'||found>=3))door.open=true;t.position.x=nx;t.position.z=nz;t.rotation.y=Math.atan2(-vx,-vz)}}
  }
  u.gait=(u.gait||0)+dt*(u.mode==='chase'?12:u.mode==='investigate'?7:5);u.arms?.forEach((arm,i)=>{arm.rotation.x=Math.sin(u.gait+i*Math.PI)* (u.mode==='chase'?.4:.23);arm.rotation.z=(i===0?1:-1)*(.06+Math.sin(u.gait*.5)*.04)});u.legs?.forEach((leg,i)=>leg.rotation.x=Math.sin(u.gait+i*Math.PI)*(u.mode==='chase'?.34:.2));t.position.y=Math.abs(Math.sin(u.gait))*(u.mode==='chase'?.045:.014);
  if(u.mode==='chase'&&d<1.15)caught();
 }
}
function update(dt){
 if(!active)return;
 elapsed+=dt;timeLeft=Math.max(0,TOTAL_TIME-elapsed);
 if(timeLeft<=0){active=false;$('#caught').style.display='grid';$('.dialog h2').textContent='Daybreak.';$('.dialog p').textContent='The school day has started. You ran out of time. Try another route and use your distractions wisely.';return}
 const day=timeLeft>TOTAL_TIME/2?1:2,sec=Math.ceil(timeLeft);
 $('#dayLabel').textContent='DAY '+day+' / 2';$('#timeLabel').textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
 // Long, scheduled blackout: one to two minutes dark, then thirty minutes lit.
 if(lightsOn){untilBlackout-=dt;if(untilBlackout<=0){lightsOn=false;blackoutRemaining=60+Math.random()*60;say('The power has failed. Use your flashlight and stay quiet.',2600);playTone(95,.45,'sawtooth',.045)}}
 else{blackoutRemaining-=dt;if(blackoutRemaining<=0){lightsOn=true;untilBlackout=30*60;say('The school lights are back on.',2200);playTone(390,.25,'triangle',.035)}}
 const targetPower=lightsOn?1:.045;lightPower+=(targetPower-lightPower)*Math.min(1,dt*1.5);
 const lightLevel=lightPower*(day===1?1:.72);
 ambient.intensity=(day===1?.62:.43)*lightPower;
 keyLight.intensity=(day===1?1:.62)*lightPower;
 practicalLights.forEach(l=>l.intensity=l.userData.baseIntensity*lightLevel);
 const forward=(held.has('KeyW')||held.has('ArrowUp')?1:0)+(held.has('KeyS')||held.has('ArrowDown')?-1:0)-touchMove.y;
 if(held.has('ArrowLeft'))player.yaw+=1.9*dt;if(held.has('ArrowRight'))player.yaw-=1.9*dt;
 const side=(held.has('KeyD')?1:0)-(held.has('KeyA')?1:0)+touchMove.x;
 const running=!crouching&&(held.has('ShiftLeft')||held.has('ShiftRight')||touchRun)&&player.stamina>1&&Math.abs(forward)+Math.abs(side)>0;
 const speed=crouching?1.38:running?5.1:2.85;if(running)player.stamina=Math.max(0,player.stamina-24*dt);else player.stamina=Math.min(100,player.stamina+15*dt);
 $('#staminaBar').style.width=player.stamina+'%';
 jumpCooldown=Math.max(0,jumpCooldown-dt);if(jumpTime>0)jumpTime=Math.max(0,jumpTime-dt);
 const mag=Math.hypot(forward,side)||1,f=forward/mag,s=side/mag;
 const mx=(-Math.sin(player.yaw)*f+Math.cos(player.yaw)*s)*speed*dt,mz=(-Math.cos(player.yaw)*f-Math.sin(player.yaw)*s)*speed*dt;
 if(!isBlocked(player.x+mx,player.z))player.x+=mx;if(!isBlocked(player.x,player.z+mz))player.z+=mz;
  updateDoors(dt);
  mapRefresh+=dt;if(mapRefresh>=.16){mapRefresh=0;drawMiniMap()}
 fans.forEach((fan,i)=>fan.rotation.y+=dt*(i%2?1.1:-1.1));
  const at=cell(player.x,player.z);if(at.r>=19&&!outside){outside=true;$('#collectTitle').textContent='Main gate parts';$('#keyLabel').textContent=gateFound+' / 3';say('Outside. Find the wheel, fuse and gate key, then open the main gate.',3200)}
 const jumpProgress=jumpTime>0?(JUMP_DURATION-jumpTime)/JUMP_DURATION:1;
 const jumpHeight=jumpTime>0?Math.sin(jumpProgress*Math.PI)*.62:0;
 const eyeHeight=crouching?1.04:1.62;camera.position.set(player.x,eyeHeight+jumpHeight,player.z);camera.rotation.order='YXZ';camera.rotation.set(player.pitch,player.yaw,0);
 collectNearby();updateTeachers(dt);
 students.forEach((s,i)=>{const gait=elapsed*3.2+i*1.7;s.position.y=.006+Math.sin(gait)*.009;s.userData.legs.forEach((leg,j)=>leg.rotation.x=Math.sin(gait+j*Math.PI)*.11);s.userData.arms.forEach((arm,j)=>arm.rotation.x=-.72+Math.sin(gait+j*Math.PI)*.035)});
 keys.forEach((k,i)=>{if(!k.userData.taken){k.rotation.y+=dt*1.2;k.position.y=.08+Math.sin(elapsed*2+i)*.05}});
 gateParts.forEach((p,i)=>{if(!p.userData.taken){p.rotation.y+=dt*.7;p.position.y=.04+Math.sin(elapsed*1.8+i)*.05}});
 if(noise){noise.life-=dt;if(noise.mesh){noise.mesh.position.y=.35+Math.sin(elapsed*5)*.08;noise.mesh.material.emissiveIntensity=1.25}if(noise.life<=0){worldGroup.remove(noise.mesh);noise=null}}
 if(smoke){smoke.life-=dt;smoke.mesh.children.forEach((p,i)=>{p.position.y+=dt*.13;p.material.opacity=Math.max(0,.22*(smoke.life/9))});if(smoke.life<=0){worldGroup.remove(smoke.mesh);smoke=null}}
 const closest=Math.min(...teachers.map(t=>Math.hypot(player.x-t.position.x,player.z-t.position.z)));
 const focusedDoor=nearestDoor(),useHint=matchMedia('(pointer: coarse)').matches?'Tap USE to ':'Press E to ';
 $('#vignette').classList.toggle('danger',closest<4.5);$('#message').textContent=closest<4.5?'A teacher is close. Break line of sight!':focusedDoor?(focusedDoor.kind==='exit'&&!focusedDoor.open&&found<3?'Exit locked · find all 3 keys':useHint+(focusedDoor.open?'close ':'open ')+(focusedDoor.kind==='exit'?'school exit':'classroom door')):outside?(gateFound===3?'All gate parts found. Open the gate.':'Yard: search for the wheel, fuse and gate key · '+gateFound+'/3'):(found===3?'All classroom keys found. Unlock the exit door.':'Find classroom keys · '+found+'/3 · Q distract · G smoke');
}
function animate(now){
 requestAnimationFrame(animate);const dt=Math.min(.05,(now-last)/1000||0);last=now;
 update(dt);renderer.render(scene,camera);
}
requestAnimationFrame(animate);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});