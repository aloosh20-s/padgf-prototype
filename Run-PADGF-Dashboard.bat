@echo off
echo ========================================================
echo PADGF Presentation Launcher - Supervisor Dashboard
echo ========================================================
echo.
echo [1/3] Spinning up deterministic Ethereum Mainnet Fork (Block 19400000)...
start "Hardhat Ethereum Node" cmd /k "npx hardhat node"

echo Waiting for node to initialize...
timeout /t 6 /nobreak > NUL

echo [2/3] Starting the Local Supervisor Dashboard Server...
start "PADGF Web Dashboard" cmd /k "node dashboard/server.js"

echo Waiting for server to initialize...
timeout /t 3 /nobreak > NUL

echo [3/3] Opening web browser...
start http://localhost:3000

echo.
echo Launch Complete! 
echo IMPORTANT: Keep the two newly opened black terminal windows open while presenting.
echo When you are done with the demonstration, just close those terminal windows.
echo.
pause
