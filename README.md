# Backing Down

A top-down race where everyone is backing a boat trailer. Four heats, four trucks, one ramp. First hull in the water wins the heat. Upgrades last for the season, then reset.

The design document is [docs/GDD.md](docs/GDD.md). It includes the hitch rules, the camera, the payout math, and the versions of the trailer that were tried and rejected.

## Run

```
npm install
npm run dev
```

Open the local URL Vite prints. `npm run build` produces the production bundle.

Keyboard: **S** reverse, **W** pull forward, **A** / **D** steer. The trailer holds an angle while you back up. It does not straighten itself. **W** is how you pull it straight.

## Save

Season, championships, best score, and mute live in `localStorage` under `backing-down-save-v1`. There is no account.
