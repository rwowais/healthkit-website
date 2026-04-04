#!/bin/bash
export PATH="/Users/rami/local/bin:$PATH"
cd /Users/rami/Claude/healthkit-website
exec node node_modules/.bin/next dev --webpack
