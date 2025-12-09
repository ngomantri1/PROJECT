@echo off
title Optimize VPS services (Win Server 2016)

echo ==========================================
echo  DISABLE SOME WINDOWS SERVICES (VPS)
echo  MUST RUN AS ADMINISTRATOR
echo ==========================================
echo.
pause

REM ====== CÁC DỊCH VỤ IT CAN THIET ======

echo.
echo --- Print Spooler ---
sc stop Spooler
sc config Spooler start= disabled

echo.
echo --- Fax service ---
sc stop Fax
sc config Fax start= disabled

echo.
echo --- Smart Card Device Enumeration ---
sc stop ScDeviceEnum
sc config ScDeviceEnum start= disabled

echo.
echo --- Certificate Propagation (smart card) ---
sc stop CertPropSvc
sc config CertPropSvc start= disabled

echo.
echo --- Remote Registry ---
sc stop RemoteRegistry
sc config RemoteRegistry start= disabled

echo.
echo --- Connected Devices Platform Service ---
sc stop CDPSvc
sc config CDPSvc start= disabled

echo.
echo --- Connected User Experiences and Telemetry (DiagTrack) ---
sc stop DiagTrack
sc config DiagTrack start= disabled

echo.
echo --- Contact Data (PIM index) ---
sc stop PimIndexMaintenanceSvc
sc config PimIndexMaintenanceSvc start= disabled

echo.
echo --- Program Compatibility Assistant Service ---
sc stop PcaSvc
sc config PcaSvc start= disabled

echo.
echo --- Distributed Link Tracking Client ---
sc stop TrkWks
sc config TrkWks start= disabled

echo.
echo --- SSDP Discovery (UPnP) ---
sc stop SSDPSRV
sc config SSDPSRV start= disabled

echo.
echo --- Windows Search (indexing) ---
sc stop WSearch
sc config WSearch start= disabled

echo.
echo --- Windows Push Notifications System Service ---
sc stop WpnService
sc config WpnService start= disabled

echo.
echo --- Windows Push Notifications User Service ---
sc stop WpnUserService
sc config WpnUserService start= disabled

echo.
echo --- Tile Data model server (Live Tiles) ---
sc stop tiledatamodelsvc
sc config tiledatamodelsvc start= disabled

echo.
echo --- Time Broker (UWP apps) ---
sc stop TimeBrokerSvc
sc config TimeBrokerSvc start= disabled

echo.
echo --- User Access Logging Service ---
sc stop UALSVC
sc config UALSVC start= disabled

REM ====== WINDOWS UPDATE VA LIEN QUAN ======

echo.
echo --- Windows Update service ---
sc stop wuauserv
sc config wuauserv start= disabled

echo.
echo --- Update Orchestrator Service ---
sc stop UsoSvc
sc config UsoSvc start= disabled

echo.
echo --- Delivery Optimization ---
sc stop DoSvc
sc config DoSvc start= disabled

echo.
echo --- Windows Update Medic Service ---
sc stop WaaSMedicSvc
sc config WaaSMedicSvc start= disabled

echo.
echo ==========================================
echo  DONE. KIEM TRA LAI SERVICES.MSC VA RESTART VPS
echo ==========================================
echo.
pause
