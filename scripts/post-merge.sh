#!/bin/bash
set -e

cd web/default
bun install
DISABLE_ESLINT_PLUGIN=true bun run build
cd ../..

cd web/stratus
bun install --frozen-lockfile
bun run build
cd ../..

mkdir -p web/classic/dist
if [ ! -f web/classic/dist/index.html ]; then
  printf '<!DOCTYPE html><html><head><title>New API</title></head><body><div id="root"></div></body></html>' > web/classic/dist/index.html
fi

build_file="./new-api.build.tmp.$$"
trap 'rm -f "$build_file"' EXIT
go build -buildvcs=false -o "$build_file" .
chmod +x "$build_file"
# Replace the directory entry, not the inode currently executed by the workflow.
mv -f "$build_file" ./new-api
