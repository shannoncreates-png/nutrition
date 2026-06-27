import { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, RadialBarChart, RadialBar
} from "recharts";

// ── COSMIC CANDY PALETTE ───────────────────────────────────────────
const C = {
  bg:       "#0e0818",
  surface:  "#160d24",
  surface2: "#1e1230",
  surface3: "#261840",
  border:   "#2e1f48",
  borderLt: "#3d2960",

  lavender: "#c084fc",   // hero accent — electric lavender
  lavLt:    "#e0b8ff",   // lighter lavender for text
  mint:     "#4ade80",   // mint green
  mintLt:   "#86efac",
  peach:    "#fb923c",   // peachy orange
  peachLt:  "#fda96e",
  pink:     "#f472b6",   // candy pink
  blue:     "#60a5fa",   // soft periwinkle blue
  yellow:   "#facc15",   // lemon yellow
  red:      "#f87171",   // soft red

  text:     "#f0e8ff",
  text2:    "#9d7fc4",
  text3:    "#5a3d80",
};

const STORAGE_KEY = "nourish_log_v7";
const GOALS_KEY   = "nourish_goals_v7";
const WATER_KEY   = "nourish_water_v4";
const DISC_KEY    = "nourish_disc_v4";
const DEFAULT_GOALS = { cal:2000,protein:150,carbs:250,fat:65,fibre:30,sugar:25,sodium:2300,water:8 };

const todayKey  = () => new Date().toISOString().slice(0,10);
const prevDay   = ds => { const d=new Date(ds+"T12:00:00"); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); };
const mealEmoji = m  => ({breakfast:"🌅",lunch:"☀️",dinner:"🌙",snack:"🍎"}[m]||"🍽️");
const getLog      = () => { try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");}catch{return[];} };
const saveLog     = l  => localStorage.setItem(STORAGE_KEY,JSON.stringify(l));
const getGoals    = () => { try{return{...DEFAULT_GOALS,...JSON.parse(localStorage.getItem(GOALS_KEY)||"{}")}}catch{return DEFAULT_GOALS;} };
const getWaterLog = () => { try{return JSON.parse(localStorage.getItem(WATER_KEY)||"{}");}catch{return{};} };
const saveWaterLog= w  => localStorage.setItem(WATER_KEY,JSON.stringify(w));

function getLast7(){ const d=[];for(let i=6;i>=0;i--){const x=new Date();x.setDate(x.getDate()-i);d.push(x.toISOString().slice(0,10));}return d; }
function calcGrade(val,goal,higher=false){ const r=val/goal;if(higher){if(r>=0.95)return"A";if(r>=0.7)return"B";if(r>=0.5)return"C";if(r>=0.25)return"D";return"F";}else{if(r<=1.0)return"A";if(r<=1.15)return"B";if(r<=1.3)return"C";if(r<=1.5)return"D";return"F";} }

// ── DEMO DATA ──────────────────────────────────────────────────────
const DEMO_CAL   = [420,1680,2100,1540,1890,0,0];
const DEMO_WATER = [6,8,5,7,8,0,0];
const DEMO_MACRO = [{name:"Protein",value:480,color:C.peach},{name:"Carbs",value:820,color:C.blue},{name:"Fat",value:360,color:C.yellow}];
const DEMO_MEAL  = [{name:"Breakfast 🌅",value:8,color:C.yellow},{name:"Lunch ☀️",value:11,color:C.mint},{name:"Dinner 🌙",value:9,color:C.lavender},{name:"Snack 🍎",value:5,color:C.pink}];
const DEMO_RADAR = [{subject:"Protein",A:88},{subject:"Fibre",A:52},{subject:"Water",A:77},{subject:"Calories",A:92},{subject:"Sugar",A:68},{subject:"Sodium",A:74}];
const DEMO_SF    = [{name:"Sugar",Yours:28,Goal:25},{name:"Fibre",Yours:19,Goal:30}];
const DEMO_GRADE = [{label:"Calories",grade:"B"},{label:"Protein",grade:"A"},{label:"Fibre",grade:"C"},{label:"Sugar",grade:"C"},{label:"Sodium",grade:"B"},{label:"💧 Water",grade:"A"}];
const DEMO_FOODS = [{name:"Greek Yoghurt",emoji:"🫙",count:4,totalCal:560},{name:"Chicken & Rice",emoji:"🍗",count:3,totalCal:1290},{name:"Oat Latte",emoji:"☕",count:5,totalCal:675},{name:"Salad Bowl",emoji:"🥗",count:3,totalCal:540},{name:"Banana",emoji:"🍌",count:6,totalCal:480}];

// ── GLOW HELPERS ───────────────────────────────────────────────────
const glow = (color, strength=0.18) => `0 0 24px ${color}${Math.round(strength*255).toString(16).padStart(2,"0")}`;
const glowBorder = (color) => `1px solid ${color}30`;

// ── TOOLTIP ────────────────────────────────────────────────────────
const DarkTip = ({ active, payload, label, fmt }) => {
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:C.surface2,border:glowBorder(C.lavender),borderRadius:12,padding:"8px 12px",fontSize:12,fontFamily:"Inter,sans-serif",boxShadow:glow(C.lavender,0.12)}}>
      {label&&<div style={{color:C.text2,marginBottom:4,fontWeight:600}}>{label}</div>}
      {payload.map((p,i)=><div key={i} style={{color:p.color||C.text,fontWeight:700}}>{p.name}: {fmt?fmt(p.value):Math.round(p.value)}</div>)}
    </div>
  );
};

// ── TOAST ──────────────────────────────────────────────────────────
function Toast({msg}){
  return <div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:C.surface2,border:glowBorder(C.lavender),borderRadius:99,padding:"10px 20px",fontSize:13,fontWeight:600,color:C.lavLt,whiteSpace:"nowrap",zIndex:999,opacity:msg?1:0,transition:"opacity 0.3s",pointerEvents:"none",boxShadow:glow(C.lavender),fontFamily:"Inter,sans-serif"}}>{msg}</div>;
}

// ── DISCLAIMER ─────────────────────────────────────────────────────
function Disclaimer({onAgree}){
  const pts=[
    {icon:"🤖",title:"AI estimates only.",body:"Values are approximations based on typical portions."},
    {icon:"👨‍⚕️",title:"Not medical advice.",body:"Not a substitute for a doctor or dietitian."},
    {icon:"📊",title:"For awareness only.",body:"Build general awareness — not for diagnosis."},
    {icon:"💾",title:"Data stays on device.",body:"Export a backup from Goals regularly."},
  ];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(14,8,24,0.92)",zIndex:1000,display:"flex",alignItems:"flex-end",backdropFilter:"blur(12px)"}}>
      <div style={{width:"100%",maxWidth:480,margin:"0 auto",background:C.surface,borderRadius:"28px 28px 0 0",padding:"28px 24px 44px",borderTop:`2px solid ${C.lavender}40`}}>
        <div style={{width:36,height:4,background:C.border,borderRadius:99,margin:"0 auto 24px"}}/>
        <div style={{fontSize:36,textAlign:"center",marginBottom:12}}>🌙</div>
        <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:22,fontWeight:700,textAlign:"center",marginBottom:16,color:C.text}}>Before you start</div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
          {pts.map((p,i)=><div key={i} style={{display:"flex",gap:10,background:C.surface2,borderRadius:14,padding:12,border:glowBorder(C.lavender),fontSize:13,color:C.text2,lineHeight:1.5}}><span style={{fontSize:16,flexShrink:0}}>{p.icon}</span><span><strong style={{color:C.text}}>{p.title}</strong> {p.body}</span></div>)}
        </div>
        <button onClick={onAgree} style={{width:"100%",padding:15,background:`linear-gradient(135deg,${C.lavender},${C.pink})`,border:"none",borderRadius:14,color:"white",fontSize:15,fontWeight:700,fontFamily:"Space Grotesk,sans-serif",cursor:"pointer",boxShadow:glow(C.lavender,0.4)}}>
          I understand — let's go ✦
        </button>
      </div>
    </div>
  );
}

// ── CALORIE SLIDER ─────────────────────────────────────────────────
function CalGoalSetup({value,onChange}){
  const presets=[1500,1800,2000,2200,2500,3000];
  const note=value<1600?"⚠️ Very low — consult a professional":value<1900?"Gentle deficit — gradual weight loss":value<2200?"Maintenance range for most adults":value<2600?"Active lifestyle — great for building":"High intake — for very active people";
  return(
    <div style={{background:C.surface,border:glowBorder(C.lavender),borderRadius:20,padding:16,margin:"0 20px 14px",boxShadow:glow(C.lavender,0.08)}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:13,fontWeight:700,color:C.text}}>🎯 Daily Calorie Goal</div>
        <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:24,fontWeight:700,color:C.lavender}}>{value.toLocaleString()}<span style={{fontSize:12,color:C.text2,marginLeft:4,fontWeight:500}}>kcal</span></div>
      </div>
      <input type="range" min={1000} max={4000} step={50} value={value} onChange={e=>onChange(Number(e.target.value))} style={{width:"100%",accentColor:C.lavender,cursor:"pointer",marginBottom:6}}/>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{fontSize:10,color:C.text3,fontFamily:"Inter,sans-serif"}}>1,000</span><span style={{fontSize:10,color:C.text3,fontFamily:"Inter,sans-serif"}}>4,000</span></div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
        {presets.map(p=><button key={p} onClick={()=>onChange(p)} style={{padding:"5px 12px",borderRadius:99,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Space Grotesk,sans-serif",border:`1px solid ${value===p?C.lavender:C.border}`,background:value===p?`${C.lavender}20`:C.surface2,color:value===p?C.lavLt:C.text2,transition:"all 0.15s",boxShadow:value===p?glow(C.lavender,0.2):"none"}}>{p.toLocaleString()}</button>)}
      </div>
      <div style={{fontSize:11,color:C.text2,lineHeight:1.5,fontFamily:"Inter,sans-serif"}}>{note}</div>
    </div>
  );
}

// ── DONUT RING ─────────────────────────────────────────────────────
function DonutRing({eaten,goal}){
  const ref=useRef(null);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const ctx=canvas.getContext("2d"),sz=100,cx=sz/2,cy=sz/2,r=38,lw=9;
    ctx.clearRect(0,0,sz,sz);
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle=C.border;ctx.lineWidth=lw;ctx.stroke();
    const pct=Math.min(eaten/goal,1);
    if(pct>0){
      ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*pct);
      const grad=ctx.createLinearGradient(0,0,sz,0);
      grad.addColorStop(0,pct>=1?C.red:C.lavender);
      grad.addColorStop(1,pct>=1?C.pink:C.mint);
      ctx.strokeStyle=grad;ctx.lineWidth=lw;ctx.lineCap="round";ctx.stroke();
    }
  },[eaten,goal]);
  return(
    <div style={{position:"relative",width:100,height:100,flexShrink:0}}>
      <canvas ref={ref} width={100} height={100} style={{width:100,height:100}}/>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:20,fontWeight:700,lineHeight:1,color:C.lavLt}}>{Math.round(eaten)}</div>
        <div style={{fontSize:9,color:C.text2,marginTop:2,fontFamily:"Inter,sans-serif"}}>kcal eaten</div>
      </div>
    </div>
  );
}

function MacroBar({name,val,goal,unit,color}){
  const pct=Math.min((val/goal)*100,100),over=val>goal&&(name==="Sugar"||name==="Sodium");
  return(
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{fontSize:10,color:C.text2,width:42,fontFamily:"Inter,sans-serif"}}>{name}</div>
      <div style={{flex:1,height:5,background:C.border,borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:over?C.red:color,borderRadius:99,transition:"width 0.6s cubic-bezier(0.34,1.56,0.64,1)",boxShadow:`0 0 8px ${over?C.red:color}60`}}/>
      </div>
      <div style={{fontSize:10,fontWeight:600,color:C.text,width:46,textAlign:"right",fontFamily:"Inter,sans-serif"}}>{Math.round(val)}{unit}</div>
    </div>
  );
}

function CalBanner({eaten,goal}){
  const rem=goal-eaten;
  let bg,bc,nc,glowC,emoji,label,detail;
  if(eaten===0){bc=C.lavender;nc=C.lavLt;glowC=C.lavender;emoji="🌙";label="calories remaining";detail="Log your first meal to start";}
  else if(rem>200){bc=C.mint;nc=C.mintLt;glowC=C.mint;emoji="✨";label="calories remaining";detail=`${Math.round(eaten)} eaten of ${goal} goal`;}
  else if(rem>=0){bc=C.yellow;nc=C.yellow;glowC=C.yellow;emoji="⚡";label="calories remaining";detail="Close to your goal — choose wisely";}
  else{bc=C.red;nc=C.red;glowC=C.red;emoji="🔴";label="calories over goal";detail=`${Math.round(eaten)} eaten — ${Math.abs(Math.round(rem))} over`;}
  return(
    <div style={{margin:"0 20px 14px",borderRadius:20,padding:"16px 18px",display:"flex",alignItems:"center",gap:16,border:`1px solid ${bc}30`,background:`${bc}08`,boxShadow:glow(glowC,0.1)}}>
      <div>
        <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:34,fontWeight:700,lineHeight:1,color:nc}}>{eaten===0?goal:Math.abs(Math.round(rem))}</div>
        <div style={{fontSize:12,color:C.text2,marginTop:3,fontFamily:"Inter,sans-serif"}}>{label}</div>
        <div style={{fontSize:11,color:C.text3,marginTop:2,fontFamily:"Inter,sans-serif"}}>{detail}</div>
      </div>
      <div style={{marginLeft:"auto",fontSize:32}}>{emoji}</div>
    </div>
  );
}

function WaterTracker({cups,goal,onChange}){
  return(
    <div style={{margin:"0 20px 14px",background:C.surface,border:`1px solid ${C.blue}30`,borderRadius:20,padding:"14px 16px",boxShadow:glow(C.blue,0.08)}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:13,fontWeight:700,color:C.blue}}>💧 Water</div>
        <div style={{background:`${C.blue}15`,borderRadius:99,padding:"3px 10px",fontFamily:"Space Grotesk,sans-serif",fontSize:13,fontWeight:700,color:C.blue,border:`1px solid ${C.blue}30`}}>{cups} / {goal}</div>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
        {Array.from({length:goal},(_,i)=><button key={i} onClick={()=>onChange(i<cups?i:i+1)} style={{width:30,height:34,borderRadius:10,border:`1px solid ${i<cups?C.blue+"50":C.border}`,background:i<cups?`${C.blue}18`:C.surface2,cursor:"pointer",fontSize:14,transition:"all 0.15s",boxShadow:i<cups?glow(C.blue,0.15):"none"}}>{i<cups?"💧":"·"}</button>)}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{flex:1,height:4,background:C.border,borderRadius:99,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${Math.min(cups/goal*100,100)}%`,background:`linear-gradient(90deg,${C.blue},${C.lavender})`,borderRadius:99,transition:"width 0.4s ease",boxShadow:`0 0 8px ${C.blue}60`}}/>
        </div>
        <div style={{fontSize:11,color:C.blue,fontWeight:600,fontFamily:"Inter,sans-serif"}}>{Math.round(cups/goal*100)}%</div>
      </div>
    </div>
  );
}

function PortionSheet({entry,onConfirm,onSkip}){
  const [sel,setSel]=useState(1);
  const opts=entry?._portionOptions||[{label:"Small / half",multiplier:0.5},{label:"Standard",multiplier:1.0},{label:"Large / double",multiplier:1.5},{label:"Extra large",multiplier:2.0}];
  useEffect(()=>setSel(1),[entry]);
  if(!entry)return null;
  return(
    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:C.surface,borderRadius:"28px 28px 0 0",borderTop:`2px solid ${C.lavender}40`,padding:"20px 20px 44px",zIndex:500,boxShadow:`0 -20px 60px rgba(14,8,24,0.8), ${glow(C.lavender,0.15)}`}}>
      <div style={{width:36,height:4,background:C.border,borderRadius:99,margin:"0 auto 20px"}}/>
      <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:17,fontWeight:700,marginBottom:6,color:C.text}}>How much {entry.name.toLowerCase()}?</div>
      <div style={{fontSize:13,color:C.text2,marginBottom:16,lineHeight:1.5,fontFamily:"Inter,sans-serif"}}>I assumed a standard portion — tap to adjust.</div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        {opts.map((o,i)=><button key={i} onClick={()=>setSel(i)} style={{padding:"12px 14px",background:sel===i?`${C.lavender}12`:C.surface2,border:`1.5px solid ${sel===i?C.lavender:C.border}`,borderRadius:14,fontSize:14,cursor:"pointer",textAlign:"left",color:sel===i?C.lavLt:C.text,fontFamily:"Inter,sans-serif",fontWeight:600,display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.15s",boxShadow:sel===i?glow(C.lavender,0.15):"none"}}><span>{o.label}</span><span style={{color:C.text3,fontSize:12}}>≈ {Math.round(entry.cal*o.multiplier)} kcal</span></button>)}
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={onSkip} style={{flex:1,padding:12,borderRadius:14,fontSize:14,fontWeight:600,fontFamily:"Inter,sans-serif",cursor:"pointer",background:C.surface2,color:C.text2,border:`1px solid ${C.border}`}}>Skip — looks right</button>
        <button onClick={()=>onConfirm(opts[sel].multiplier)} style={{flex:1,padding:12,borderRadius:14,fontSize:14,fontWeight:700,fontFamily:"Space Grotesk,sans-serif",cursor:"pointer",background:`linear-gradient(135deg,${C.lavender},${C.mint})`,color:"white",border:"none",boxShadow:glow(C.lavender,0.3)}}>Confirm ✦</button>
      </div>
    </div>
  );
}

function LogItem({entry,onDelete}){
  const mc={
    breakfast:{bg:`${C.yellow}12`,color:C.yellow,bc:`${C.yellow}30`},
    lunch:{bg:`${C.mint}12`,color:C.mint,bc:`${C.mint}30`},
    dinner:{bg:`${C.lavender}12`,color:C.lavLt,bc:`${C.lavender}30`},
    snack:{bg:`${C.pink}12`,color:C.pink,bc:`${C.pink}30`},
  }[entry.meal]||{bg:`${C.lavender}12`,color:C.lavLt,bc:`${C.lavender}30`};
  return(
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,transition:"all 0.15s"}}>
      <div style={{width:36,height:36,borderRadius:12,background:mc.bg,border:`1px solid ${mc.bc}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{entry.emoji||mealEmoji(entry.meal)}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"Space Grotesk,sans-serif",color:C.text}}>{entry.name}</div>
        <div style={{fontSize:11,color:C.text2,marginTop:3,fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",gap:6}}>
          <span style={{display:"inline-block",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:99,textTransform:"uppercase",letterSpacing:"0.06em",background:mc.bg,color:mc.color,border:`1px solid ${mc.bc}`}}>{entry.meal}</span>
          P{Math.round(entry.protein)}g · C{Math.round(entry.carbs)}g · F{Math.round(entry.fat)}g{entry.sugar?` · 🍬${Math.round(entry.sugar)}g`:""}
        </div>
      </div>
      <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:16,fontWeight:700,color:C.lavLt,flexShrink:0}}>{Math.round(entry.cal)}</div>
      <button onClick={()=>onDelete(entry.id)} style={{width:28,height:28,borderRadius:8,background:"none",border:"1px solid transparent",color:C.text3,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:14,transition:"all 0.15s"}}>🗑</button>
    </div>
  );
}

function ResultCard({n,onConfirm,onDiscard}){
  const r1=[{v:n.cal,l:"kcal",c:C.lavender},{v:n.protein,l:"protein",c:C.peach,u:"g"},{v:n.carbs,l:"carbs",c:C.blue,u:"g"},{v:n.fat,l:"fat",c:C.yellow,u:"g"}];
  const r2=[{v:n.fibre,l:"fibre",c:C.mint,u:"g"},{v:n.sugar,l:"sugar",c:C.red,u:"g"},{v:n.sodium,l:"sodium",c:C.blue,u:"mg"},{v:n.cal>0?Math.round((n.protein*4/n.cal)*100):0,l:"protein%",c:C.peach,u:"%"}];
  return(
    <div style={{background:`linear-gradient(135deg,${C.lavender}10,${C.mint}06)`,border:`1px solid ${C.lavender}30`,borderRadius:20,padding:16,marginBottom:16,boxShadow:glow(C.lavender,0.1)}}>
      <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:16,fontWeight:700,marginBottom:8,color:C.text}}>{n.emoji} {n.name}</div>
      {n.note&&<div style={{fontSize:12,color:C.text2,marginBottom:10,fontFamily:"Inter,sans-serif",borderLeft:`3px solid ${C.lavender}`,paddingLeft:8}}>{n.note}</div>}
      {[r1,r2].map((row,ri)=><div key={ri} style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:6}}>{row.map((m,i)=><div key={i} style={{background:C.surface2,borderRadius:12,padding:"8px 5px",textAlign:"center",border:`1px solid ${m.c}20`}}><div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:16,fontWeight:700,lineHeight:1,color:m.c}}>{Math.round(m.v)}{m.u||""}</div><div style={{fontSize:9,color:C.text2,marginTop:3,fontFamily:"Inter,sans-serif"}}>{m.l}</div></div>)}</div>)}
      {n.sugar>20&&<div style={{fontSize:11,color:C.red,marginTop:6,fontFamily:"Inter,sans-serif",fontWeight:600}}>🍬 High sugar — {Math.round(n.sugar)}g</div>}
      {n.sodium>800&&<div style={{fontSize:11,color:C.blue,marginTop:4,fontFamily:"Inter,sans-serif",fontWeight:600}}>🧂 High sodium — {Math.round(n.sodium)}mg</div>}
      {n.fibre>5&&<div style={{fontSize:11,color:C.mint,marginTop:4,fontFamily:"Inter,sans-serif",fontWeight:600}}>✅ Good fibre — {Math.round(n.fibre)}g</div>}
      <div style={{display:"flex",gap:8,marginTop:12}}>
        <button onClick={onConfirm} style={{flex:1,padding:10,borderRadius:12,fontSize:13,fontWeight:700,fontFamily:"Space Grotesk,sans-serif",cursor:"pointer",border:"none",background:`linear-gradient(135deg,${C.mint},${C.blue})`,color:"white",boxShadow:glow(C.mint,0.2)}}>Confirm portion →</button>
        <button onClick={onDiscard} style={{flex:1,padding:10,borderRadius:12,fontSize:13,fontWeight:600,fontFamily:"Inter,sans-serif",cursor:"pointer",border:`1px solid ${C.border}`,background:C.surface2,color:C.text2}}>Discard</button>
      </div>
    </div>
  );
}

// ── TODAY PAGE ─────────────────────────────────────────────────────
function TodayPage({showToast}){
  const [log,setLog]      =useState(getLog);
  const [goals,setGoals]  =useState(getGoals);
  const [waterCups,setWC] =useState(()=>getWaterLog()[todayKey()]||0);
  const [input,setInput]  =useState("");
  const [meal,setMeal]    =useState("lunch");
  const [loading,setLoad] =useState(false);
  const [pendN,setPendN]  =useState(null);
  const [pendE,setPendE]  =useState(null);
  const [showPort,setPort]=useState(false);
  const [isRec,setIsRec]  =useState(false);
  const recRef            =useRef(null);
  const today=todayKey();
  const todayItems=log.filter(e=>e.date===today);
  const totals=todayItems.reduce((a,e)=>({cal:a.cal+e.cal,protein:a.protein+e.protein,carbs:a.carbs+e.carbs,fat:a.fat+e.fat,fibre:a.fibre+(e.fibre||0),sugar:a.sugar+(e.sugar||0),sodium:a.sodium+(e.sodium||0)}),{cal:0,protein:0,carbs:0,fat:0,fibre:0,sugar:0,sodium:0});
  const streak=(()=>{const l=getLog();if(!l.length)return 0;const ds=[...new Set(l.map(e=>e.date))].sort().reverse(),td=todayKey();if(ds[0]!==td&&ds[0]!==prevDay(td))return 0;let s=1,c=ds[0];for(let i=1;i<ds.length;i++){if(ds[i]===prevDay(c)){s++;c=ds[i];}else break;}return s;})();
  const handleCalGoal=v=>{const g={...goals,cal:v};setGoals(g);localStorage.setItem(GOALS_KEY,JSON.stringify(g));};
  const handleWater=n=>{setWC(n);const wl=getWaterLog();wl[today]=n;saveWaterLog(wl);if(n>=goals.water)showToast("💧 Water goal reached!");};
  const handleDelete=id=>{const nl=log.filter(e=>e.id!==id);saveLog(nl);setLog(nl);showToast("Entry removed");};
  const handleAnalyse=async()=>{
    if(!input.trim()){showToast("Describe what you ate first");return;}
    setLoad(true);setPendN(null);setPort(false);
    try{
      const res=await fetch("/api/analyse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({food:input.trim()})});
      const data=await res.json();
      const n=JSON.parse(data.content[0].text.trim().replace(/\`\`\`json|\`\`\`/g,"").trim());
      const entry={id:Date.now().toString(),date:today,time:new Date().toISOString(),meal,input:input.trim(),name:n.name,emoji:n.emoji||"🍽️",cal:n.cal,protein:n.protein,carbs:n.carbs,fat:n.fat,fibre:n.fibre||0,sugar:n.sugar||0,sodium:n.sodium||0,note:n.note||"",_portionOptions:n.portionOptions||[{label:"Small / half",multiplier:0.5},{label:"Standard",multiplier:1.0},{label:"Large / double",multiplier:1.5},{label:"Extra large",multiplier:2.0}]};
      setPendN(n);setPendE(entry);
    }catch(err){showToast("Could not analyse — try again");console.error(err);}
    setLoad(false);
  };
  const addEntry=e=>{const nl=[...log,e];saveLog(nl);setLog(nl);setPendN(null);setPendE(null);setPort(false);setInput("");showToast("✦ Added to your log");};
  const handlePortionConfirm=m=>{if(!pendE)return;addEntry({...pendE,cal:pendE.cal*m,protein:pendE.protein*m,carbs:pendE.carbs*m,fat:pendE.fat*m,fibre:pendE.fibre*m,sugar:pendE.sugar*m,sodium:pendE.sodium*m});};
  const handleMic=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){showToast("Voice not supported");return;}if(isRec){recRef.current?.stop();return;}const r=new SR();recRef.current=r;r.continuous=false;r.interimResults=true;r.lang="en-US";r.onresult=e=>setInput(Array.from(e.results).map(r=>r[0].transcript).join(""));r.onend=()=>setIsRec(false);r.onerror=()=>{setIsRec(false);showToast("Voice error");};r.start();setIsRec(true);showToast("🎤 Listening…");};
  const warnings=[];
  if(totals.sugar>goals.sugar)warnings.push({color:C.red,text:`🍬 Sugar over by ${Math.round(totals.sugar-goals.sugar)}g`});
  if(totals.sodium>goals.sodium)warnings.push({color:C.blue,text:`🧂 Sodium over by ${Math.round(totals.sodium-goals.sodium)}mg`});
  if(totals.fibre<goals.fibre*0.5&&totals.cal>500)warnings.push({color:C.mint,text:"🌿 Fibre low — add veg"});
  if(totals.protein>=goals.protein)warnings.push({color:C.peach,text:"💪 Protein goal hit!"});
  if(totals.fibre>=goals.fibre)warnings.push({color:C.mint,text:"✅ Fibre goal hit!"});

  return(
    <div>
      <div style={{padding:"56px 20px 16px",background:`linear-gradient(180deg,${C.surface} 0%,transparent 100%)`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:28,fontWeight:700,letterSpacing:"-0.03em",background:`linear-gradient(135deg,${C.lavLt},${C.mintLt})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Nourish ✦</div>
            <div style={{fontSize:14,color:C.text2,marginTop:4,fontFamily:"Inter,sans-serif"}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
          </div>
          {streak>0&&<div style={{background:`${C.peach}15`,border:`1px solid ${C.peach}30`,borderRadius:14,padding:"6px 12px",textAlign:"center",boxShadow:glow(C.peach,0.12)}}><div style={{fontSize:16}}>🔥</div><div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:11,fontWeight:700,color:C.peach}}>{streak}d</div></div>}
        </div>
      </div>
      <CalGoalSetup value={goals.cal} onChange={handleCalGoal}/>
      <CalBanner eaten={totals.cal} goal={goals.cal}/>
      <div style={{padding:"0 20px 14px",display:"flex",alignItems:"center",gap:20}}>
        <DonutRing eaten={totals.cal} goal={goals.cal}/>
        <div style={{display:"flex",flexDirection:"column",gap:7,flex:1}}>
          <MacroBar name="Protein" val={totals.protein} goal={goals.protein} unit="g" color={C.peach}/>
          <MacroBar name="Carbs"   val={totals.carbs}   goal={goals.carbs}   unit="g" color={C.blue}/>
          <MacroBar name="Fat"     val={totals.fat}     goal={goals.fat}     unit="g" color={C.yellow}/>
          <MacroBar name="Fibre"   val={totals.fibre}   goal={goals.fibre}   unit="g" color={C.mint}/>
          <MacroBar name="Sugar"   val={totals.sugar}   goal={goals.sugar}   unit="g" color={C.red}/>
          <MacroBar name="Sodium"  val={totals.sodium}  goal={goals.sodium}  unit="mg" color={C.blue}/>
        </div>
      </div>
      <WaterTracker cups={waterCups} goal={goals.water} onChange={handleWater}/>
      {warnings.length>0&&<div style={{display:"flex",gap:8,padding:"0 20px 14px",flexWrap:"wrap"}}>{warnings.map((w,i)=><div key={i} style={{padding:"5px 12px",borderRadius:99,fontSize:11,fontWeight:600,border:`1px solid ${w.color}30`,background:`${w.color}10`,color:w.color,fontFamily:"Inter,sans-serif",boxShadow:glow(w.color,0.08)}}>{w.text}</div>)}</div>}
      <div style={{padding:"0 20px 20px"}}>
        {pendN&&!showPort&&<ResultCard n={pendN} onConfirm={()=>setPort(true)} onDiscard={()=>{setPendN(null);setPendE(null);}}/>}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,overflow:"hidden",boxShadow:glow(C.lavender,0.06)}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))handleAnalyse();}}
            placeholder="Describe what you ate… e.g. 'bowl of oatmeal with banana' or 'grilled chicken wrap'" rows={3}
            style={{width:"100%",minHeight:72,background:"none",border:"none",outline:"none",padding:"14px 16px",fontFamily:"Inter,sans-serif",fontSize:15,lineHeight:1.6,color:C.text,resize:"none",boxSizing:"border-box"}}/>
          <div style={{display:"flex",alignItems:"center",padding:"10px 12px",borderTop:`1px solid ${C.border}`,gap:8,background:C.surface2}}>
            <button onClick={handleMic} style={{width:36,height:36,borderRadius:99,background:isRec?`${C.red}18`:C.surface,border:`1px solid ${isRec?C.red:C.border}`,color:isRec?C.red:C.text2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16,boxShadow:isRec?glow(C.red):"none"}}>🎤</button>
            <select value={meal} onChange={e=>setMeal(e.target.value)} style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,color:C.text2,fontSize:13,padding:"0 10px",height:36,fontFamily:"Inter,sans-serif",outline:"none",cursor:"pointer"}}>
              <option value="breakfast">🌅 Breakfast</option>
              <option value="lunch">☀️ Lunch</option>
              <option value="dinner">🌙 Dinner</option>
              <option value="snack">🍎 Snack</option>
            </select>
            <button onClick={handleAnalyse} disabled={loading} style={{background:`linear-gradient(135deg,${C.lavender},${C.pink})`,border:"none",borderRadius:10,color:"white",fontSize:13,fontWeight:700,padding:"0 16px",height:36,cursor:loading?"not-allowed":"pointer",fontFamily:"Space Grotesk,sans-serif",opacity:loading?0.6:1,boxShadow:glow(C.lavender,0.3)}}>
              {loading?"⏳":"Analyse ✦"}
            </button>
          </div>
        </div>
      </div>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:C.text3,padding:"0 20px",marginBottom:10,fontFamily:"Space Grotesk,sans-serif"}}>Today's meals</div>
      <div style={{padding:"0 20px",display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
        {todayItems.length===0?<div style={{textAlign:"center",padding:"32px 20px",color:C.text3,fontSize:14,lineHeight:1.6,fontFamily:"Inter,sans-serif"}}><div style={{fontSize:36,marginBottom:12}}>🌙</div>Nothing logged yet.<br/>Describe your first meal above.</div>:todayItems.slice().reverse().map(e=><LogItem key={e.id} entry={e} onDelete={handleDelete}/>)}
      </div>
      {showPort&&pendE&&(<><div style={{position:"fixed",inset:0,background:"rgba(14,8,24,0.7)",zIndex:400,backdropFilter:"blur(4px)"}} onClick={()=>{if(pendE)addEntry(pendE);}}/><PortionSheet entry={pendE} onConfirm={handlePortionConfirm} onSkip={()=>{if(pendE)addEntry(pendE);}}/></>)}
    </div>
  );
}

// ── HISTORY PAGE ───────────────────────────────────────────────────
function HistoryPage(){
  const log=getLog(),wl=getWaterLog();
  const fmt=ds=>{const d=new Date(ds+"T12:00:00"),t=new Date();t.setHours(12,0,0,0);const diff=Math.round((t-d)/86400000);if(diff===0)return"Today";if(diff===1)return"Yesterday";return d.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});};
  return(
    <div>
      <div style={{padding:"56px 20px 16px",background:`linear-gradient(180deg,${C.surface} 0%,transparent 100%)`}}>
        <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:28,fontWeight:700,letterSpacing:"-0.03em",background:`linear-gradient(135deg,${C.lavLt},${C.mintLt})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>History ✦</div>
        <div style={{fontSize:14,color:C.text2,marginTop:4,fontFamily:"Inter,sans-serif"}}>Everything you've tracked</div>
      </div>
      {!log.length?<div style={{textAlign:"center",padding:"48px 20px",color:C.text3,fontSize:14,fontFamily:"Inter,sans-serif"}}><div style={{fontSize:36,marginBottom:12}}>🌙</div>No history yet.<br/>Start logging on Today.</div>:(()=>{const byDay={};log.forEach(e=>{if(!byDay[e.date])byDay[e.date]=[];byDay[e.date].push(e);});return Object.keys(byDay).sort().reverse().map(day=>{const items=byDay[day],totalCal=items.reduce((a,e)=>a+e.cal,0),water=wl[day]||0;return(<div key={day} style={{marginBottom:24}}><div style={{padding:"0 20px",marginBottom:10,display:"flex",alignItems:"baseline",gap:10}}><div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:15,fontWeight:600,color:C.text}}>{fmt(day)}</div><div style={{fontSize:13,color:C.text2,fontFamily:"Inter,sans-serif"}}>{Math.round(totalCal)} kcal · 💧{water}</div></div><div style={{padding:"0 20px",display:"flex",flexDirection:"column",gap:8}}>{items.slice().reverse().map(e=><div key={e.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"11px 13px",display:"flex",alignItems:"center",gap:10}}><div style={{fontSize:18}}>{e.emoji||mealEmoji(e.meal)}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"Space Grotesk,sans-serif",color:C.text}}>{e.name}</div><div style={{fontSize:11,color:C.text2,marginTop:1,fontFamily:"Inter,sans-serif"}}>P{Math.round(e.protein)}g · C{Math.round(e.carbs)}g · F{Math.round(e.fat)}g{e.sugar?` · 🍬${Math.round(e.sugar)}g`:""}</div></div><div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:15,fontWeight:700,color:C.lavLt}}>{Math.round(e.cal)}</div></div>)}</div></div>);});})()}
    </div>
  );
}

// ── CHART CARD ─────────────────────────────────────────────────────
function ChartCard({title,sub,accent,isDemo,children}){
  const a=accent||C.lavender;
  return(
    <div style={{background:C.surface,border:`1px solid ${a}20`,borderRadius:20,padding:16,marginBottom:12,boxShadow:glow(a,0.06),position:"relative"}}>
      {isDemo&&<div style={{position:"absolute",top:14,right:14,background:`${C.yellow}18`,border:`1px solid ${C.yellow}40`,borderRadius:99,padding:"2px 10px",fontSize:9,fontWeight:700,color:C.yellow,fontFamily:"Space Grotesk,sans-serif",letterSpacing:"0.08em"}}>PREVIEW</div>}
      <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:15,fontWeight:700,marginBottom:4,color:C.text,paddingRight:isDemo?70:0}}>{title}</div>
      {sub&&<div style={{fontSize:12,color:C.text2,marginBottom:14,lineHeight:1.5,fontFamily:"Inter,sans-serif"}}>{sub}</div>}
      {children}
    </div>
  );
}

// ── CHARTS PAGE ────────────────────────────────────────────────────
function ChartsPage(){
  const log=getLog(),goals=getGoals(),days=getLast7(),wl=getWaterLog();
  const wi=log.filter(e=>days.includes(e.date));
  const d=[...new Set(wi.map(e=>e.date))].length||1;
  const labels=days.map(day=>new Date(day+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"}));
  const hasData=wi.length>0;
  const streak=(()=>{if(!log.length)return 0;const ds=[...new Set(log.map(e=>e.date))].sort().reverse(),td=todayKey();if(ds[0]!==td&&ds[0]!==prevDay(td))return 0;let s=1,c=ds[0];for(let i=1;i<ds.length;i++){if(ds[i]===prevDay(c)){s++;c=ds[i];}else break;}return s;})();

  const calData=hasData?days.map((day,i)=>({name:labels[i],Calories:Math.round(log.filter(e=>e.date===day).reduce((a,e)=>a+e.cal,0)),Goal:goals.cal})):days.map((day,i)=>({name:labels[i],Calories:DEMO_CAL[i],Goal:goals.cal}));
  const waterData=hasData?days.map((day,i)=>({name:labels[i],Cups:wl[day]||0,Goal:goals.water||8})):days.map((day,i)=>({name:labels[i],Cups:DEMO_WATER[i],Goal:goals.water||8}));
  const avgP=hasData?wi.reduce((a,e)=>a+e.protein,0)/d:130;
  const avgC=hasData?wi.reduce((a,e)=>a+e.carbs,0)/d:205;
  const avgF=hasData?wi.reduce((a,e)=>a+e.fat,0)/d:62;
  const avgSugar=hasData?wi.reduce((a,e)=>a+(e.sugar||0),0)/d:28;
  const avgFibre=hasData?wi.reduce((a,e)=>a+(e.fibre||0),0)/d:19;
  const avgSodium=hasData?wi.reduce((a,e)=>a+(e.sodium||0),0)/d:2100;
  const avgWater=hasData?days.reduce((a,day)=>a+(wl[day]||0),0)/7:6.8;
  const tc=hasData?wi.reduce((a,e)=>a+e.cal,0):goals.cal*5;
  const ac=tc/d;
  const macroDonut=hasData?[{name:"Protein",value:Math.round(avgP*4),color:C.peach},{name:"Carbs",value:Math.round(avgC*4),color:C.blue},{name:"Fat",value:Math.round(avgF*9),color:C.yellow}].filter(m=>m.value>0):DEMO_MACRO;
  const mealData=hasData?(()=>{const mc={breakfast:0,lunch:0,dinner:0,snack:0};wi.forEach(e=>{if(mc[e.meal]!==undefined)mc[e.meal]++;});return[{name:"Breakfast 🌅",value:mc.breakfast,color:C.yellow},{name:"Lunch ☀️",value:mc.lunch,color:C.mint},{name:"Dinner 🌙",value:mc.dinner,color:C.lavender},{name:"Snack 🍎",value:mc.snack,color:C.pink}].filter(m=>m.value>0);})():DEMO_MEAL;
  const radarData=hasData?[{subject:"Protein",A:Math.min((avgP/goals.protein)*100,100),fullMark:100},{subject:"Fibre",A:Math.min((avgFibre/goals.fibre)*100,100),fullMark:100},{subject:"Water",A:Math.min((avgWater/(goals.water||8))*100,100),fullMark:100},{subject:"Calories",A:Math.max(0,100-Math.abs((ac/goals.cal*100)-100)),fullMark:100},{subject:"Sugar",A:Math.max(0,100-Math.max(0,(avgSugar/goals.sugar-1)*100)),fullMark:100},{subject:"Sodium",A:Math.max(0,100-Math.max(0,(avgSodium/goals.sodium-1)*100)),fullMark:100}]:DEMO_RADAR;
  const sfData=hasData?[{name:"Sugar",Yours:Math.round(avgSugar),Goal:goals.sugar},{name:"Fibre",Yours:Math.round(avgFibre),Goal:goals.fibre}]:DEMO_SF;
  const grades=hasData?[{label:"Calories",grade:calcGrade(calData.filter(v=>v.Calories>0).reduce((a,v)=>a+v.Calories,0)/(calData.filter(v=>v.Calories>0).length||1),goals.cal,false)},{label:"Protein",grade:calcGrade(avgP,goals.protein,true)},{label:"Fibre",grade:calcGrade(avgFibre,goals.fibre,true)},{label:"Sugar",grade:calcGrade(avgSugar,goals.sugar,false)},{label:"Sodium",grade:calcGrade(avgSodium,goals.sodium,false)},{label:"💧 Water",grade:calcGrade(avgWater,goals.water||8,true)}]:DEMO_GRADE;
  const overallScore=Math.round(radarData.reduce((a,r)=>a+r.A,0)/radarData.length);
  const topFoods=hasData?(()=>{const counts={};wi.forEach(e=>{const k=e.name.toLowerCase();if(!counts[k])counts[k]={name:e.name,emoji:e.emoji||"🍽️",count:0,totalCal:0};counts[k].count++;counts[k].totalCal+=e.cal;});return Object.values(counts).sort((a,b)=>b.count-a.count).slice(0,5);})():DEMO_FOODS;
  const totalProtein=hasData?wi.reduce((a,e)=>a+e.protein,0):avgP*5;
  const totalSugar=hasData?wi.reduce((a,e)=>a+(e.sugar||0),0):avgSugar*5;
  const totalSodium=hasData?wi.reduce((a,e)=>a+(e.sodium||0),0):avgSodium*5;
  const totalWater=hasData?days.reduce((a,day)=>a+(wl[day]||0),0):avgWater*7;

  const ts={contentStyle:{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,fontSize:11,fontFamily:"Inter,sans-serif",boxShadow:glow(C.lavender,0.1)},labelStyle:{color:C.text2,fontWeight:600},itemStyle:{color:C.text,fontWeight:700}};

  const funFacts=[
    {emoji:"🍕",val:(ac/285).toFixed(1),lbl:"pizza slices of energy per day",color:C.peach,why:"A standard pizza slice is ~285 kcal. Shows your intake in a tangible, relatable way."},
    {emoji:"🏃",val:Math.round(ac/70),lbl:"minutes of running to burn your daily avg",color:C.mint,why:"Running burns ~70 kcal/min for an average adult. A real sense of the movement cost."},
    {emoji:"🏊",val:Math.round(ac/6.7),lbl:"pool lengths to swim off daily calories",color:C.blue,why:"Each 25m pool length burns ~6.7 kcal. Swimming is a great calorie benchmark."},
    {emoji:"🍫",val:(totalSugar/22).toFixed(1),lbl:"chocolate bars worth of sugar this week",color:C.pink,why:"A standard bar has ~22g sugar. Seeing your weekly sugar in bar form makes it real."},
    {emoji:"🥄",val:Math.round(totalSugar/4.2),lbl:"teaspoons of sugar this week",color:C.red,why:"4.2g per teaspoon. Most people are stunned to see their sugar this way."},
    {emoji:"📱",val:Math.round((ac*4184)/3600000*30),lbl:"phone charges your daily calories could power",color:C.lavender,why:"A phone charge uses ~0.012 kWh. Your calories as kilowatt-hours is mind-bending."},
    {emoji:"🚗",val:Math.round(ac/32),lbl:"miles a small car could drive on your intake",color:C.yellow,why:"~32 miles per 2,000 kcal equivalent. Your food as fuel — literally."},
    {emoji:"🍩",val:(ac/300).toFixed(1),lbl:"glazed donuts of energy per day",color:C.peach,why:"A glazed donut is ~300 kcal. A fun way to see intake without judgement."},
    {emoji:"🧈",val:Math.round(avgF/11),lbl:"tablespoons of butter worth of fat per day",color:C.yellow,why:"1 tbsp butter = ~11g fat. Puts your fat intake in kitchen terms you can picture."},
    {emoji:"🥑",val:(totalProtein/3).toFixed(0),lbl:"avocados worth of protein this week",color:C.mint,why:"An avocado has ~3g protein. A positive, healthy way to frame protein intake."},
    {emoji:"🫙",val:Math.round(totalWater*0.237/0.5),lbl:"500ml water bottles drank this week",color:C.blue,why:"Converts cups to bottles — the format most people buy water in."},
    {emoji:"⚡",val:((ac*4184)/3600000).toFixed(2),lbl:"kWh of energy per day — like 30 phone charges",color:C.lavender,why:"Food is energy. Showing it in kWh makes the physics of nutrition click."},
    {emoji:"🎂",val:(ac/350).toFixed(1),lbl:"slices of birthday cake per day in energy",color:C.pink,why:"A cake slice is ~350 kcal. Fun framing without being preachy about it."},
    {emoji:"🚴",val:Math.round(ac/40),lbl:"minutes of cycling to burn your daily avg",color:C.mint,why:"Cycling burns ~40 kcal/min. A second exercise comparison alongside running."},
    {emoji:"🌍",val:(totalSodium/1000).toFixed(1)+"g",lbl:"total sodium by weight this week",color:C.blue,why:"Most people eat 3-4 teaspoons of pure salt weekly without realising it."},
    {emoji:"👟",val:(Math.round(ac*20)).toLocaleString(),lbl:"steps equivalent of your daily calories",color:C.mint,why:"~0.05 kcal per step. Your intake expressed as the walking equivalent."},
  ];

  return(
    <div>
      <div style={{padding:"56px 20px 16px",background:`linear-gradient(180deg,${C.surface} 0%,transparent 100%)`}}>
        <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:28,fontWeight:700,letterSpacing:"-0.03em",background:`linear-gradient(135deg,${C.lavLt},${C.mintLt})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Analytics ✦</div>
        <div style={{fontSize:14,color:C.text2,marginTop:4,fontFamily:"Inter,sans-serif"}}>Your nutrition, illustrated</div>
        {!hasData&&<div style={{marginTop:8,padding:"8px 12px",background:`${C.yellow}10`,border:`1px solid ${C.yellow}30`,borderRadius:12,fontSize:12,color:C.yellow,fontFamily:"Inter,sans-serif"}}>✦ Showing sample data — log meals on Today to see your real numbers</div>}
      </div>

      <div style={{padding:"0 20px"}}>
        {streak>0&&<div style={{background:`${C.peach}10`,border:`1px solid ${C.peach}25`,borderRadius:20,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,marginBottom:12,boxShadow:glow(C.peach,0.08)}}><div style={{fontSize:28}}>🔥</div><div><div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:20,fontWeight:700,color:C.peach}}>{streak} day streak</div><div style={{fontSize:12,color:C.text2,marginTop:2,fontFamily:"Inter,sans-serif"}}>Keep logging to maintain it</div></div></div>}

        {/* REPORT CARD */}
        <ChartCard title="📋 This week's report card" sub="A–F grade across every nutrition target — aims to give you an honest snapshot of your week" accent={C.lavender} isDemo={!hasData}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {grades.map((g,i)=><div key={i} style={{background:C.surface2,borderRadius:14,padding:"12px 8px",textAlign:"center",border:`1px solid ${C.border}`}}><div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:28,fontWeight:700,lineHeight:1,color:{A:C.mint,B:C.blue,C:C.yellow,D:C.peach,F:C.red}[g.grade],textShadow:`0 0 12px ${{A:C.mint,B:C.blue,C:C.yellow,D:C.peach,F:C.red}[g.grade]}50`}}>{g.grade}</div><div style={{fontSize:10,color:C.text2,marginTop:4,fontFamily:"Inter,sans-serif"}}>{g.label}</div></div>)}
          </div>
          <div style={{marginTop:10,fontSize:11,color:C.text3,fontFamily:"Inter,sans-serif",lineHeight:1.5}}>Grades update as you log. A = on target · F = needs work. Try to get every column glowing green.</div>
        </ChartCard>

        {/* CALORIE AREA */}
        <ChartCard title="📈 Calories — last 7 days" sub={`Track against your ${goals.cal.toLocaleString()} kcal goal. Consistency over perfection — one bad day doesn't define a week.`} accent={C.lavender} isDemo={!hasData}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={calData} margin={{top:5,right:5,bottom:0,left:-20}}>
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.lavender} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={C.lavender} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
              <XAxis dataKey="name" tick={{fill:C.text3,fontSize:11,fontFamily:"Inter,sans-serif"}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.text3,fontSize:11,fontFamily:"Inter,sans-serif"}} axisLine={false} tickLine={false}/>
              <Tooltip {...ts} formatter={(v,n)=>[`${Math.round(v)} kcal`,n]}/>
              <ReferenceLine y={goals.cal} stroke={C.mint} strokeDasharray="5 5" strokeWidth={1.5} label={{value:"Goal",position:"insideTopRight",fill:C.mint,fontSize:9,fontWeight:700}}/>
              <Area type="monotone" dataKey="Calories" stroke={C.lavender} strokeWidth={2.5} fill="url(#cg)" dot={{fill:C.lavender,strokeWidth:0,r:3}} activeDot={{r:5,fill:C.lavLt}}/>
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* RADAR */}
        <ChartCard title="🕸️ Nutrition balance score" sub="Six key nutrients scored 0–100. The closer to the outer edge, the better. A perfect hexagon = a perfect week." accent={C.mint} isDemo={!hasData}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <ResponsiveContainer width={180} height={180}>
              <RadarChart data={radarData}>
                <PolarGrid stroke={C.border}/>
                <PolarAngleAxis dataKey="subject" tick={{fill:C.text2,fontSize:10,fontFamily:"Inter,sans-serif"}}/>
                <Radar name="Score" dataKey="A" stroke={C.mint} fill={C.mint} fillOpacity={0.15} strokeWidth={2}/>
                <Tooltip {...ts} formatter={v=>[`${Math.round(v)}%`]}/>
              </RadarChart>
            </ResponsiveContainer>
            <div style={{flex:1}}>
              <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:44,fontWeight:700,color:overallScore>=80?C.mint:overallScore>=60?C.blue:overallScore>=40?C.yellow:C.red,lineHeight:1,textShadow:`0 0 20px ${overallScore>=80?C.mint:overallScore>=60?C.blue:C.yellow}40`}}>{overallScore}</div>
              <div style={{fontSize:11,color:C.text2,marginTop:4,fontFamily:"Inter,sans-serif"}}>/100 this week</div>
              <div style={{fontSize:11,color:C.text2,marginTop:8,lineHeight:1.5,fontFamily:"Inter,sans-serif"}}>{overallScore>=80?"🌟 Excellent week!":overallScore>=60?"👍 Pretty solid — keep it up":overallScore>=40?"📈 A few spots to work on":"💪 Every day is a fresh start"}</div>
            </div>
          </div>
        </ChartCard>

        {/* MACRO DONUT */}
        <ChartCard title="🥧 Macro split this week" sub="Where your calories actually come from. You need all three — protein builds, carbs fuel, fat supports hormones." accent={C.peach} isDemo={!hasData}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={macroDonut} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={4} dataKey="value" strokeWidth={0}>
                  {macroDonut.map((m,i)=><Cell key={i} fill={m.color}/>)}
                </Pie>
                <Tooltip {...ts} formatter={v=>[`${v} kcal`]}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {macroDonut.map((m,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:3,background:m.color,flexShrink:0,boxShadow:`0 0 6px ${m.color}80`}}/><div style={{fontSize:12,color:C.text2,fontFamily:"Inter,sans-serif"}}>{m.name}</div><div style={{fontSize:12,fontWeight:700,color:C.text,marginLeft:"auto",fontFamily:"Space Grotesk,sans-serif"}}>{m.value}</div></div>)}
              <div style={{fontSize:10,color:C.text3,marginTop:4,fontFamily:"Inter,sans-serif"}}>kcal / day avg</div>
            </div>
          </div>
        </ChartCard>

        {/* MEAL TIMING */}
        <ChartCard title="🕐 When you eat" sub="Your meal distribution this week. Regular meals help maintain blood sugar and prevent overeating later in the day." accent={C.yellow} isDemo={!hasData}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={mealData} cx="50%" cy="50%" outerRadius={62} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {mealData.map((m,i)=><Cell key={i} fill={m.color}/>)}
                </Pie>
                <Tooltip {...ts} formatter={(v,n)=>[`${v} meals`,n]}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {mealData.map((m,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:99,background:m.color,flexShrink:0,boxShadow:`0 0 6px ${m.color}80`}}/><div style={{fontSize:12,color:C.text2,fontFamily:"Inter,sans-serif"}}>{m.name}</div><div style={{fontSize:12,fontWeight:700,color:C.text,marginLeft:"auto",fontFamily:"Space Grotesk,sans-serif"}}>{m.value}×</div></div>)}
            </div>
          </div>
        </ChartCard>

        {/* SUGAR VS FIBRE */}
        <ChartCard title="🆚 Sugar vs Fibre showdown" sub="Two nutrients most people get backwards — eating 4× too much sugar and half the fibre they need. Where do you land?" accent={C.pink} isDemo={!hasData}>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={sfData} margin={{top:5,right:5,bottom:0,left:-20}} barGap={4} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
              <XAxis dataKey="name" tick={{fill:C.text3,fontSize:11,fontFamily:"Inter,sans-serif"}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.text3,fontSize:11,fontFamily:"Inter,sans-serif"}} axisLine={false} tickLine={false}/>
              <Tooltip {...ts} formatter={(v,n)=>[`${v}g`,n==="Yours"?"Your daily avg":"Your goal"]}/>
              <Bar dataKey="Yours" name="Yours" radius={[6,6,0,0]}>{sfData.map((e,i)=><Cell key={i} fill={[C.red,C.mint][i]}/>)}</Bar>
              <Bar dataKey="Goal" name="Goal" radius={[6,6,0,0]}>{sfData.map((e,i)=><Cell key={i} fill={[`${C.red}25`,`${C.mint}25`][i]}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:8,marginTop:8}}>
            {avgSugar>goals.sugar?<div style={{flex:1,padding:"7px 10px",background:`${C.red}10`,border:`1px solid ${C.red}30`,borderRadius:10,fontSize:11,color:C.red,fontWeight:600,fontFamily:"Inter,sans-serif"}}>🍬 Sugar {Math.round((avgSugar/goals.sugar-1)*100)}% over</div>:<div style={{flex:1,padding:"7px 10px",background:`${C.mint}10`,border:`1px solid ${C.mint}30`,borderRadius:10,fontSize:11,color:C.mint,fontWeight:600,fontFamily:"Inter,sans-serif"}}>✅ Sugar within goal</div>}
            {avgFibre<goals.fibre?<div style={{flex:1,padding:"7px 10px",background:`${C.red}10`,border:`1px solid ${C.red}30`,borderRadius:10,fontSize:11,color:C.red,fontWeight:600,fontFamily:"Inter,sans-serif"}}>🌿 Fibre {Math.round((1-avgFibre/goals.fibre)*100)}% below</div>:<div style={{flex:1,padding:"7px 10px",background:`${C.mint}10`,border:`1px solid ${C.mint}30`,borderRadius:10,fontSize:11,color:C.mint,fontWeight:600,fontFamily:"Inter,sans-serif"}}>✅ Fibre goal hit!</div>}
          </div>
        </ChartCard>

        {/* WATER */}
        <ChartCard title="💧 Water — last 7 days" sub={`Even mild dehydration tanks focus, energy, and metabolism. Hit ${goals.water||8} cups daily for optimal function.`} accent={C.blue} isDemo={!hasData}>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={waterData} margin={{top:5,right:5,bottom:0,left:-20}} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
              <XAxis dataKey="name" tick={{fill:C.text3,fontSize:11,fontFamily:"Inter,sans-serif"}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.text3,fontSize:11,fontFamily:"Inter,sans-serif"}} axisLine={false} tickLine={false}/>
              <Tooltip {...ts} formatter={(v,n)=>[`${v} cups`,n]}/>
              <ReferenceLine y={goals.water||8} stroke={C.blue} strokeDasharray="4 4" strokeWidth={1.5}/>
              <Bar dataKey="Cups" radius={[6,6,0,0]}>{waterData.map((e,i)=><Cell key={i} fill={e.Cups>=(goals.water||8)?C.blue:`${C.blue}40`}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* RADIAL GAUGE */}
        <ChartCard title="🎯 Weekly calorie dial" sub="How close your daily average lands to your target. The fuller the arc the more consistent you've been." accent={C.lavender} isDemo={!hasData}>
          <div style={{display:"flex",alignItems:"center",gap:20}}>
            <ResponsiveContainer width={160} height={160}>
              <RadialBarChart cx="50%" cy="50%" innerRadius={45} outerRadius={70} data={[{name:"eaten",value:Math.min((ac/goals.cal)*100,100),fill:ac>goals.cal?C.red:C.lavender}]} startAngle={210} endAngle={-30}>
                <PolarGrid stroke="none"/>
                <RadialBar dataKey="value" cornerRadius={10} background={{fill:C.surface2}}/>
              </RadialBarChart>
            </ResponsiveContainer>
            <div>
              <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:32,fontWeight:700,color:ac>goals.cal?C.red:C.lavLt,lineHeight:1,textShadow:`0 0 16px ${ac>goals.cal?C.red:C.lavender}40`}}>{Math.round(ac).toLocaleString()}</div>
              <div style={{fontSize:11,color:C.text2,marginTop:4,fontFamily:"Inter,sans-serif"}}>avg kcal / day</div>
              <div style={{fontSize:10,color:C.text3,marginTop:4,fontFamily:"Inter,sans-serif"}}>vs {goals.cal.toLocaleString()} goal</div>
              <div style={{fontSize:11,color:ac>goals.cal?C.red:C.mint,marginTop:6,fontWeight:600,fontFamily:"Space Grotesk,sans-serif"}}>{ac>goals.cal?`+${Math.round(ac-goals.cal)} over`:`-${Math.round(goals.cal-ac)} under`}</div>
            </div>
          </div>
        </ChartCard>

        {/* TOP FOODS */}
        <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:C.text3,marginBottom:10,fontFamily:"Space Grotesk,sans-serif"}}>🏆 Most logged this week {!hasData&&<span style={{color:C.yellow,fontSize:9,fontWeight:500}}>(sample)</span>}</div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
          {topFoods.map((f,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"12px 14px"}}>
              <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:16,fontWeight:700,color:C.lavLt,width:24,flexShrink:0}}>{["🥇","🥈","🥉","4","5"][i]}</div>
              <div style={{fontSize:20}}>{f.emoji}</div>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"Space Grotesk,sans-serif",color:C.text}}>{f.name}</div><div style={{fontSize:11,color:C.text2,fontFamily:"Inter,sans-serif"}}>Logged {f.count}× this week</div></div>
              <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:14,fontWeight:700,color:C.lavLt}}>{Math.round(f.totalCal/f.count)} kcal avg</div>
            </div>
          ))}
        </div>

        {/* FUN FACTS */}
        <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:C.text3,marginBottom:10,fontFamily:"Space Grotesk,sans-serif"}}>🎉 Your week in fun facts {!hasData&&<span style={{color:C.yellow,fontSize:9,fontWeight:500}}>(sample)</span>}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          {funFacts.map((c,i)=>(
            <div key={i} style={{background:C.surface,border:`1px solid ${c.color}18`,borderRadius:20,padding:14,textAlign:"center",boxShadow:glow(c.color,0.06)}}>
              <div style={{fontSize:26,marginBottom:8}}>{c.emoji}</div>
              <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:20,fontWeight:700,color:c.color,lineHeight:1,textShadow:`0 0 10px ${c.color}40`}}>{c.val}</div>
              <div style={{fontSize:10,color:C.text2,marginTop:5,lineHeight:1.4,fontFamily:"Inter,sans-serif"}}>{c.lbl}</div>
              <div style={{fontSize:9,color:C.text3,marginTop:6,lineHeight:1.4,fontFamily:"Inter,sans-serif",fontStyle:"italic",borderTop:`1px solid ${C.border}`,paddingTop:6}}>{c.why}</div>
            </div>
          ))}
        </div>

        {/* WEEKLY STORY */}
        <div style={{background:`linear-gradient(135deg,${C.lavender}08,${C.mint}04)`,border:`1px solid ${C.lavender}20`,borderRadius:20,padding:18,marginBottom:20,boxShadow:glow(C.lavender,0.06)}}>
          <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:15,fontWeight:700,color:C.lavLt,marginBottom:10}}>📖 Your week in one paragraph {!hasData&&<span style={{color:C.yellow,fontSize:10,fontWeight:500}}>(sample)</span>}</div>
          <div style={{fontSize:13,color:C.text2,lineHeight:1.8,fontFamily:"Inter,sans-serif"}}>
            This week you consumed roughly <strong style={{color:C.text}}>{Math.round(tc).toLocaleString()} calories</strong> across {d} logged day{d!==1?"s":""}, averaging <strong style={{color:C.lavLt}}>{Math.round(ac).toLocaleString()} kcal per day</strong> against your {goals.cal.toLocaleString()} kcal goal.
            Protein averaged <strong style={{color:C.peach}}>{Math.round(avgP)}g/day</strong> — {avgP>=goals.protein?"above":"below"} your {goals.protein}g target.
            Sugar came in at <strong style={{color:C.red}}>{Math.round(avgSugar)}g/day</strong> {avgSugar>goals.sugar?`(${Math.round(avgSugar-goals.sugar)}g over goal)`:"(within goal)"} and fibre at <strong style={{color:C.mint}}>{Math.round(avgFibre)}g/day</strong> {avgFibre>=goals.fibre?"(goal achieved ✦)":"(try more veg and legumes)"}.
            You averaged <strong style={{color:C.blue}}>{avgWater.toFixed(1)} cups of water per day</strong>.
            {streak>0?` You're on a ${streak}-day logging streak — keep it going! 🔥`:" Start logging consistently to see your real numbers here."}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── GOALS PAGE ─────────────────────────────────────────────────────
function GoalsPage({showToast}){
  const [goals,setGoals]=useState(getGoals);
  const upd=(k,v)=>setGoals(g=>({...g,[k]:v}));
  const save=()=>{localStorage.setItem(GOALS_KEY,JSON.stringify(goals));showToast("✦ Goals saved");};
  const clearAll=()=>{if(!confirm("Clear all meals, water and history?"))return;localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(WATER_KEY);showToast("All data cleared");};
  const exportData=()=>{const data={log:getLog(),goals,water:getWaterLog(),exported:new Date().toISOString()};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`nourish-backup-${todayKey()}.json`;a.click();URL.revokeObjectURL(url);showToast("✦ Backup downloaded");};
  const importData=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>{try{const data=JSON.parse(ev.target.result);if(data.log)saveLog(data.log);if(data.goals)localStorage.setItem(GOALS_KEY,JSON.stringify(data.goals));if(data.water)saveWaterLog(data.water);showToast("✦ Data restored");}catch{showToast("Could not read file");}};r.readAsText(file);e.target.value="";};
  const fields=[{k:"protein",l:"Protein",u:"g",s:"Builds and repairs muscle"},{k:"carbs",l:"Carbohydrates",u:"g",s:""},{k:"fat",l:"Fat",u:"g",s:""},{k:"fibre",l:"Fibre",u:"g",s:"Most Americans get half what they need"},{k:"sugar",l:"Added Sugar",u:"g",s:"WHO recommends under 25g daily"},{k:"sodium",l:"Sodium",u:"mg",s:"Goal 2,300mg — avg American eats 3,400mg"},{k:"water",l:"Water",u:"cups",s:"8 cups (64oz) is the standard daily goal"}];
  return(
    <div>
      <div style={{padding:"56px 20px 16px",background:`linear-gradient(180deg,${C.surface} 0%,transparent 100%)`}}>
        <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:28,fontWeight:700,letterSpacing:"-0.03em",background:`linear-gradient(135deg,${C.lavLt},${C.mintLt})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Goals ✦</div>
        <div style={{fontSize:14,color:C.text2,marginTop:4,fontFamily:"Inter,sans-serif"}}>Your daily targets</div>
      </div>
      <div style={{padding:"0 20px 20px"}}>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:C.text3,marginBottom:10,fontFamily:"Space Grotesk,sans-serif"}}>Backup your data</div>
          <p style={{fontSize:13,color:C.text2,marginBottom:12,lineHeight:1.6,fontFamily:"Inter,sans-serif"}}>Your data lives on this device only. Export regularly so you never lose your history.</p>
          <div style={{display:"flex",gap:10,marginBottom:20}}>
            <button onClick={exportData} style={{flex:1,padding:12,borderRadius:12,fontSize:13,fontWeight:600,fontFamily:"Inter,sans-serif",cursor:"pointer",border:`1px solid ${C.border}`,background:C.surface2,color:C.text2}}>📥 Export</button>
            <label style={{flex:1,padding:12,borderRadius:12,fontSize:13,fontWeight:600,fontFamily:"Inter,sans-serif",cursor:"pointer",border:`1px solid ${C.border}`,background:C.surface2,color:C.text2,display:"flex",alignItems:"center",justifyContent:"center"}}>📤 Import<input type="file" accept=".json" style={{display:"none"}} onChange={importData}/></label>
          </div>
        </div>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:C.text3,marginBottom:10,fontFamily:"Space Grotesk,sans-serif"}}>Daily calorie goal</div>
        <CalGoalSetup value={goals.cal} onChange={v=>upd("cal",v)}/>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:C.text3,marginBottom:10,marginTop:8,fontFamily:"Space Grotesk,sans-serif"}}>Macro & nutrient targets</div>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:"4px 16px",marginBottom:4}}>
          {fields.map((f,i)=><div key={f.k} style={{display:"flex",alignItems:"center",padding:"12px 0",borderBottom:i<fields.length-1?`1px solid ${C.border}`:"none",gap:12}}><div style={{flex:1}}><div style={{fontSize:14,color:C.text,fontFamily:"Space Grotesk,sans-serif",fontWeight:600}}>{f.l}</div>{f.s&&<div style={{fontSize:11,color:C.text3,marginTop:2,fontFamily:"Inter,sans-serif"}}>{f.s}</div>}</div><input type="number" value={goals[f.k]} onChange={e=>upd(f.k,Number(e.target.value))} style={{width:78,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:14,fontWeight:700,padding:"8px 10px",textAlign:"right",fontFamily:"Space Grotesk,sans-serif",outline:"none"}}/><div style={{fontSize:12,color:C.text2,width:28,fontFamily:"Inter,sans-serif"}}>{f.u}</div></div>)}
        </div>
        <button onClick={save} style={{width:"100%",marginTop:12,padding:14,background:`linear-gradient(135deg,${C.lavender},${C.pink})`,border:"none",borderRadius:14,color:"white",fontSize:15,fontWeight:700,fontFamily:"Space Grotesk,sans-serif",cursor:"pointer",boxShadow:glow(C.lavender,0.35)}}>Save goals ✦</button>
        <div style={{marginTop:28,paddingTop:20,borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:C.text3,marginBottom:10,fontFamily:"Space Grotesk,sans-serif"}}>Danger zone</div>
          <button onClick={clearAll} style={{width:"100%",padding:12,background:`${C.red}08`,border:`1px solid ${C.red}25`,borderRadius:12,color:C.red,fontSize:14,fontWeight:600,fontFamily:"Inter,sans-serif",cursor:"pointer"}}>Clear all data</button>
        </div>
        <div style={{marginTop:28,paddingTop:24,borderTop:`1px solid ${C.border}`,textAlign:"center"}}>
          <div style={{fontSize:12,color:C.text3,lineHeight:1.7,fontFamily:"Inter,sans-serif"}}>Free to use. Free forever.<br/>If Nourish helped you eat better, a small tip keeps it going.</div>
          <a href="YOUR_TIP_JAR_LINK" target="_blank" rel="noreferrer" style={{display:"inline-block",marginTop:12,padding:"8px 20px",borderRadius:99,background:`${C.lavender}12`,border:`1px solid ${C.lavender}25`,color:C.lavLt,fontSize:13,fontWeight:600,textDecoration:"none",fontFamily:"Space Grotesk,sans-serif",boxShadow:glow(C.lavender,0.12)}}>☕ Send a tip ✦</a>
          <div style={{marginTop:16,fontSize:11,color:C.text3,lineHeight:1.7,fontFamily:"Inter,sans-serif"}}>Nourish provides estimated nutritional information for general awareness only. Values are AI-generated approximations. Not medical or dietary advice. Consult a healthcare professional before making dietary changes.</div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────────
export default function App(){
  const [page,setPage]        =useState("today");
  const [showDisc,setShowDisc]=useState(!localStorage.getItem(DISC_KEY));
  const [toast,setToast]      =useState("");
  const timer                 =useRef(null);
  const showToast=useCallback((msg,dur=2500)=>{setToast(msg);clearTimeout(timer.current);timer.current=setTimeout(()=>setToast(""),dur);},[]);

  const nav=[
    {id:"today",label:"Today",icon:<svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>},
    {id:"history",label:"History",icon:<svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>},
    {id:"charts",label:"Charts",icon:<svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>},
    {id:"goals",label:"Goals",icon:<svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>},
  ];

  return(
    <div style={{fontFamily:"Inter,sans-serif",background:C.bg,color:C.text,minHeight:"100vh",maxWidth:480,margin:"0 auto",paddingBottom:90,WebkitFontSmoothing:"antialiased"}}>
      {showDisc&&<Disclaimer onAgree={()=>{localStorage.setItem(DISC_KEY,"1");setShowDisc(false);}}/>}
      <Toast msg={toast}/>
      {page==="today"  &&<TodayPage   showToast={showToast}/>}
      {page==="history"&&<HistoryPage/>}
      {page==="charts" &&<ChartsPage/>}
      {page==="goals"  &&<GoalsPage   showToast={showToast}/>}
      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:`rgba(22,13,36,0.96)`,backdropFilter:"blur(20px)",borderTop:`1px solid ${C.lavender}20`,display:"flex",zIndex:100,padding:"8px 0 8px"}}>
        {nav.map(n=>(
          <button key={n.id} onClick={()=>setPage(n.id)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"8px 0",background:"none",border:"none",color:page===n.id?C.lavLt:C.text3,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:10,fontWeight:page===n.id?700:500,letterSpacing:"0.05em",textTransform:"uppercase",transition:"color 0.2s",filter:page===n.id?`drop-shadow(0 0 6px ${C.lavender})`:"none"}}>
            {n.icon}{n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
