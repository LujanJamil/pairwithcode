@echo off
REM Database Reset Script for Pair With Code (Windows)

echo.
echo 4 Database Reset Starting...
echo.

REM Load environment from .env
for /f "usebackq tokens=*" %%a in (.env) do (
    if not "%%a"=="" (
        if not "%%a:~0,1%%" == ";" (
            set "%%a"
        )
    )
)

REM Database connection details
if not defined DB_HOST set DB_HOST=localhost
if not defined DB_PORT set DB_PORT=5432
if not defined DB_USER set DB_USER=pairwithcode
if not defined DB_NAME set DB_NAME=pairwithcode
if not defined DB_PASSWORD set DB_PASSWORD=pairwithcode123

echo Connecting to database: %DB_HOST%:%DB_PORT%/%DB_NAME%
echo.

REM Drop existing database if it exists
echo 4 Dropping existing database...
psql -h %DB_HOST% -U %DB_USER% -tc "SELECT 1 FROM pg_database WHERE datname = '%DB_NAME%'" | findstr "1" >nul 2>&1
if %errorlevel% equ 0 (
    psql -h %DB_HOST% -U %DB_USER% -c "DROP DATABASE IF EXISTS %DB_NAME%;" 2>nul
)

REM Create fresh database
echo 4 Creating fresh database...
psql -h %DB_HOST% -U %DB_USER% -c "CREATE DATABASE %DB_NAME% OWNER %DB_USER%;"

if %errorlevel% neq 0 (
    echo Error: Failed to create database
    exit /b 1
)

REM Enable extensions
echo 4 Enabling extensions...
psql -h %DB_HOST% -U %DB_USER% -d %DB_NAME% -c "CREATE EXTENSION IF NOT EXISTS uuid-ossp;"
psql -h %DB_HOST% -U %DB_USER% -d %DB_NAME% -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

REM Apply initial schema
echo 4 Applying initial schema (001_init.sql)...
psql -h %DB_HOST% -U %DB_USER% -d %DB_NAME% -f migrations\001_init.sql

if %errorlevel% neq 0 (
    echo Warning: Initial schema migration had errors (it might already exist)
)

REM Apply advanced features schema
echo 4 Applying advanced features schema (002_add_advanced_features.sql)...
psql -h %DB_HOST% -U %DB_USER% -d %DB_NAME% -f migrations\002_add_advanced_features.sql

if %errorlevel% neq 0 (
    echo Warning: Advanced features schema migration had errors
)

REM Seed basic data
echo 4 Seeding initial data...
(
    echo INSERT INTO users (id, email, username, oauth_provider^)
    echo VALUES ('admin', 'admin@pairwithcode.local', 'admin', 'local'^)
    echo ON CONFLICT DO NOTHING;
    echo.
    echo SELECT 'Database seeded successfully' AS status;
) | psql -h %DB_HOST% -U %DB_USER% -d %DB_NAME%

REM Display verification
echo.
echo 4 Database reset complete!
echo.
echo Next steps:
echo 1. Start backend: cd backend && npm run dev
echo 2. Check database connection: npm run db:check
echo.
pause
