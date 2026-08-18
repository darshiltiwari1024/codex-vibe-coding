import { employeeCandidates, gameEvents, modelDefinitions, researchProjects, starterEmployees, starterRivals } from "./content.ts";
import type { Employee, Era, GameAction, GameState, NewsItem, ResourceEffect, Speed } from "./types";

export const SAVE_KEY = "singularity-save-v1";
export const GAME_VERSION = 1;
const START_YEAR = 2015;

export function makeInitialState(): GameState {
  return {
    version: GAME_VERSION, companyName: "Helios Research", started: false, day: 0, era: 1, speed: 0, view: "lab",
    cash: 2400000, revenue: 40000, compute: 24, researchBank: 0, capability: 4, safety: 5, security: 4,
    publicTrust: 52, governmentTrust: 48, hype: 3, control: 100, morale: 84, aiAutomation: 0,
    employees: starterEmployees.map((employee) => ({...employee})), completedResearch: [], activeResearch: {id:"representation",progress:0},
    completedModels: [], trainingRun: null, rivals: starterRivals.map((rival) => ({...rival})), currentEvent: "first_run",
    eventHistory: [], news: [{id:"welcome",date:0,kind:"LAB",text:"Four researchers move into a converted warehouse in Oakland."}],
    history: [{year:2015,capability:4}], seed: 8047, ending: null,
  };
}

export function gameYear(day: number) { return START_YEAR + day / 365; }
export function displayDate(day: number) {
  const date = new Date(Date.UTC(START_YEAR, 0, 1));
  date.setUTCDate(date.getUTCDate() + Math.floor(day));
  return date.toLocaleDateString("en-US", {month:"short",year:"numeric",timeZone:"UTC"}).toUpperCase();
}

function clamp(value: number, min = 0, max = 100) { return Math.min(max, Math.max(min, value)); }
function nextRandom(seed: number) { const next = (seed * 1664525 + 1013904223) >>> 0; return [next / 4294967296, next] as const; }
function addNews(state: GameState, text: string, kind = "NEWS"): NewsItem[] {
  const item = {id:`${state.day}-${state.news.length}-${text.slice(0,8)}`,date:state.day,kind,text};
  return [item, ...state.news].slice(0, 12);
}
function researchRate(state: GameState) {
  const human = state.employees.reduce((sum, employee) => sum + employee.skill * (employee.morale / 100), 0) / 115;
  const automation = 1 + Math.pow(state.aiAutomation / 28, 1.42);
  return human * automation;
}
export function humanContribution(state: GameState) { return Math.round(1000 / (1 + Math.pow(state.aiAutomation / 20, 1.65))) / 10; }
export function generationEstimateDays(state: GameState) { return Math.max(2, Math.round(880 / (1 + state.capability / 24) / (1 + Math.pow(state.aiAutomation / 18, 1.35)))); }

export function canResearch(state: GameState, id: string) {
  const project = researchProjects.find((item) => item.id === id);
  return Boolean(project && project.era <= state.era && !state.completedResearch.includes(id) && project.prerequisites.every((pre) => state.completedResearch.includes(pre)));
}
export function canTrain(state: GameState, id: string) {
  const model = modelDefinitions.find((item) => item.id === id);
  return Boolean(model && model.era <= state.era && !state.completedModels.includes(id) && model.prerequisites.every((pre) => state.completedResearch.includes(pre)) && state.cash >= model.cashCost && state.compute >= Math.ceil(model.computeRequired * .35));
}

function applyEffect(state: GameState, effect: ResourceEffect): GameState {
  return {
    ...state,
    cash: Math.max(0, state.cash + (effect.cash ?? 0)), revenue: Math.max(0,state.revenue+(effect.revenue??0)), researchBank: Math.max(0, state.researchBank + (effect.research ?? 0)),
    compute: Math.max(1, state.compute + (effect.compute ?? 0)), capability: clamp(state.capability + (effect.capability ?? 0),0,120),
    safety: clamp(state.safety + (effect.safety ?? 0)), security: clamp(state.security + (effect.security ?? 0)),
    publicTrust: clamp(state.publicTrust + (effect.publicTrust ?? 0)), governmentTrust: clamp(state.governmentTrust + (effect.governmentTrust ?? 0)),
    hype: clamp(state.hype + (effect.hype ?? 0)), control: clamp(state.control + (effect.control ?? 0)), morale: clamp(state.morale + (effect.morale ?? 0)),
    aiAutomation: clamp(state.aiAutomation + (effect.aiAutomation ?? 0),0,100),
  };
}

function advanceResearch(state: GameState, days: number) {
  if (!state.activeResearch) return state;
  const project = researchProjects.find((item) => item.id === state.activeResearch!.id);
  if (!project) return {...state,activeResearch:null};
  const available = state.researchBank + researchRate(state) * days * .065;
  const spend = Math.min(available, researchRate(state) * days * .08);
  const progress = state.activeResearch.progress + spend;
  if (progress < project.cost) return {...state,researchBank:Math.max(0,available-spend),activeResearch:{...state.activeResearch,progress}};
  let next = applyEffect({...state,researchBank:Math.max(0,available-project.cost+state.activeResearch.progress),activeResearch:null,completedResearch:[...state.completedResearch,project.id]},project.effect);
  next = {...next,news:addNews(next,`${project.name} research completed.`,"RESEARCH")};
  return next;
}

function advanceTraining(state: GameState, days: number) {
  if (!state.trainingRun) return state;
  const model = modelDefinitions.find((item) => item.id === state.trainingRun!.modelId);
  if (!model) return {...state,trainingRun:null};
  const rate = Math.max(0.2,state.compute / model.computeRequired) * days * (state.era === 3 ? 1.35 : 1);
  const progress = state.trainingRun.progress + rate;
  if (progress < 100) return {...state,trainingRun:{...state.trainingRun,progress}};
  const gap = Math.max(0, state.capability + model.capabilityGain - state.safety);
  const next = {...state,trainingRun:null,completedModels:[...state.completedModels,model.id],capability:clamp(state.capability+model.capabilityGain,0,120),hype:clamp(state.hype+Math.round(model.capabilityGain*.55)),publicTrust:clamp(state.publicTrust-Math.floor(gap/15)),news:addNews(state,`${model.name} training complete. A new frontier has opened.`,"MODEL")};
  return next;
}

function updateRivals(state: GameState, days: number) {
  const [random, seed] = nextRandom(state.seed);
  const racePressure = 0.004 + Math.max(0,state.capability-35)*.00004;
  const rivals = state.rivals.map((rival,index) => ({...rival,capability:Math.min(112,rival.capability+days*(racePressure+index*.00025)*(0.85+random*.3)),safety:Math.min(100,rival.safety+days*.0015*(rival.id==="harmony"?2:1))}));
  return {...state,rivals,seed};
}

function maybeEvent(state: GameState) {
  if (state.currentEvent) return state;
  const year = gameYear(state.day);
  const event = gameEvents.find((item) => !state.eventHistory.includes(item.id) && (item.year === undefined || year >= item.year) && (item.minCapability === undefined || state.capability >= item.minCapability) && (item.era === undefined || state.era >= item.era));
  return event ? {...state,currentEvent:event.id,speed:0 as Speed} : state;
}

function maybeEra(state: GameState) {
  let era: Era = state.era;
  if (state.capability >= 60 && state.completedResearch.includes("coding_agents") && state.completedResearch.includes("reasoning_rl")) era = 3;
  else if (state.capability >= 31 || state.completedModels.includes("helios_3")) era = Math.max(state.era,2) as Era;
  if (era === state.era) return state;
  const title = era === 2 ? "ERA II — The Scaling Race begins." : "ERA III — AI systems are now accelerating AI research.";
  return {...state,era,aiAutomation:era===3?Math.max(8,state.aiAutomation):state.aiAutomation,news:addNews(state,title,"ERA"),hype:clamp(state.hype+8)};
}

function maybeEnding(state: GameState) {
  if (state.ending || state.capability < 100) return state;
  const gap = state.capability - state.safety;
  let ending = "CORPORATE SOVEREIGNTY";
  if (state.governmentTrust > 78 && state.control < 45) ending = "NATIONALIZED SINGULARITY";
  else if (state.completedResearch.includes("global_governance") && state.publicTrust > 64) ending = "GLOBAL COORDINATION";
  else if (gap > 46 || state.safety < 38) ending = "LOSS OF CONTROL";
  else if (state.safety > 76 && gap < 30) ending = "ALIGNED SUPERINTELLIGENCE";
  else if (Math.max(...state.rivals.map((rival)=>rival.capability)) > state.capability+4) ending = "RIVAL VICTORY";
  return {...state,ending,speed:0 as Speed,news:addNews(state,`${ending}: the intelligence race has reached its final phase.`,"ENDING")};
}

function tick(state: GameState) {
  if (!state.started || state.speed === 0 || state.ending) return state;
  const baseDays: Record<Exclude<Speed,0>,number> = {1:2,2:8,4:28};
  const days = baseDays[state.speed];
  const previousYear = Math.floor(gameYear(state.day));
  let next = {...state,day:state.day+days};
  const monthlyRevenue = state.revenue * days / 30;
  const payroll = state.employees.reduce((sum,e)=>sum+e.salary,0) * days / 365;
  next = {...next,cash:Math.max(0,next.cash+monthlyRevenue-payroll),researchBank:next.researchBank+researchRate(next)*days*.035};
  next = advanceResearch(next,days);
  next = advanceTraining(next,days);
  next = updateRivals(next,days);
  if (next.era === 3 && next.aiAutomation > 0) next = {...next,aiAutomation:clamp(next.aiAutomation+days*.003*(1+next.aiAutomation/38),0,100)};
  const currentYear = Math.floor(gameYear(next.day));
  if (currentYear > previousYear) next = {...next,history:[...next.history,{year:currentYear,capability:next.capability}].slice(-18)};
  next = maybeEra(next);
  next = maybeEvent(next);
  next = maybeEnding(next);
  if (next.cash <= 0 && !next.ending) next = {...next,ending:"LAB SHUTDOWN",speed:0};
  return next;
}

function hire(state: GameState, role: "researcher" | "engineer" | "safety") {
  const costs = {researcher:420000,engineer:310000,safety:360000};
  if (state.cash < costs[role]) return state;
  const [random,seed] = nextRandom(state.seed);
  const candidate = employeeCandidates[state.employees.length % employeeCandidates.length];
  const roleName = role === "safety" ? "Safety Researcher" : role === "engineer" ? "Research Engineer" : candidate[1];
  const employee: Employee = {id:`hire-${state.day}-${state.employees.length}`,name:candidate[0],role:roleName,specialty:role==="safety"?"Evaluations":candidate[2],ideology:role==="safety"?"Safety":candidate[3],skill:68+Math.floor(random*23),morale:84,salary:role==="researcher"?205000:role==="safety"?185000:165000};
  return {...state,cash:state.cash-costs[role],employees:[...state.employees,employee],seed,morale:clamp(state.morale+1),safety:role==="safety"?clamp(state.safety+2):state.safety,news:addNews(state,`${employee.name} joins as ${employee.role}.`,"PEOPLE")};
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch(action.type) {
    case "START": return {...state,started:true,companyName:action.companyName.trim()||"Helios Research",speed:1};
    case "TICK": return tick(state);
    case "SET_SPEED": return {...state,speed:action.speed};
    case "SET_VIEW": return {...state,view:action.view};
    case "START_RESEARCH": {
      if (!canResearch(state,action.id) || state.activeResearch) return state;
      const project = researchProjects.find((item)=>item.id===action.id)!;
      if (state.compute < project.computeCost) return state;
      return {...state,activeResearch:{id:action.id,progress:0},compute:Math.max(1,state.compute-Math.ceil(project.computeCost*.12)),news:addNews(state,`${project.name} becomes the lab’s top research priority.`,"RESEARCH")};
    }
    case "START_MODEL": {
      if (!canTrain(state,action.id) || state.trainingRun) return state;
      const model = modelDefinitions.find((item)=>item.id===action.id)!;
      return {...state,cash:state.cash-model.cashCost,trainingRun:{modelId:action.id,progress:0,incidents:[]},news:addNews(state,`${model.name} training run started.`,"MODEL")};
    }
    case "HIRE": return hire(state,action.role);
    case "BUILD_COMPUTE": {
      const cost = state.era===1?900000:state.era===2?5000000:18000000;
      const gain = state.era===1?18:state.era===2?60:180;
      return state.cash<cost?state:{...state,cash:state.cash-cost,compute:state.compute+gain,news:addNews(state,`${state.era===1?"Leased cluster":"Datacenter expansion"} comes online: +${gain} compute.`,"COMPUTE")};
    }
    case "CHOOSE_EVENT": {
      if (state.currentEvent!==action.eventId) return state;
      const event=gameEvents.find((item)=>item.id===action.eventId); const choice=event?.choices.find((item)=>item.id===action.choiceId);
      if (!event||!choice) return state;
      let next=applyEffect({...state,currentEvent:null,eventHistory:[...state.eventHistory,event.id]},choice.effect);
      if (choice.unlockResearch && !next.completedResearch.includes(choice.unlockResearch)) next={...next,researchBank:next.researchBank+12};
      return {...next,news:addNews(next,`${event.title}: ${choice.label}.`,"DECISION"),speed:1};
    }
    case "DISMISS_NEWS": return {...state,news:state.news.filter((item)=>item.id!==action.id)};
    case "LOAD": return {...action.state,speed:0,version:GAME_VERSION};
    case "NEW_GAME": return makeInitialState();
    default: return state;
  }
}

export function serializeGame(state: GameState) { return JSON.stringify({...state,lastSavedAt:Date.now()}); }
export function deserializeGame(value: string): GameState | null {
  try { const parsed=JSON.parse(value) as GameState; return parsed.version===GAME_VERSION?{...parsed,speed:0}:null; } catch { return null; }
}
