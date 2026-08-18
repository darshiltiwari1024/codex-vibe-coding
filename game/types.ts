export type Era = 1 | 2 | 3;
export type Speed = 0 | 1 | 2 | 4;
export type View = "lab" | "research" | "models" | "team" | "compute" | "world";
export type ResearchCategory = "Architecture" | "Scaling" | "Post-training" | "Agents" | "Infrastructure" | "Safety" | "Security" | "Products";

export interface ResourceEffect {
  cash?: number;
  revenue?: number;
  research?: number;
  compute?: number;
  capability?: number;
  safety?: number;
  security?: number;
  publicTrust?: number;
  governmentTrust?: number;
  hype?: number;
  control?: number;
  morale?: number;
  aiAutomation?: number;
}

export interface ResearchProject {
  id: string;
  name: string;
  category: ResearchCategory;
  era: Era;
  cost: number;
  computeCost: number;
  prerequisites: string[];
  description: string;
  effect: ResourceEffect;
}

export interface ModelDefinition {
  id: string;
  name: string;
  subtitle: string;
  era: Era;
  cashCost: number;
  computeRequired: number;
  capabilityGain: number;
  safetyUncertainty: number;
  prerequisites: string[];
}

export interface Choice {
  id: string;
  label: string;
  detail: string;
  effect: ResourceEffect;
  unlockResearch?: string;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  year?: number;
  minCapability?: number;
  era?: Era;
  choices: Choice[];
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  specialty: string;
  skill: number;
  morale: number;
  ideology: string;
  salary: number;
}

export interface Rival {
  id: string;
  name: string;
  doctrine: string;
  capability: number;
  safety: number;
  estimated: boolean;
}

export interface ActiveResearch {
  id: string;
  progress: number;
}

export interface TrainingRun {
  modelId: string;
  progress: number;
  incidents: string[];
}

export interface NewsItem {
  id: string;
  date: number;
  kind: string;
  text: string;
}

export interface HistoryPoint {
  year: number;
  capability: number;
}

export interface GameState {
  version: number;
  companyName: string;
  started: boolean;
  day: number;
  era: Era;
  speed: Speed;
  view: View;
  cash: number;
  revenue: number;
  compute: number;
  researchBank: number;
  capability: number;
  safety: number;
  security: number;
  publicTrust: number;
  governmentTrust: number;
  hype: number;
  control: number;
  morale: number;
  aiAutomation: number;
  employees: Employee[];
  completedResearch: string[];
  activeResearch: ActiveResearch | null;
  completedModels: string[];
  trainingRun: TrainingRun | null;
  rivals: Rival[];
  currentEvent: string | null;
  eventHistory: string[];
  news: NewsItem[];
  history: HistoryPoint[];
  seed: number;
  ending: string | null;
  lastSavedAt?: number;
}

export type GameAction =
  | { type: "START"; companyName: string }
  | { type: "TICK" }
  | { type: "SET_SPEED"; speed: Speed }
  | { type: "SET_VIEW"; view: View }
  | { type: "START_RESEARCH"; id: string }
  | { type: "START_MODEL"; id: string }
  | { type: "HIRE"; role: "researcher" | "engineer" | "safety" }
  | { type: "BUILD_COMPUTE" }
  | { type: "CHOOSE_EVENT"; eventId: string; choiceId: string }
  | { type: "DISMISS_NEWS"; id: string }
  | { type: "LOAD"; state: GameState }
  | { type: "NEW_GAME" };
