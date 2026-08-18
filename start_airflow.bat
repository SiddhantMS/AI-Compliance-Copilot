@echo off
echo =========================================================
echo   STARTING APACHE AIRFLOW FOR AI COMPLIANCE COPILOT
echo =========================================================
set AIRFLOW_HOME=%~dp0airflow_home
mkdir %AIRFLOW_HOME% 2>nul

echo [1/3] Setting AIRFLOW_HOME to %AIRFLOW_HOME%...
set AIRFLOW__CORE__DAGS_FOLDER=%~dp0dags
set AIRFLOW__CORE__LOAD_EXAMPLES=False

echo [2/3] Initializing Airflow Database...
airflow db init

echo [3/3] Starting Airflow Standalone Server (Webserver + Scheduler on port 8080)...
airflow standalone
