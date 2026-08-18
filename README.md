# SINGULARITY — The Intelligence Race

A playable browser strategy game about growing a four-person AI research lab in 2015 into the organization that shapes the intelligence age.

## The vertical slice

- Three mechanically distinct eras: Research Lab, Scaling Race, and Takeoff
- An animated isometric office that evolves with the campaign
- 32 prerequisite-driven research projects across eight disciplines
- Eight consequential frontier-model training runs
- Hiring, compute expansion, recurring revenue, morale, trust, hype, security, safety, and founder control
- Four autonomous rival laboratories with uncertain capability estimates
- Ten strategic decision events with systemic consequences
- Deterministic seeded simulation and a visible capability takeoff curve
- AI R&D automation that genuinely accelerates later research
- Autosave, manual save, continue, and multiple emergent ASI endings

## Run locally

Requires Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validate

```bash
npm run build
npm test
```

Simulation tests cover resources, research prerequisites and completion, training completion, event requirements, rival progression, save serialization, takeoff automation, and an ASI ending.

## Architecture

- `game/content.ts` contains data-driven research, models, employees, rivals, and events.
- `game/simulation.ts` contains the deterministic simulation and save logic.
- `app/Game.tsx` contains the interactive management surfaces.
- `app/globals.css` contains the strategy-game visual system and isometric scene.

Built with TypeScript, React, vinext, and the OpenAI Sites runtime.
