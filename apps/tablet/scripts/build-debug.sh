#!/bin/bash
# Build CafeCash debug APK — applies all gradle fixes after prebuild
set -e

TABLET_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$TABLET_DIR/../.." && pwd)"
ANDROID="$TABLET_DIR/android"
JAVA_HOME="/opt/homebrew/Cellar/openjdk@21/21.0.12.1/libexec/openjdk.jdk/Contents/Home"
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
EXPO_PLUGIN="$ROOT_DIR/node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle"

echo "▶ Step 1: expo prebuild"
cd "$TABLET_DIR"
EXPO_NO_DOTENV=0 npx expo prebuild --platform android --clean

echo "▶ Step 2: patch android/build.gradle"
BUILD_GRADLE="$ANDROID/build.gradle"

# Inject root-level ext block before buildscript
if ! grep -q "root-level ext" "$BUILD_GRADLE"; then
  sed -i '' 's|// Top-level build file where you can add configuration options common to all sub-projects/modules.|// Top-level build file where you can add configuration options common to all sub-projects/modules.\n\n// root-level ext for expo-modules-core\next {\n    kotlinVersion = '"'"'1.9.25'"'"'\n}|' "$BUILD_GRADLE"
fi

# Hardcode kotlinVersion in buildscript ext
sed -i '' "s/kotlinVersion = findProperty('android.kotlinVersion') ?: '1.9.25'/kotlinVersion = '1.9.25'/" "$BUILD_GRADLE"
sed -i '' "s/kotlinVersion = findProperty('android.kotlinVersion') ?: '1.9.24'/kotlinVersion = '1.9.25'/" "$BUILD_GRADLE"

# Pin kotlin-gradle-plugin version
sed -i '' "s|classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')|classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25')|" "$BUILD_GRADLE"
echo "  ✓ build.gradle patched"

echo "▶ Step 3: patch gradle.properties"
PROPS="$ANDROID/gradle.properties"
grep -q "android.kotlinVersion" "$PROPS" || echo "android.kotlinVersion=1.9.25" >> "$PROPS"
echo "  ✓ gradle.properties patched"

echo "▶ Step 4: patch ExpoModulesCorePlugin.gradle"
# Fix default fallback version
sed -i '' 's/: "1.9.24"/: "1.9.25"/' "$EXPO_PLUGIN"
# Guard publishing block
python3 - "$EXPO_PLUGIN" <<'PYEOF'
import sys
path = sys.argv[1]
with open(path) as f:
    content = f.read()

old = '''  project.afterEvaluate {
    publishing {
      publications {
        release(MavenPublication) {
          from components.release
        }
      }
      repositories {
        maven {
          url = mavenLocal().url
        }
      }
    }
  }
}'''
new = '''  project.afterEvaluate {
    if (project.components.findByName("release") != null) {
      publishing {
        publications {
          release(MavenPublication) {
            from components.release
          }
        }
        repositories {
          maven {
            url = mavenLocal().url
          }
        }
      }
    }
  }
}'''
if old in content:
    content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)
    print("  ✓ publishing block guarded")
else:
    print("  ✓ publishing block already patched")
PYEOF

echo "▶ Step 5: build APK"
cd "$ANDROID"
export JAVA_HOME="$JAVA_HOME"
export ANDROID_HOME="$HOME/Library/Android/sdk"
./gradlew --stop 2>/dev/null || true
./gradlew assembleDebug

APK="$ANDROID/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "✅ BUILD SUCCESS: $APK"
echo ""
echo "▶ Installing on device 3da73143..."
"$ADB" -s 3da73143 install -r "$APK" && echo "✅ Installed on device"
