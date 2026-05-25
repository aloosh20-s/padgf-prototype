@echo off
echo ========================================================
echo PADGF Presentation Launcher - CLI Interface
echo ========================================================
echo.
echo [1/2] Spinning up deterministic Ethereum Mainnet Fork (Block 19400000)...
start "Hardhat Ethereum Node" cmd /k "npx hardhat node"

echo Waiting for node to initialize...
timeout /t 6 /nobreak > NUL

echo [2/2] Launching CLI Interface...
cls
node interface/cli.js

echo.
echo Exited PADGF Interface. Remember to close the other Node window when finished.
pause
