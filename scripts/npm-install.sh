#!/bin/env sh
set -x

[ "$NPM_TOKEN" ] && npm install || true
