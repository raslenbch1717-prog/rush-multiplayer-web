(() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $("game"), ctx = canvas.getContext("2d");
  const joinPanel = $("joinPanel"), gamePanel = $("gamePanel");
  const connection = $("connection"), joinBtn = $("joinBtn");
  let socket, myId = null, myColor = "#ff5263", joined = false, room = "RUSH";
  let players = new Map(), lastSend = 0, cameraX = 0, startTime = 0, finishedAt = null;
  const W = canvas.width, H = canvas.height, WORLD = 2300, FLOOR = 460;
  const keys = new Set(), mobile = {left:false,right:false};
  const me = {x:70,y:FLOOR-42,vx:0,vy:0,w:25,h:38,grounded:false,finished:false};
  const platforms = [
    {x:0,y:FLOOR,w:WORLD,h:60},
    {x:280,y:390,w:125,h:15},{x:480,y:340,w:125,h:15},
    {x:700,y:390,w:115,h:15},{x:900,y:330,w:135,h:15},
    {x:1135,y:380,w:125,h:15},{x:1350,y:320,w:140,h:15},
    {x:1580,y:380,w:125,h:15},{x:1795,y:330,w:135,h:15}
  ];
  const hazards = [
    {x:200,y:430,w:36,h:30,kind:"spike"},
    {x:430,y:430,w:38,h:30,kind:"spike"},
    {x:635,y:420,w:35,h:40,kind:"block",moving:true,origin:635,range:40,speed:1.8},
    {x:850,y:430,w:40,h:30,kind:"spike"},
    {x:1070,y:405,w:35,h:55,kind:"block",moving:true,origin:1070,range:50,speed:2.3},
    {x:1295,y:430,w:40,h:30,kind:"spike"},
    {x:1520,y:410,w:35,h:50,kind:"block",moving:true,origin:1520,range:55,speed:2},
    {x:1740,y:430,w:40,h:30,kind:"spike"},
    {x:1970,y:410,w:38,h:50,kind:"block",moving:true,origin:1970,range:45,speed:2.4}
  ];
  const hazardX = (h,t) => h.moving ? h.origin + Math.sin(t*h.speed/35)*h.range : h.x;
  const send = (data) => { if(socket && socket.readyState===WebSocket.OPEN) socket.send(JSON.stringify(data)); };
  function connect() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${proto}//${location.host}`);
    socket.onopen = () => { connection.textContent = "CONNECTED"; connection.style.color = "#8ff0a4"; };
    socket.onclose = () => { connection.textContent = "RECONNECT NEEDED"; connection.style.color = "#ff5263"; joined=false; };
    socket.onerror = () => { connection.textContent = "CONNECTION ERROR"; };
    socket.onmessage = (event) => {
      let msg; try { msg=JSON.parse(event.data); } catch { return; }
      if(msg.type==="welcome"){myId=msg.id;myColor=msg.color;}
      if(msg.type==="joined"){room=msg.room;$("roomLabel").textContent=room;joined=true;joinPanel.classList.add("hidden");gamePanel.classList.remove("hidden");$("raceStatus").textContent="RACE LIVE";startTime=performance.now();}
      if(msg.type==="players"){players=new Map((msg.players||[]).map(p=>[p.id,p]));}
    };
  }
  connect();
  joinBtn.onclick = () => {
    if(!socket || socket.readyState!==WebSocket.OPEN){connection.textContent="RECONNECTING…";return;}
    room = $("roomInput").value.trim().toUpperCase() || "RUSH";
    send({type:"join",name:$("nameInput").value.trim()||"Runner",room});
  };
  $("resetBtn").onclick = reset;
  function reset(){me.x=70;me.y=FLOOR-me.h;me.vx=0;me.vy=0;me.finished=false;finishedAt=null;startTime=performance.now();send({type:"reset"});$("raceStatus").textContent="RACE LIVE";}
  window.addEventListener("keydown",e=>{if(["ArrowLeft","ArrowRight","ArrowUp"," "].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if(e.key.toLowerCase()==="r"&&joined)reset();});
  window.addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
  function hold(id, prop){const el=$(id);const down=e=>{e.preventDefault();mobile[prop]=true;};const up=e=>{e.preventDefault();mobile[prop]=false;};el.addEventListener("pointerdown",down);["pointerup","pointerleave","pointercancel"].forEach(ev=>el.addEventListener(ev,up));}
  hold("leftBtn","left");hold("rightBtn","right");
  $("jumpBtn").addEventListener("pointerdown",e=>{e.preventDefault();jump();});
  function jump(){if(me.grounded&&!me.finished){me.vy=-12.4;me.grounded=false;}}
  function intersects(a,b){return a.x < b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;}
  function update(dt,t){
    if(!joined)return;
    const left=keys.has("a")||keys.has("arrowleft")||mobile.left;
    const right=keys.has("d")||keys.has("arrowright")||mobile.right;
    if((keys.has(" ")||keys.has("w")||keys.has("arrowup"))&&!update.spaceWasDown)jump();
    update.spaceWasDown=keys.has(" ")||keys.has("w")||keys.has("arrowup");
    if(!me.finished){
      const accel=0.75*(dt/16.67), max=5.5;
      if(left)me.vx-=accel;if(right)me.vx+=accel;if(!left&&!right)me.vx*=Math.pow(.80,dt/16.67);
      me.vx=Math.max(-max,Math.min(max,me.vx));me.x+=me.vx*(dt/16.67);
      const oldY=me.y;me.vy+=.62*(dt/16.67);me.y+=me.vy*(dt/16.67);me.grounded=false;
      for(const p of platforms){if(me.x+me.w>p.x&&me.x<p.x+p.w&&oldY+me.h<=p.y&&me.y+me.h>=p.y&&me.vy>=0){me.y=p.y-me.h;me.vy=0;me.grounded=true;}}
      if(me.x<0){me.x=0;me.vx=0;}
      for(const h of hazards){const hx=hazardX(h,t);if(intersects(me,{x:hx,y:h.y,w:h.w,h:h.h})){reset();return;}}
      if(me.y>H+100)reset();
      if(me.x+me.w>=WORLD-70){me.finished=true;finishedAt=performance.now();$("raceStatus").textContent="FINISH!";send({type:"move",x:me.x,y:me.y,finished:true});}
    }
    cameraX=Math.max(0,Math.min(WORLD-W,me.x-W*.32));
    const now=performance.now();if(now-lastSend>50){send({type:"move",x:me.x,y:me.y,finished:me.finished});lastSend=now;}
    if(me.finished&&finishedAt&&performance.now()-finishedAt>5000)reset();
  }
  function roundRect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function draw(t){
    ctx.clearRect(0,0,W,H);
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#141c30");bg.addColorStop(1,"#0c1120");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.translate(-cameraX,0);
    // skyline and grid
    for(let i=0;i<45;i++){const x=i*58;const bh=60+(i*47%120);ctx.fillStyle="#1a243a";ctx.fillRect(x,FLOOR-bh-12,35,bh);ctx.fillStyle="#293651";for(let yy=FLOOR-bh;yy<FLOOR-20;yy+=18)ctx.fillRect(x+8,yy,4,4);}
    ctx.strokeStyle="#202b43";ctx.lineWidth=1;for(let x=0;x<WORLD;x+=50){ctx.beginPath();ctx.moveTo(x,FLOOR);ctx.lineTo(x,H);ctx.stroke();}
    // floor and floating platforms
    ctx.fillStyle="#202a40";ctx.fillRect(0,FLOOR,WORLD,80);ctx.fillStyle="#5bd8ff";ctx.fillRect(0,FLOOR,WORLD,3);
    platforms.slice(1).forEach(p=>{roundRect(p.x,p.y,p.w,p.h,4,"#35435e");ctx.fillStyle="#5bd8ff";ctx.fillRect(p.x,p.y,p.w,3);});
    // hazards
    hazards.forEach(h=>{const x=hazardX(h,t);if(h.kind==="spike"){ctx.fillStyle="#ff5263";ctx.beginPath();ctx.moveTo(x,h.y+h.h);ctx.lineTo(x+h.w/2,h.y);ctx.lineTo(x+h.w,h.y+h.h);ctx.closePath();ctx.fill();ctx.fillStyle="#ff9aa5";ctx.fillRect(x+h.w/2-2,h.y+12,4,13);}else{roundRect(x,h.y,h.w,h.h,4,"#ff5263");ctx.fillStyle="#ff9ba6";ctx.fillRect(x+6,h.y+7,h.w-12,4);}});
    // finish
    ctx.fillStyle="#dce6f7";ctx.fillRect(WORLD-70,230,4,FLOOR-230);for(let r=0;r<6;r++)for(let c=0;c<2;c++){ctx.fillStyle=(r+c)%2?"#fff":"#ff5263";ctx.fillRect(WORLD-66+c*14,235+r*14,14,14);}
    // other players
    for(const p of players.values()){if(p.id===myId)continue;drawRunner(p.x,p.y,p.color,p.name,p.finished);}
    drawRunner(me.x,me.y,myColor,$("nameInput").value||"YOU",me.finished,true);
    ctx.restore();
    // HUD
    roundRect(18,17,210,50,8,"#111827cc");ctx.fillStyle="#8c95aa";ctx.font="800 10px system-ui";ctx.fillText("DISTANCE TO FINISH",31,35);ctx.fillStyle="#fff";ctx.font="900 19px system-ui";ctx.fillText(`${Math.max(0,Math.round((WORLD-70-me.x)/10))} m`,31,56);
    const elapsed=(performance.now()-startTime)/1000;ctx.textAlign="right";ctx.fillStyle="#dfe6f4";ctx.font="800 14px system-ui";ctx.fillText(`${elapsed.toFixed(2)}s`,W-20,34);ctx.textAlign="left";
    if(!joined){ctx.fillStyle="#fff";ctx.font="bold 20px system-ui";ctx.fillText("JOIN A ROOM TO PLAY",W/2-110,H/2);}
    if(me.finished){ctx.fillStyle="#fff";ctx.font="900 34px system-ui";ctx.textAlign="center";ctx.fillText("FINISH!",W/2,H/2);ctx.textAlign="left";}
  }
  function drawRunner(x,y,color,name,finished,isMe=false){
    ctx.save();ctx.translate(x,y);if(finished)ctx.globalAlpha=.7;
    roundRect(-2,4,29,38,7,"#00000055");roundRect(0,0,25,38,6,color);
    roundRect(4,6,17,9,3,"#111827");ctx.fillStyle="#fff";ctx.fillRect(8,8,3,3);ctx.fillRect(16,8,3,3);
    ctx.fillStyle="#fff";ctx.font="800 10px system-ui";ctx.textAlign="center";ctx.fillText(String(name).slice(0,12),12,-9);
    if(isMe){ctx.fillStyle="#5bd8ff";ctx.beginPath();ctx.moveTo(12,-17);ctx.lineTo(7,-23);ctx.lineTo(17,-23);ctx.closePath();ctx.fill();}
    ctx.restore();
  }
  let previous=performance.now();
  function loop(now){const dt=Math.min(35,now-previous);previous=now;update(dt,now);draw(now);requestAnimationFrame(loop);}
  requestAnimationFrame(loop);
})();