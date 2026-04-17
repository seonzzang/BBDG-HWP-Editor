@echo off
setlocal
echo [1/4] Checking prerequisites...
where node >nul 2>&1
if %errorlevel% neq 0 (echo Node.js is missing! && exit /b 1)
where rustc >nul 2>&1
if %errorlevel% neq 0 (echo Rust is missing! Please install from rustup.rs && exit /b 1)
where wasm-pack >nul 2>&1
if %errorlevel% neq 0 (echo wasm-pack is missing! Running cargo install wasm-pack... && cargo install wasm-pack)

echo [2/4] Building WASM engine...
wasm-pack build --target web --out-dir pkg

echo [3/4] Building Studio UI...
cd rhwp-studio
npm install
npm run build
cd ..

echo [4/4] Bundling into Standalone EXE...
where cargo-tauri >nul 2>&1
if %errorlevel% neq 0 (echo Tauri CLI is missing! Running cargo install tauri-cli... && cargo install tauri-cli)
cargo tauri build

echo.
echo Packaging Complete! 
echo Check src-tauri\target\release\rhwp-studio.exe
pause
