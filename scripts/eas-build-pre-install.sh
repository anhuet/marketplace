#!/bin/bash
# EAS Build pre-install hook
# Runs before `yarn install` on EAS build servers.
#
# Problem: EAS installs the entire monorepo (all workspaces), including the
# backend which depends on `sharp`. Sharp requires native compilation tools
# (node-gyp, libvips) that are not available on EAS iOS/Android builders,
# causing `yarn install` to fail.
#
# Solution: Remove sharp from backend's package.json before install runs.
# This only affects the EAS build environment — local dev is unaffected.

set -euo pipefail

# Resolve repo root relative to this script so it works regardless of cwd
# (EAS runs the hook from apps/mobile; locally we may run it from anywhere).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_PKG="$REPO_ROOT/apps/backend/package.json"

if [ -f "$BACKEND_PKG" ]; then
  echo "[eas-build-pre-install] Removing sharp from backend dependencies to avoid native build failure..."
  # Use node to reliably edit JSON
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$BACKEND_PKG', 'utf8'));
    if (pkg.dependencies && pkg.dependencies.sharp) {
      delete pkg.dependencies.sharp;
    }
    if (pkg.optionalDependencies && pkg.optionalDependencies.sharp) {
      delete pkg.optionalDependencies.sharp;
    }
    if (pkg.devDependencies && pkg.devDependencies['@types/sharp']) {
      delete pkg.devDependencies['@types/sharp'];
    }
    fs.writeFileSync('$BACKEND_PKG', JSON.stringify(pkg, null, 2) + '\n');
  "
  echo "[eas-build-pre-install] Done — sharp removed from $BACKEND_PKG"
fi
