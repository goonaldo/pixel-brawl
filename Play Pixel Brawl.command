#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "First-time setup, installing..."
  npm install
fi

if ! curl -s -o /dev/null http://localhost:3000; then
  echo "Starting Pixel Brawl server..."
  nohup npm start > server.log 2>&1 &
  disown
  sleep 2
fi

open http://localhost:3000

echo ""
echo "Pixel Brawl is running! You can close this window."
echo "(The server keeps running in the background — same wifi link is shown on the game's waiting screen.)"
sleep 4
