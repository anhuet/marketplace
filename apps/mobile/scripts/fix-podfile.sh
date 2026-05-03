#!/bin/bash
# Removes :privacy_file_aggregation_enabled from Podfile if CocoaPods < 1.15.2
# This flag was introduced in react-native 0.74 but requires CocoaPods >= 1.15.2

PODFILE="ios/Podfile"

if [ -f "$PODFILE" ]; then
  echo "[fix-podfile] Removing :privacy_file_aggregation_enabled from Podfile..."
  sed -i'' -e '/:privacy_file_aggregation_enabled/d' "$PODFILE"
  echo "[fix-podfile] Done."
else
  echo "[fix-podfile] No Podfile found, skipping."
fi
