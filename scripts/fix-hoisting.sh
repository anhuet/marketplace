#!/bin/bash
# Yarn Classic workspace hoisting workaround.
# Some packages fail to hoist from workspaces even though `yarn why` reports them as hoisted.
# This script copies them from the Yarn cache after every `yarn install`.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TYPES_DIR="$ROOT/node_modules/@types"
CACHE="$HOME/.cache/yarn/v6"

# macOS uses a different cache path
if [[ "$OSTYPE" == "darwin"* ]]; then
  CACHE="$HOME/Library/Caches/Yarn/v6"
fi

copy_from_cache() {
  local pkg="$1"       # e.g. "typescript"
  local pattern="$2"   # glob pattern for the cache dir, e.g. "npm-typescript-5.3.3-*"
  local target="$3"    # full destination path

  if [ -d "$target" ]; then
    return 0
  fi

  local src
  src=$(find "$CACHE" -maxdepth 1 -name "$pattern" -type d 2>/dev/null | sort | tail -1)
  if [ -z "$src" ]; then
    echo "⚠️  Could not find $pkg in Yarn cache ($pattern)"
    return 1
  fi

  local inner="$src/node_modules/$pkg"
  if [ ! -d "$inner" ]; then
    echo "⚠️  Inner path not found: $inner"
    return 1
  fi

  cp -r "$inner" "$target"
  echo "✓ Installed $pkg from cache"
}

# typescript
mkdir -p "$ROOT/node_modules"
copy_from_cache "typescript" "npm-typescript-5.3.3-*" "$ROOT/node_modules/typescript"
if [ -f "$ROOT/node_modules/typescript/bin/tsc" ]; then
  mkdir -p "$ROOT/node_modules/.bin"
  ln -sf "../typescript/bin/tsc" "$ROOT/node_modules/.bin/tsc" 2>/dev/null || true
  ln -sf "../typescript/bin/tsserver" "$ROOT/node_modules/.bin/tsserver" 2>/dev/null || true
fi

# @types packages
mkdir -p "$TYPES_DIR"
copy_from_cache "@types/react" "npm-@types-react-18.2.79-*" "$TYPES_DIR/react"
copy_from_cache "@types/express" "npm-@types-express-4.17.25-*" "$TYPES_DIR/express"
copy_from_cache "@types/express-serve-static-core" "npm-@types-express-serve-static-core-4.19.8-*" "$TYPES_DIR/express-serve-static-core"
copy_from_cache "@types/multer" "npm-@types-multer-1.4.13-*" "$TYPES_DIR/multer"
copy_from_cache "@types/mime" "npm-@types-mime-1.3.5-*" "$TYPES_DIR/mime"
copy_from_cache "@types/serve-static" "npm-@types-serve-static-1.15.10-*" "$TYPES_DIR/serve-static"
copy_from_cache "@types/connect" "npm-@types-connect-3.4.38-*" "$TYPES_DIR/connect"

echo "✓ Hoisting fix complete"

# Build @marketplace/shared so mobile and backend can import its types
SHARED_DIST="$ROOT/packages/shared/dist"
if [ ! -d "$SHARED_DIST" ]; then
  echo "Building @marketplace/shared..."
  (cd "$ROOT/packages/shared" && "$ROOT/node_modules/.bin/tsc" 2>&1) && echo "✓ @marketplace/shared built" || echo "⚠️  @marketplace/shared build failed"
fi
