#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"
cd /Users/rami/Claude/healthkit-website
exec node node_modules/.bin/next dev --webpack
