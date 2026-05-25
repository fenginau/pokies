# Ping-Pong Ball Draw Machine

A responsive React + Vite web app that visually simulates a ping-pong ball draw machine for random selection. Results are selected in code first, then animated with Matter.js so the draw remains reliable.

## Stack

- React
- JavaScript
- Vite
- Matter.js
- CSS

## Run locally

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

## Build

```bash
npm run build
```

## Features

- Enter options one per line
- Choose how many balls to draw
- Validation and clamped draw counts
- Matter.js ball chamber with turbulence
- Deterministic draw order with animated one-by-one release
- Results panel and reset flow

## Notes

- This app is for visual random selection only.
- No backend, accounts, betting, or persistence are included.
