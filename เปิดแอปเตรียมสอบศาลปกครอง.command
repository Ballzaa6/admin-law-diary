#!/bin/zsh
cd "$(dirname "$0")"
if ! lsof -i :8414 >/dev/null 2>&1; then
  nohup python3 server.py >/dev/null 2>&1 &
  sleep 0.6
fi
open "http://localhost:8414"
