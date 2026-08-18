import assert from "node:assert/strict";
import test from "node:test";
import { canResearch, canTrain, deserializeGame, gameReducer, makeInitialState, serializeGame } from "./simulation.ts";

test("research prerequisites are enforced", () => {
  const state=makeInitialState();
  assert.equal(canResearch(state,"transformers"),false);
  assert.equal(canResearch({...state,completedResearch:["representation","sequence"]},"transformers"),true);
});

test("hiring consumes cash and adds talent", () => {
  const state=makeInitialState(); const next=gameReducer(state,{type:"HIRE",role:"researcher"});
  assert.equal(next.employees.length,state.employees.length+1); assert.ok(next.cash<state.cash);
});

test("model requirements include research and resources", () => {
  const state={...makeInitialState(),completedResearch:["sequence"],cash:9999999,compute:99};
  assert.equal(canTrain(state,"helios_1"),true);
  const started=gameReducer(state,{type:"START_MODEL",id:"helios_1"}); assert.equal(started.trainingRun?.modelId,"helios_1");
});

test("rivals and resources progress deterministically", () => {
  const state={...makeInitialState(),started:true,speed:4 as const,currentEvent:null};
  const next=gameReducer(state,{type:"TICK"}); assert.ok(next.day>state.day); assert.ok(next.rivals[0].capability>state.rivals[0].capability);
});

test("AI automation accelerates research", () => {
  const base={...makeInitialState(),started:true,speed:4 as const,currentEvent:null,researchBank:0,completedResearch:[],activeResearch:{id:"representation",progress:0}};
  const human=gameReducer(base,{type:"TICK"}); const automated=gameReducer({...base,aiAutomation:80},{type:"TICK"});
  assert.ok((automated.activeResearch?.progress??999)>(human.activeResearch?.progress??0));
});

test("save serialization preserves campaign state", () => {
  const state={...makeInitialState(),companyName:"Test Lab",started:true}; const loaded=deserializeGame(serializeGame(state));
  assert.equal(loaded?.companyName,"Test Lab"); assert.equal(loaded?.speed,0);
});

test("research completion applies effects", () => {
  const state={...makeInitialState(),started:true,speed:4 as const,currentEvent:null,researchBank:100,activeResearch:{id:"representation",progress:34}};
  const next=gameReducer(state,{type:"TICK"});
  assert.ok(next.completedResearch.includes("representation")); assert.equal(next.activeResearch,null); assert.ok(next.capability>state.capability);
});

test("training completion creates a new model generation", () => {
  const state={...makeInitialState(),started:true,speed:1 as const,currentEvent:null,compute:100,trainingRun:{modelId:"helios_1",progress:99,incidents:[]},completedResearch:["sequence"]};
  const next=gameReducer(state,{type:"TICK"});
  assert.ok(next.completedModels.includes("helios_1")); assert.equal(next.trainingRun,null); assert.ok(next.capability>state.capability);
});

test("calendar and capability requirements trigger events", () => {
  const state={...makeInitialState(),started:true,speed:1 as const,currentEvent:null,eventHistory:["first_run"],day:729};
  const next=gameReducer(state,{type:"TICK"}); assert.equal(next.currentEvent,"attention"); assert.equal(next.speed,0);
});

test("AI research prerequisites trigger the takeoff era", () => {
  const state={...makeInitialState(),started:true,speed:1 as const,currentEvent:null,capability:60,completedResearch:["coding_agents","reasoning_rl"]};
  const next=gameReducer(state,{type:"TICK"}); assert.equal(next.era,3); assert.ok(next.aiAutomation>=8);
});

test("superintelligence threshold produces an emergent ending", () => {
  const state={...makeInitialState(),started:true,speed:4 as const,currentEvent:null,era:3 as const,capability:99,safety:95,compute:500,completedResearch:["recursive_design"],trainingRun:{modelId:"omega",progress:99,incidents:[]}};
  const next=gameReducer(state,{type:"TICK"}); assert.equal(next.ending,"ALIGNED SUPERINTELLIGENCE");
});
