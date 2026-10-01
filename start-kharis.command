#!/bin/bash
# Double-click to run Kharis On Campus locally at http://localhost:5173
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -1)/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org (LTS), then double-click this file again."
  read -n 1 -s -r -p "Press any key to close"; exit 1
fi
echo "Installing packages (first run takes a minute)…"
npm install --no-audit --no-fund || { read -n 1 -s -r -p "Install failed — press any key to close"; exit 1; }
(sleep 6 && open "http://localhost:5173/login") &
echo "Starting Kharis On Campus at http://localhost:5173 — keep this window open. Press Ctrl+C to stop."
npm run dev
