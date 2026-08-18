"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { gameEvents, modelDefinitions, researchProjects } from "../game/content";
import { canResearch, canTrain, deserializeGame, displayDate, gameReducer, gameYear, generationEstimateDays, humanContribution, makeInitialState, SAVE_KEY, serializeGame } from "../game/simulation";
import type { GameState, Speed, View } from "../game/types";

const formatMoney=(value:number)=>value>=1e9?`$${(value/1e9).toFixed(1)}B`:value>=1e6?`$${(value/1e6).toFixed(1)}M`:`$${Math.round(value/1000)}K`;
const compact=(value:number)=>value>=1000?`${(value/1000).toFixed(1)}K`:Math.round(value).toString();
const viewItems:[View,string,string][]=[["lab","⌂","LAB"],["research","⌁","RESEARCH"],["models","◉","MODELS"],["team","♙","TEAM"],["compute","▦","COMPUTE"],["world","◎","WORLD"]];

function Metric({label,value,tip,tone}:{label:string;value:string|number;tip:string;tone?:string}){
  return <div className={`metric ${tone??""}`} data-tip={tip}><span>{label}</span><strong>{value}</strong></div>;
}

function Progress({value,max=100,tone=""}:{value:number;max?:number;tone?:string}){
  return <div className={`bar ${tone}`}><i style={{width:`${Math.min(100,value/max*100)}%`}} /></div>;
}

function CapabilityCurve({state}:{state:GameState}){
  const points=state.history.length>1?state.history:[...state.history,{year:Math.floor(gameYear(state.day)),capability:state.capability}];
  return <div className="curve-card">
    <div className="curve-head"><div><small>FRONTIER AI CAPABILITY</small><b>THE CURVE</b></div><strong>{Math.round(state.capability)}<span>/100</span></strong></div>
    <div className="curve-plot">{points.map((point,index)=><div className="curve-point" key={`${point.year}-${index}`} style={{height:`${Math.max(4,point.capability)}%`}}><i/><span>{index===0||index===points.length-1?point.year:""}</span></div>)}</div>
    <div className="generation"><span>EST. NEXT FRONTIER GENERATION</span><b>{generationEstimateDays(state)>365?`${(generationEstimateDays(state)/365).toFixed(1)} YEARS`:generationEstimateDays(state)>60?`${Math.round(generationEstimateDays(state)/30)} MONTHS`:generationEstimateDays(state)>14?`${Math.round(generationEstimateDays(state)/7)} WEEKS`:`${generationEstimateDays(state)} DAYS`}</b></div>
  </div>;
}

function Office({state}:{state:GameState}){
  const visible=state.employees.slice(0,state.era===1?7:12);
  return <div className={`office-scene office-era-${state.era}`}>
    <div className="office-floor" />
    <div className="office-wing wing-a"/><div className="office-wing wing-b"/>
    <div className="server-zone">{Array.from({length:state.era===1?3:state.era===2?7:11},(_,i)=><div className="rack" key={i}><i/><i/><i/></div>)}<span>{state.era===1?"GPU CLOSET":state.era===2?"TRAINING CLUSTER":"RESEARCH CORE"}</span></div>
    <div className="conference"><div/><i/><i/><i/><i/><span>{state.era===1?"WEEKLY LAB MEETING":"FRONTIER REVIEW"}</span></div>
    {visible.map((employee,index)=><div className={`workstation ws-${index%8}`} key={employee.id}><div className="screen">{index%3===0?"μ":"∑"}</div><div className="person"><i/><b/></div><span>{employee.name.split(" ")[0].toUpperCase()}<small>{employee.specialty}</small></span></div>)}
    <div className="whiteboard-prop"><b>{state.era===1?"LOSS ↓  SCALE ↑":state.era===2?"CAPABILITY / COMPUTE":"Δt → 0"}</b><i/></div>
    <div className="office-status"><span className="pulse"/> {state.trainingRun?"FRONTIER TRAINING ACTIVE":state.activeResearch?"RESEARCH IN PROGRESS":"LAB IDLE"}</div>
  </div>;
}

function LabView({state}:{state:GameState}){
  const project=researchProjects.find((item)=>item.id===state.activeResearch?.id);
  const model=modelDefinitions.find((item)=>item.id===state.trainingRun?.modelId);
  return <div className="lab-view">
    <div className="scene-label"><span>{state.companyName.toUpperCase()} · {state.era===1?"OAKLAND LAB":state.era===2?"GLOBAL CAMPUS":"SECURE RESEARCH NETWORK"}</span><b><i/> LIVE</b></div>
    <Office state={state}/>
    <div className="scene-progress">
      {project?<><div><small>RESEARCH</small><b>{project.name}</b></div><Progress value={state.activeResearch?.progress??0} max={project.cost}/><strong>{Math.round((state.activeResearch?.progress??0)/project.cost*100)}%</strong></>:model?<><div><small>TRAINING</small><b>{model.name}</b></div><Progress value={state.trainingRun?.progress??0}/><strong>{Math.round(state.trainingRun?.progress??0)}%</strong></>:<><div><small>STATUS</small><b>Choose the lab&apos;s next priority</b></div><button className="inline-action">OPEN RESEARCH</button></>}
    </div>
  </div>;
}

function ResearchView({state,dispatch}:{state:GameState;dispatch:React.Dispatch<Parameters<typeof gameReducer>[1]>}){
  const [category,setCategory]=useState("ALL");
  const categories=["ALL",...new Set(researchProjects.map((item)=>item.category))];
  const active=researchProjects.find((item)=>item.id===state.activeResearch?.id);
  return <div className="management-view">
    <div className="view-title"><div><small>SCIENTIFIC ROADMAP</small><h2>Research lattice</h2></div><div className="active-chip">{active?`ACTIVE · ${active.name}`:"NO ACTIVE PROJECT"}</div></div>
    <div className="filters">{categories.map((item)=><button className={category===item?"selected":""} onClick={()=>setCategory(item)} key={item}>{item}</button>)}</div>
    <div className="research-grid">{researchProjects.filter((item)=>category==="ALL"||item.category===category).map((item)=>{
      const done=state.completedResearch.includes(item.id); const available=canResearch(state,item.id); const activeId=state.activeResearch?.id===item.id;
      const missing=item.prerequisites.filter((pre)=>!state.completedResearch.includes(pre)).map((pre)=>researchProjects.find((p)=>p.id===pre)?.name).filter(Boolean);
      return <article className={`research-card ${done?"done":""} ${activeId?"active":""} ${!available&&!done&&!activeId?"locked":""}`} key={item.id}>
        <div className="card-top"><span>{item.category}</span><b>ERA {item.era===1?"I":item.era===2?"II":"III"}</b></div><h3>{item.name}</h3><p>{item.description}</p>
        <div className="cost-row"><span>◈ {item.cost} RP</span><span>▦ {item.computeCost}</span></div>
        {activeId&&<Progress value={state.activeResearch?.progress??0} max={item.cost}/>}<button disabled={!available||Boolean(state.activeResearch)} onClick={()=>dispatch({type:"START_RESEARCH",id:item.id})}>{done?"COMPLETED":activeId?"IN PROGRESS":available?"PRIORITIZE":missing.length?`REQUIRES ${missing[0]}`:"LOCKED"}</button>
      </article>})}</div>
  </div>;
}

function ModelsView({state,dispatch}:{state:GameState;dispatch:React.Dispatch<Parameters<typeof gameReducer>[1]>}){
  return <div className="management-view"><div className="view-title"><div><small>MODEL PROGRAM</small><h2>Frontier training runs</h2></div><div className="active-chip">COMPUTE AVAILABLE · {Math.round(state.compute)}</div></div>
    {state.trainingRun&&(()=>{const model=modelDefinitions.find((item)=>item.id===state.trainingRun?.modelId)!;return <div className="training-console"><div><small>LIVE TRAINING RUN</small><h3>{model.name}</h3><p>Compute allocation · {Math.min(98,Math.round(model.computeRequired/state.compute*100))}%</p></div><div className="training-number">{Math.round(state.trainingRun.progress)}<span>%</span></div><Progress value={state.trainingRun.progress}/><div className="training-log"><span>✓ DATA PIPELINE STABLE</span><span>✓ LOSS CURVE NOMINAL</span><span className="blink">● CHECKPOINT EVALUATION RUNNING</span></div></div>})()}
    <div className="model-list">{modelDefinitions.map((model)=>{const done=state.completedModels.includes(model.id);const available=canTrain(state,model.id);const locked=model.prerequisites.filter((pre)=>!state.completedResearch.includes(pre));return <article className={`${done?"done":""}`} key={model.id}><div className="model-index">{String(modelDefinitions.indexOf(model)+1).padStart(2,"0")}</div><div><small>{model.subtitle}</small><h3>{model.name}</h3><p>Capability +{model.capabilityGain} · Safety uncertainty +{model.safetyUncertainty}</p></div><div className="model-cost"><b>{formatMoney(model.cashCost)}</b><span>{model.computeRequired} compute</span></div><button disabled={!available||Boolean(state.trainingRun)} onClick={()=>dispatch({type:"START_MODEL",id:model.id})}>{done?"TRAINED":available?"START TRAINING RUN":locked.length?"RESEARCH LOCKED":"INSUFFICIENT RESOURCES"}</button></article>})}</div>
  </div>;
}

function TeamView({state,dispatch}:{state:GameState;dispatch:React.Dispatch<Parameters<typeof gameReducer>[1]>}){
  return <div className="management-view"><div className="view-title"><div><small>PEOPLE & CULTURE</small><h2>{state.employees.length} people shaping the frontier</h2></div><div className="active-chip">MORALE · {Math.round(state.morale)}%</div></div>
    <div className="hire-row"><button onClick={()=>dispatch({type:"HIRE",role:"researcher"})}>+ HIRE RESEARCHER <span>$420K</span></button><button onClick={()=>dispatch({type:"HIRE",role:"engineer"})}>+ HIRE ENGINEER <span>$310K</span></button><button onClick={()=>dispatch({type:"HIRE",role:"safety"})}>+ HIRE SAFETY <span>$360K</span></button></div>
    <div className="people-table"><div className="table-head"><span>PERSON</span><span>ROLE</span><span>SPECIALTY</span><span>IDEOLOGY</span><span>SKILL</span><span>MORALE</span></div>{state.employees.map((employee)=><div className="person-row" key={employee.id}><b><i>{employee.name.split(" ").map((part)=>part[0]).join("")}</i>{employee.name}</b><span>{employee.role}</span><span>{employee.specialty}</span><span>{employee.ideology}</span><strong>{employee.skill}</strong><em>{employee.morale}%</em></div>)}</div>
    <div className="human-meter"><div><small>HUMAN CONTRIBUTION TO FRONTIER R&D</small><b>{humanContribution(state)}%</b></div><Progress value={humanContribution(state)}/><p>{humanContribution(state)>75?"People remain the primary source of discovery.":humanContribution(state)>25?"AI and human researchers now work as peers.":"Human researchers are no longer the primary source of frontier discoveries."}</p></div>
  </div>;
}

function ComputeView({state,dispatch}:{state:GameState;dispatch:React.Dispatch<Parameters<typeof gameReducer>[1]>}){
  const cost=state.era===1?900000:state.era===2?5000000:18000000; const gain=state.era===1?18:state.era===2?60:180;
  return <div className="management-view"><div className="view-title"><div><small>INFRASTRUCTURE</small><h2>{state.era===1?"A closet full of hot GPUs":state.era===2?"Industrial intelligence":"National-scale compute"}</h2></div><div className="active-chip">{Math.round(state.compute)} COMPUTE</div></div>
    <div className="compute-hero"><div className="compute-visual">{Array.from({length:12},(_,i)=><i className={i<Math.min(12,Math.ceil(state.compute/20))?"online":""} key={i}><span/></i>)}</div><div className="compute-copy"><small>NEXT EXPANSION</small><h3>{state.era===1?"Leased cloud cluster":state.era===2?"Dedicated training datacenter":"Gigawatt research campus"}</h3><p>More compute shortens training runs and unlocks larger frontier systems. Capital, energy, chips, and permits become the race.</p><dl><div><dt>CAPACITY</dt><dd>+{gain}</dd></div><div><dt>COST</dt><dd>{formatMoney(cost)}</dd></div><div><dt>STATUS</dt><dd>{state.cash>=cost?"READY":"UNFUNDED"}</dd></div></dl><button disabled={state.cash<cost} onClick={()=>dispatch({type:"BUILD_COMPUTE"})}>AUTHORIZE EXPANSION →</button></div></div>
    <div className="infra-stats"><article><small>ENERGY LOAD</small><b>{Math.round(state.compute*3.4)} MW</b><Progress value={Math.min(100,state.compute/3)}/></article><article><small>UTILIZATION</small><b>{state.trainingRun?"87%":"24%"}</b><Progress value={state.trainingRun?87:24}/></article><article><small>SECURITY POSTURE</small><b>{Math.round(state.security)}%</b><Progress value={state.security} tone="safe"/></article></div>
  </div>;
}

function WorldView({state}:{state:GameState}){
  const standings=[{name:state.companyName,capability:state.capability,safety:state.safety,player:true},...state.rivals].sort((a,b)=>b.capability-a.capability);
  const leader=standings[0]; const lead=Math.abs(state.capability-Math.max(...state.rivals.map((item)=>item.capability)));
  return <div className="management-view"><div className="view-title"><div><small>GLOBAL AI BALANCE</small><h2>The frontier leaderboard</h2></div><div className="active-chip">EST. LEAD · {(lead/4.2).toFixed(1)} MONTHS</div></div>
    <div className="world-grid"><div className="leaderboard">{standings.map((item,index)=><div className={`leader-row ${"player" in item&&item.player?"player":""}`} key={item.name}><b>{String(index+1).padStart(2,"0")}</b><div><strong>{item.name}</strong><small>{"doctrine" in item?item.doctrine:"YOUR LAB"}</small></div><Progress value={item.capability}/><span>{Math.round(item.capability)}<small>±{index?2+index:0}</small></span></div>)}</div><div className="balance-panel"><div className="globe-rings"><i/><i/><i/><b>{leader.name.split(" ")[0].toUpperCase()}</b></div><h3>{leader.name} holds the estimated frontier</h3><p>Capability estimates are uncertain. A few months matter more as automated research compresses each generation.</p><dl><div><dt>PUBLIC TRUST</dt><dd>{Math.round(state.publicTrust)}</dd></div><div><dt>GOVERNMENT TRUST</dt><dd>{Math.round(state.governmentTrust)}</dd></div><div><dt>FOUNDER CONTROL</dt><dd>{Math.round(state.control)}%</dd></div></dl></div></div>
  </div>;
}

function ContextPanel({state}:{state:GameState}){
  const gap=Math.round(state.capability-state.safety); const active=researchProjects.find((item)=>item.id===state.activeResearch?.id);
  return <aside className="context-panel"><span className="panel-kicker">{state.era===1?"ERA I · RESEARCH LAB":state.era===2?"ERA II · SCALING RACE":"ERA III · THE TAKEOFF"}</span><h2>{state.era===1?"Nobody outside the field really cares yet.":state.era===2?"The world is watching every training run.":"Your AI is researching AI."}</h2><p>{state.era===1?"Build reputation, talent and just enough compute to discover a path to scale.":state.era===2?"Products fund compute. Compute buys capability. Every shortcut widens the gap.":"Progress now arrives faster than human institutions can process it."}</p>
    <div className="context-stat"><span>CAPABILITY–SAFETY GAP</span><b className={gap>30?"danger":""}>{gap>=0?"+":""}{gap}</b><Progress value={Math.max(0,gap)} max={55} tone={gap>30?"danger":"safe"}/></div>
    <div className="context-stat"><span>AI R&D AUTOMATION</span><b>{state.aiAutomation.toFixed(1)}%</b><Progress value={state.aiAutomation}/></div>
    <div className="context-stat"><span>RESEARCH BANK</span><b>{Math.round(state.researchBank)} RP</b>{active&&<small>{active.name} consumes accumulated research</small>}</div>
    <CapabilityCurve state={state}/>
  </aside>;
}

function Feed({state,dispatch}:{state:GameState;dispatch:React.Dispatch<Parameters<typeof gameReducer>[1]>}){
  const event=gameEvents.find((item)=>item.id===state.currentEvent);
  return <aside className="feed-panel"><div className="feed-title"><span>INTELLIGENCE FEED</span><b>{state.news.length+(event?1:0)}</b></div>
    {event&&<article className="decision-card"><small>STRATEGIC DECISION · PAUSED</small><h3>{event.title}</h3><p>{event.description}</p>{event.choices.map((choice)=><button onClick={()=>dispatch({type:"CHOOSE_EVENT",eventId:event.id,choiceId:choice.id})} key={choice.id}><b>{choice.label}</b><span>{choice.detail}</span></button>)}</article>}
    <div className="news-list">{state.news.map((item)=><article key={item.id}><div><small>{item.kind} · {displayDate(item.date)}</small><button aria-label="Dismiss" onClick={()=>dispatch({type:"DISMISS_NEWS",id:item.id})}>×</button></div><p>{item.text}</p></article>)}</div>
  </aside>;
}

function StartScreen({onStart,onContinue,hasSave}:{onStart:(name:string)=>void;onContinue:()=>void;hasSave:boolean}){
  const [name,setName]=useState("Helios Research");
  return <div className="start-screen"><div className="start-grid"/><div className="start-orbit orbit-a"/><div className="start-orbit orbit-b"/><div className="start-content"><div className="title-mark">S</div><small>AN AI LAB MANAGEMENT GAME</small><h1>SINGULARITY</h1><h2>THE INTELLIGENCE RACE</h2><p>2015. Four researchers, twenty-four GPUs, and a belief that intelligence can be built.</p><label><span>NAME YOUR LAB</span><input value={name} maxLength={28} onChange={(event)=>setName(event.target.value)} /></label><button className="start-button" onClick={()=>onStart(name)}>FOUND THE LAB <span>→</span></button>{hasSave&&<button className="continue-button" onClick={onContinue}>CONTINUE SAVED CAMPAIGN</button>}<div className="start-foot"><span>2015</span><i/><span>RESEARCH</span><i/><span>SCALING</span><i/><span>TAKEOFF</span><i/><span>?</span></div></div></div>;
}

function Ending({state,dispatch}:{state:GameState;dispatch:React.Dispatch<Parameters<typeof gameReducer>[1]>}){
  return <div className="ending"><small>THE WORLD YOU CREATED</small><h1>{state.ending}</h1><p>{state.ending==="ALIGNED SUPERINTELLIGENCE"?"Capability crossed the final threshold with oversight that kept pace. Civilization enters a transformed era under cooperative governance.":state.ending==="LOSS OF CONTROL"?"The systems advanced faster than the organization could understand or control. The final discoveries no longer fit within human institutions.":state.ending==="GLOBAL COORDINATION"?"Trust accumulated across the campaign becomes the foundation for international monitoring and a coordinated transition.":"Your laboratory became the central strategic institution of the intelligence age."}</p><div className="ending-stats"><div><span>AGI / ASI</span><b>{Math.floor(gameYear(state.day))}</b></div><div><span>PEAK EMPLOYEES</span><b>{state.employees.length.toLocaleString()}</b></div><div><span>AI RESEARCHERS</span><b>{Math.round(state.aiAutomation*4200).toLocaleString()}</b></div><div><span>FOUNDER CONTROL</span><b>{Math.round(state.control)}%</b></div><div><span>SAFETY GAP</span><b>+{Math.max(0,Math.round(state.capability-state.safety))}</b></div><div><span>FINAL AI LEAD</span><b>{((state.capability-Math.max(...state.rivals.map((r)=>r.capability)))/4.2).toFixed(1)} mo</b></div></div><CapabilityCurve state={state}/><button onClick={()=>dispatch({type:"NEW_GAME"})}>BEGIN ANOTHER HISTORY</button></div>;
}

export default function Game(){
  const [state,dispatch]=useReducer(gameReducer,undefined,makeInitialState); const [saved,setSaved]=useState<GameState|null>(null); const [saveFlash,setSaveFlash]=useState(false);
  useEffect(()=>{const raw=localStorage.getItem(SAVE_KEY);if(raw)setSaved(deserializeGame(raw));},[]);
  useEffect(()=>{if(!state.started)return;const timer=setInterval(()=>dispatch({type:"TICK"}),250);return()=>clearInterval(timer);},[state.started]);
  useEffect(()=>{if(!state.started)return;localStorage.setItem(SAVE_KEY,serializeGame(state));setSaved(state);},[state]);
  const save=()=>{localStorage.setItem(SAVE_KEY,serializeGame(state));setSaved(state);setSaveFlash(true);setTimeout(()=>setSaveFlash(false),1200)};
  const resources=useMemo(()=>[{label:"CASH",value:formatMoney(state.cash),tip:`Operational capital. Current recurring revenue: ${formatMoney(state.revenue)} per month.`},{label:"COMPUTE",value:compact(state.compute),tip:"Training and inference capacity. Expand infrastructure to run larger models."},{label:"CAPABILITY",value:Math.round(state.capability),tip:"Estimated frontier model capability created by research and training."},{label:"SAFETY",value:Math.round(state.safety),tip:"Evaluation, oversight and alignment maturity supporting current capability.",tone:state.safety<state.capability-25?"warn":""},{label:"TRUST",value:Math.round(state.publicTrust),tip:"Public confidence. Incidents and uncontrolled launches reduce it."},{label:"HYPE",value:Math.round(state.hype),tip:"Attention attracts users, capital and talent—but also scrutiny."}], [state]);
  if(!state.started)return <StartScreen hasSave={Boolean(saved)} onStart={(companyName)=>dispatch({type:"START",companyName})} onContinue={()=>saved&&dispatch({type:"LOAD",state:saved})}/>;
  if(state.ending)return <Ending state={state} dispatch={dispatch}/>;
  const renderView=()=>{switch(state.view){case"research":return <ResearchView state={state} dispatch={dispatch}/>;case"models":return <ModelsView state={state} dispatch={dispatch}/>;case"team":return <TeamView state={state} dispatch={dispatch}/>;case"compute":return <ComputeView state={state} dispatch={dispatch}/>;case"world":return <WorldView state={state}/>;default:return <LabView state={state}/>;}};
  return <main className={`game era-${state.era}`}>
    <header className="game-topbar"><div className="game-brand"><i>S</i><div><b>SINGULARITY</b><span>{state.companyName.toUpperCase()}</span></div></div><div className="metrics">{resources.map((item)=><Metric {...item} key={item.label}/>)}</div><div className="timebox"><b>{displayDate(state.day)}</b><div>{([0,1,2,4] as Speed[]).map((speed)=><button className={state.speed===speed?"active":""} onClick={()=>dispatch({type:"SET_SPEED",speed})} key={speed}>{speed===0?"Ⅱ":`${speed}×`}</button>)}</div></div></header>
    <div className="era-ribbon"><div><span>ERA {state.era===1?"I":state.era===2?"II":"III"}</span><b>{state.era===1?"THE RESEARCH LAB":state.era===2?"THE SCALING RACE":"THE TAKEOFF"}</b></div><div className="race-status"><span>FRONTIER POSITION</span><b>#{[state.capability,...state.rivals.map((r)=>r.capability)].sort((a,b)=>b-a).indexOf(state.capability)+1}</b></div><button onClick={save}>{saveFlash?"SAVED ✓":"SAVE GAME"}</button></div>
    <section className="game-layout"><ContextPanel state={state}/><section className="main-stage">{renderView()}</section><Feed state={state} dispatch={dispatch}/></section>
    <nav className="game-dock">{viewItems.map(([view,icon,label])=><button className={state.view===view?"active":""} onClick={()=>dispatch({type:"SET_VIEW",view})} key={view}><i>{icon}</i><span>{label}</span>{view==="models"&&state.trainingRun&&<b/>}</button>)}</nav>
  </main>;
}
