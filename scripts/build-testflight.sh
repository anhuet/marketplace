#!/usr/bin/env bash
# Build the iOS app as a signed IPA and upload it to TestFlight.
#
# Prerequisites (one-time setup):
#   1. Xcode + Command Line Tools installed.
#   2. Apple Distribution certificate + provisioning profile imported into the
#      login keychain. Easiest way from EAS-managed credentials:
#        cd apps/mobile && eas credentials      # download .p12 + .mobileprovision
#        security import path/to/cert.p12 -k ~/Library/Keychains/login.keychain-db -P <p12-password>
#        cp path/to/profile.mobileprovision "$HOME/Library/MobileDevice/Provisioning Profiles/"
#   3. App Store Connect API key (Users & Access -> Keys -> App Store Connect API):
#        export ASC_API_KEY_ID="ABC1234567"
#        export ASC_API_ISSUER_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
#        export ASC_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_ABC1234567.p8"
#      (Or use APPLE_ID + APP_SPECIFIC_PASSWORD env vars and switch the altool
#       invocation at the bottom to --username / --password.)
#
# Usage:
#   ./scripts/build-testflight.sh                  # build + upload
#   SKIP_UPLOAD=1 ./scripts/build-testflight.sh    # build only (no TestFlight)
#   SKIP_POD_INSTALL=1 ./scripts/build-testflight.sh

set -euo pipefail

# Locale fix — required because the project path contains '#' which trips
# CocoaPods on Ruby >=3.4 unless LANG is UTF-8.
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$REPO_ROOT/apps/mobile"
IOS_DIR="$MOBILE_DIR/ios"
BUILD_DIR="$IOS_DIR/build"
ARCHIVE_PATH="$BUILD_DIR/Marketplace.xcarchive"
EXPORT_DIR="$BUILD_DIR/export"
EXPORT_OPTIONS_PLIST="$BUILD_DIR/ExportOptions.plist"
IPA_PATH="$EXPORT_DIR/Marketplace.ipa"

SCHEME="${SCHEME:-Marketplace}"
WORKSPACE="$IOS_DIR/Marketplace.xcworkspace"
CONFIGURATION="${CONFIGURATION:-Release}"
TEAM_ID="${TEAM_ID:-9WVR7D9J97}"
BUNDLE_ID="${BUNDLE_ID:-com.singlegrey.marketplace}"

echo "==> Repo:      $REPO_ROOT"
echo "==> Mobile:    $MOBILE_DIR"
echo "==> Scheme:    $SCHEME"
echo "==> Team:      $TEAM_ID"
echo "==> Bundle ID: $BUNDLE_ID"

cd "$MOBILE_DIR"

# 1. Install JS dependencies (idempotent — yarn is fast if already installed).
echo "==> Installing JS dependencies"
yarn install --frozen-lockfile

# 2. Pod install (skippable with SKIP_POD_INSTALL=1 for repeat runs).
if [[ "${SKIP_POD_INSTALL:-0}" != "1" ]]; then
  echo "==> Running pod install"
  cd "$IOS_DIR"
  pod install
  cd "$MOBILE_DIR"
fi

# 3. Clean previous build artefacts.
echo "==> Cleaning previous build artefacts"
rm -rf "$ARCHIVE_PATH" "$EXPORT_DIR" "$IPA_PATH"
mkdir -p "$BUILD_DIR"

# 4. Archive the app.
echo "==> Archiving (xcodebuild archive)"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CODE_SIGN_STYLE=Automatic \
  clean archive

# 5. Write ExportOptions.plist for App Store distribution.
echo "==> Writing ExportOptions.plist"
cat > "$EXPORT_OPTIONS_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store</string>
  <key>teamID</key>
  <string>$TEAM_ID</string>
  <key>uploadSymbols</key>
  <true/>
  <key>uploadBitcode</key>
  <false/>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>destination</key>
  <string>export</string>
</dict>
</plist>
PLIST

# 6. Export the .ipa from the archive.
echo "==> Exporting IPA (xcodebuild -exportArchive)"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST" \
  -exportPath "$EXPORT_DIR" \
  -allowProvisioningUpdates

# Rename whatever xcodebuild produced to a predictable name.
PRODUCED_IPA="$(find "$EXPORT_DIR" -maxdepth 1 -name "*.ipa" | head -n1)"
if [[ -z "${PRODUCED_IPA}" ]]; then
  echo "ERROR: no .ipa produced in $EXPORT_DIR" >&2
  exit 1
fi
if [[ "$PRODUCED_IPA" != "$IPA_PATH" ]]; then
  mv "$PRODUCED_IPA" "$IPA_PATH"
fi
echo "==> IPA ready: $IPA_PATH"

# 7. Upload to TestFlight unless SKIP_UPLOAD is set.
if [[ "${SKIP_UPLOAD:-0}" == "1" ]]; then
  echo "==> SKIP_UPLOAD=1 — skipping TestFlight upload"
  exit 0
fi

if [[ -z "${ASC_API_KEY_ID:-}" || -z "${ASC_API_ISSUER_ID:-}" || -z "${ASC_API_KEY_PATH:-}" ]]; then
  cat >&2 <<MSG
ERROR: App Store Connect API credentials not set.
Set the following env vars and re-run, or pass SKIP_UPLOAD=1 to build only:

  export ASC_API_KEY_ID="<10-char key ID>"
  export ASC_API_ISSUER_ID="<UUID issuer ID>"
  export ASC_API_KEY_PATH="\$HOME/.appstoreconnect/private_keys/AuthKey_<keyid>.p8"

Generate the key at: App Store Connect -> Users and Access -> Keys -> App Store Connect API.
MSG
  exit 1
fi

# altool resolves the key by ID + issuer; it looks for AuthKey_<KEYID>.p8 in
# ./private_keys, ~/private_keys, ~/.private_keys, or ~/.appstoreconnect/private_keys.
# Stage a copy into the canonical location so altool can find it regardless.
ASC_KEY_DIR="$HOME/.appstoreconnect/private_keys"
mkdir -p "$ASC_KEY_DIR"
EXPECTED_KEY="$ASC_KEY_DIR/AuthKey_${ASC_API_KEY_ID}.p8"
if [[ "$ASC_API_KEY_PATH" != "$EXPECTED_KEY" ]]; then
  cp "$ASC_API_KEY_PATH" "$EXPECTED_KEY"
fi

echo "==> Uploading to TestFlight (xcrun altool)"
xcrun altool \
  --upload-app \
  --type ios \
  --file "$IPA_PATH" \
  --apiKey "$ASC_API_KEY_ID" \
  --apiIssuer "$ASC_API_ISSUER_ID"

echo "==> Done. The build will appear in App Store Connect -> TestFlight after Apple finishes processing (usually 10-30 min)."
