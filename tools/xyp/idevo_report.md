ajoutons une option --cwd pour installer depuis n'importe où "xfpm add axios --cwd ./packages/NehoSell-Automate/engine && xfpm add axios --cwd ./packages/NehoSell-Automate/automate-ui"
J'ai dis met à jour "prisma" (xfpm update prisma) il est partie mettre à jour tout ce qui se trouvait dans le package.json et s'il doit mettre à jours les packages.json il faut aussi qu'il n'oublie pas l'object devDeps.

Tu lui dis d'installer une deps il installe et lance toutes les postscript locals alors qu'il devriat seulement lancer les postscripts du module cible s'il y en ait.
Ici dans l'exemple il exécute xypriss et autre qui étaint déjà installé et exécuté.
"──(idevo㉿iDevo)-[~/Documents/projects/NehoSell/backend]
└─$ xfpm i pg @prisma/adapter-pg -D @types/pg
   --> Project: nehosell-server v1.0.0
[>>] Full installation initiated...                                 [*] Scanning neural gateway...                                      
   + yn v3.1.1
   [!]  Skipped optional: fsevents (platform mismatch)
   + fluent-ffmpeg v2.1.3
   + node-webpmux v3.1.7
   + node-fetch-native-with-agent v1.7.2
   + postgres v3.4.7
   + @prisma/engines v7.4.0
   + @prisma/config v7.4.0
   + @prisma/dev v0.20.0
   + @prisma/studio-core v0.13.1
   + chromium-bidi v13.1.1
   + bun-types v1.3.9
   + @qdrant/openapi-typescript-fetch v1.2.6
   + @prisma/client-runtime-utils v7.4.0
   + lazy v1.0.11
   + pg-int8 v1.0.1
   + @swc/core-linux-x64-gnu v1.15.11
   + @esbuild/linux-x64 v0.27.3
   [!]  Skipped optional: @esbuild/win32-arm64 (platform mismatch)
   [!]  Skipped optional: @esbuild/openbsd-arm64 (platform mismatch)
   [!]  Skipped optional: @esbuild/linux-s390x (platform mismatch)
   [!]  Skipped optional: @esbuild/win32-ia32 (platform mismatch)
   [!]  Skipped optional: @esbuild/linux-ppc64 (platform mismatch)
   [!]  Skipped optional: @esbuild/sunos-x64 (platform mismatch)
   [!]  Skipped optional: @esbuild/freebsd-arm64 (platform mismatch)
   [!]  Skipped optional: @esbuild/freebsd-x64 (platform mismatch)
   [!]  Skipped optional: @swc/core-win32-arm64-msvc (platform mismatch)
   [!]  Skipped optional: @esbuild/darwin-x64 (platform mismatch)
   [!]  Skipped optional: @esbuild/linux-loong64 (platform mismatch)
   [!]  Skipped optional: @swc/core-darwin-x64 (platform mismatch)
   [!]  Skipped optional: @esbuild/darwin-arm64 (platform mismatch)
   [!]  Skipped optional: @esbuild/netbsd-x64 (platform mismatch)
   [!]  Skipped optional: @esbuild/android-arm (platform mismatch)
   [!]  Skipped optional: @swc/core-win32-ia32-msvc (platform mismatch)
   [!]  Skipped optional: @esbuild/netbsd-arm64 (platform mismatch)
   [!]  Skipped optional: @swc/core-linux-arm64-gnu (platform mismatch)
   [!]  Skipped optional: @esbuild/openbsd-x64 (platform mismatch)
   [!]  Skipped optional: @esbuild/openharmony-arm64 (platform mismatch)
   [!]  Skipped optional: @swc/core-darwin-arm64 (platform mismatch)
   [!]  Skipped optional: @swc/core-linux-arm64-musl (platform mismatch)
   [!]  Skipped optional: @esbuild/linux-ia32 (platform mismatch)
   [!]  Skipped optional: @swc/core-linux-x64-musl (platform mismatch)
   + webdriver-bidi-protocol v0.4.0
   [!]  Skipped optional: @swc/core-win32-x64-msvc (platform mismatch)
   [!]  Skipped optional: fsevents (platform mismatch)
   + @prisma/driver-adapter-utils v7.3.0
   + bplist-parser v0.0.6
   [!]  Skipped optional: xpc-connection (platform mismatch)
   + @redis/time-series v5.10.0
   + @redis/bloom v5.10.0
   + @redis/json v5.10.0
   + @redis/search v5.10.0
   + spawn-command v0.0.2
   + @fast-csv/format v4.3.5
   + @fast-csv/parse v4.3.6
   + reduce-component v1.0.1
   [!]  Skipped optional: @esbuild/aix-ppc64 (platform mismatch)
   [!]  Skipped optional: @esbuild/android-x64 (platform mismatch)
   + cssfilter v0.0.10
   + @oven/bun-linux-x64 v1.3.9
   [!]  Skipped optional: @oven/bun-darwin-aarch64 (platform mismatch)
   [!]  Skipped optional: @oven/bun-windows-x64-baseline (platform mismatch)
   [!]  Skipped optional: @oven/bun-linux-aarch64-musl (platform mismatch)
   [!]  Skipped optional: @oven/bun-linux-x64-musl-baseline (platform mismatch)
   + @oven/bun-linux-x64-baseline v1.3.9
   [!]  Skipped optional: @oven/bun-linux-x64-musl (platform mismatch)
   [!]  Skipped optional: @oven/bun-darwin-x64-baseline (platform mismatch)
   [!]  Skipped optional: @oven/bun-darwin-x64 (platform mismatch)
   [!]  Skipped optional: @oven/bun-windows-x64 (platform mismatch)
   [!]  Skipped optional: @oven/bun-linux-aarch64 (platform mismatch)
   [!]  Skipped optional: @esbuild/win32-x64 (platform mismatch)
   + csrf v3.1.0
   [!]  Skipped optional: @esbuild/android-arm64 (platform mismatch)
   + @prisma/engines-version v7.4.0-20.ab56fe763f921d033a6c195e7ddeb3e255bdbb57
   + @prisma/fetch-engine v7.4.0
   + @prisma/get-platform v7.4.0
   + @prisma/debug v7.4.0
   + c12 v3.1.0
   + effect v3.18.4
   + empathic v2.0.0
   + @electric-sql/pglite-socket v0.0.20
   + @mrleebo/prisma-ast v0.13.1
   + @prisma/query-plan-executor v7.2.0
   + valibot v1.2.0
   + @electric-sql/pglite-tools v0.2.20
   + remeda v2.33.4
   + proper-lockfile v4.1.2
   + http-status-codes v2.3.0
   + zeptomatch v2.1.0
   + @prisma/get-platform v7.2.0
   + get-port-please v3.2.0
   [!]  Skipped optional: @esbuild/linux-arm (platform mismatch)
   + ml-array-xy-filter-x v1.0.2
   [!]  Skipped optional: @esbuild/linux-mips64el (platform mismatch)
   [!]  Skipped optional: @swc/core-linux-arm-gnueabihf (platform mismatch)
   [!]  Skipped optional: @esbuild/linux-riscv64 (platform mismatch)
   [!]  Skipped optional: @esbuild/linux-arm64 (platform mismatch)
   + file-uri-to-path v1.0.0
   + github-from-package v0.0.0
   + node-gyp-build-optional-packages v5.2.2
   [!]  Skipped optional: @msgpackr-extract/msgpackr-extract-darwin-x64 (platform mismatch)
   [!]  Skipped optional: @msgpackr-extract/msgpackr-extract-win32-x64 (platform mismatch)
   [!]  Skipped optional: @msgpackr-extract/msgpackr-extract-linux-arm64 (platform mismatch)
   [!]  Skipped optional: @msgpackr-extract/msgpackr-extract-darwin-arm64 (platform mismatch)
   [!]  Skipped optional: @msgpackr-extract/msgpackr-extract-linux-arm (platform mismatch)
   + @msgpackr-extract/msgpackr-extract-linux-x64 v3.0.3
   + @nodelib/fs.scandir v2.1.5
   + verror v1.10.0
   + ee-first v1.1.1
   + array-flatten v1.1.1
   + utils-merge v1.0.1
   + forwarded v0.2.0
   + concat-map v0.0.1
   + wrap-ansi-cjs v7.0.0
   + string-width-cjs v4.2.3
   + strip-ansi-cjs v6.0.1
   + @react-native/community-cli-plugin v0.84.0
   + babel-plugin-syntax-hermes-parser v0.32.0
   + @react-native/codegen v0.84.0
   + hermes-compiler v250829098.0.7
   + @react-native/assets-registry v0.84.0
   + @react-native/virtualized-lists v0.84.0
   + @react-native/js-polyfills v0.84.0
   + @react-native/normalize-colors v0.84.0
   + @react-native/gradle-plugin v0.84.0
   + metro-symbolicate v0.83.3
   + @babel/traverse--for-generate-function-map v7.29.0
   + ob1 v0.83.3
   [!]  Skipped optional: fsevents (platform mismatch)
   + bser v2.1.1
   + makeerror v1.0.12
   + @prisma/debug v7.3.0
   + tsscmp v1.0.6
   + rndm v1.2.0
   + uid-safe v2.1.5
   + @chevrotain/gast v10.5.0
   + @chevrotain/cst-dts-gen v10.5.0
   + @chevrotain/utils v10.5.0
   + @chevrotain/types v10.5.0
   + regexp-to-ast v0.5.0
   + @prisma/debug v7.2.0
   + @react-native/dev-middleware v0.84.0
   + metro-cache v0.83.3
   + metro-file-map v0.83.3
   + metro-cache-key v0.83.3
   + metro-transform-worker v0.83.3
   + metro-resolver v0.83.3
   + @react-native-community/cli-doctor v20.1.1
   + @react-native-community/cli-tools v20.1.1
   + @react-native-community/cli-clean v20.1.1
   + @react-native-community/cli-server-api v20.1.1
   + @react-native-community/cli-config v20.1.1
   + @react-native-community/cli-types v20.1.1
   + @react-native/metro-babel-transformer v0.84.0
   + hermes-estree v0.32.1
   + queue v6.0.2
   + tmpl v1.0.5
   + @react-native/debugger-frontend v0.84.0
   + @react-native/debugger-shell v0.84.0
   + metro-minify-terser v0.83.3
   + metro-babel-transformer v0.83.3
   + metro-transform-plugins v0.83.3
   + @react-native-community/cli-platform-apple v20.1.1
   + @react-native-community/cli-platform-ios v20.1.1
   + strict-url-sanitise v0.0.1
   + @react-native/babel-preset v0.84.0
   + fb-dotslash v0.5.8
   + @react-native-community/cli-config-apple v20.1.1
   + @react-native/babel-plugin-codegen v0.84.0
   [!]  Skipped optional: @react-native-community/cli-platform-android (platform mismatch)
[OK] Graph stable. Neural sequence unlocked.

[*] Finalizing storage and artifacts...                             [>>] Syncing dependency tree...                                     
[>>] Finalizing root dependencies...                                
[>>] Executing post-installation sequence...                        
[SCRIPTS] Found 18 script(s) to execute
   ✓ utf-8-validate@6.0.6 → install script completed
   ✓ bufferutil@4.1.0 → install script completed
      │ Setting up Nehonix QuickDev...
      │ ✓ Binary already exists: quickdev-linux-amd64
      │ ✓ Made binary executable
      │ 
      │ 🎉 QuickDev installed successfully!
      │ ✓ Binary: quickdev-linux-amd64
      │ ✓ You can now use 'quickdev' command globally
      │ 
      │ Get started:
      │   quickdev -script your-script.js
      │ 
      │ For more information:
      │   quickdev --help
      │   https://github.com/nehonix/quickdev
   ✓ nquickdev@1.0.3 → postinstall script completed
      │ 📦 [XyNginC] Post-install setup...
   ✓ bcrypt@6.0.0 → install script completed
   ✓ msgpackr-extract@3.0.3 → install script completed
   ✓ prisma@7.4.0 → preinstall script completed
   ✓ esbuild@0.27.3 → postinstall script completed
   ✓ utf-8-validate@5.0.10 → install script completed
      │ ✅ [XyNginC] Already installed: xynginc 1.4.5
   ✓ xynginc@1.0.12 → postinstall script completed
   ✓ usb@1.9.2 → install script completed
      │ 🔧 Running XyPriss post-install setup...
      │ 🚀 Installing XyPriss Memory CLI...
      │ Downloading xsys from https://github.com/Nehonix-Team/XyPriss/releases/latest/download/xsys-linux-amd64...
      │ 📋 Copying binary from development location: /home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/xypriss@5.6.1/node_modules/xypriss/bin/memory-cli-linux-x64
      │ Failed to find package "@oven/bun-linux-x64". You may have used the "--no-optional" flag when running "npm install".
      │ 🔧 Made /home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/xypriss@5.6.1/node_modules/xypriss/bin/memory-cli-linux-x64 executable
      │ ✅ Binary verification successful
      │ 🎉 XyPriss MCLI installed successfully!
      │ ✅ XyPriss setup complete!
   ✓ xypriss@5.6.1 → postinstall script completed
   ✓ @swc/core@1.15.11 → postinstall script completed
   ✓ argon2@0.43.1 → install script completed
      │ **INFO** Skipping Firefox download as instructed.
      │ Error: ERROR: Failed to set up chrome v145.0.7632.46! Set "PUPPETEER_SKIP_DOWNLOAD" env variable to skip download.
      │     at downloadBrowser (file:///home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/puppeteer@24.37.2/node_modules/puppeteer/lib/esm/puppeteer/node/install.js:26:15)
      │     at async Promise.all (index 0)
      │     at async downloadBrowsers (file:///home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/puppeteer@24.37.2/node_modules/puppeteer/lib/esm/puppeteer/node/install.js:84:9) {
      │   [cause]: Error: All providers failed for chrome 145.0.7632.46:
      │     - DefaultProvider: The browser folder (/home/idevo/.cache/puppeteer/chrome/linux-145.0.7632.46) exists but the executable (/home/idevo/.cache/puppeteer/chrome/linux-145.0.7632.46/chrome-linux64/chrome) is missing
      │       at installWithProviders (file:///home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/@puppeteer+browsers@2.12.0/node_modules/@puppeteer/browsers/lib/esm/install.js:108:11)
      │       at async install (file:///home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/@puppeteer+browsers@2.12.0/node_modules/@puppeteer/browsers/lib/esm/install.js:118:12)
      │       at async downloadBrowser (file:///home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/puppeteer@24.37.2/node_modules/puppeteer/lib/esm/puppeteer/node/install.js:14:24)
      │       at async Promise.all (index 0)
      │       at async downloadBrowsers (file:///home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/puppeteer@24.37.2/node_modules/puppeteer/lib/esm/puppeteer/node/install.js:84:9)
      │ }
   ✖ puppeteer@24.37.2 → postinstall script failed: Script exited with code Some(1)
   ✓ better-sqlite3@12.6.2 → install script completed
   ✓ @prisma/engines@7.4.0 → postinstall script completed
      │ Failed to install package "@oven/bun-linux-x64" using "npm install". Error: ENOENT: no such file or directory, rename '/tmp/bun-jPkiRI/node_modules/@oven/bun-linux-x64' -> 'node_modules/@oven/bun-linux-x64'
      │     at Object.renameSync (node:fs:1020:11)
      │     at rename (/home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/bun@1.3.9/node_modules/bun/install.js:189:21)
      │     at installBun (/home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/bun@1.3.9/node_modules/bun/install.js:457:23)
      │     at /home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/bun@1.3.9/node_modules/bun/install.js:429:7
      │     at Generator.next (<anonymous>)
      │     at /home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/bun@1.3.9/node_modules/bun/install.js:41:59
      │     at new Promise (<anonymous>)
      │     at __async (/home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/bun@1.3.9/node_modules/bun/install.js:27:51)
      │     at requireBun (/home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/bun@1.3.9/node_modules/bun/install.js:410:10)
      │     at /home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/bun@1.3.9/node_modules/bun/install.js:401:22 {
      │   errno: -2,
      │   code: 'ENOENT',
      │   syscall: 'rename',
      │   path: '/tmp/bun-jPkiRI/node_modules/@oven/bun-linux-x64',
      │   dest: 'node_modules/@oven/bun-linux-x64'
      │ }
      │ xsys installed successfully at /home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/xypriss@8.1.4/node_modules/xypriss/bin/xsys
   ✓ bun@1.3.9 → postinstall script completed
      │ 🔧 Running XyPriss post-install setup...
      │ 🚀 Installing XyPriss Memory CLI...
      │ 📋 Copying binary from development location: /home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/xypriss@8.1.4/node_modules/xypriss/bin/memory-cli-linux-x64
      │ 🔧 Made /home/idevo/Documents/projects/NehoSell/backend/node_modules/.xpm/virtual_store/xypriss@8.1.4/node_modules/xypriss/bin/memory-cli-linux-x64 executable
      │ ✅ Binary verification successful
      │ 🎉 XyPriss MCLI installed successfully!
      │ ✅ XyPriss setup complete!
   ✓ xypriss@8.1.4 → postinstall script completed
[OK] All postinstall scripts completed (17/18 successful)

[OK] XyPriss Installation complete in 40.72s                           Powered by Nehonix™ & XyPriss Engine                                                                                                 
┌──(idevo㉿iDevo"
