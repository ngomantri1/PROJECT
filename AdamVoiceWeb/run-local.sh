#!/usr/bin/env bash
cd "$(dirname "$0")"
dotnet restore
dotnet run --urls http://localhost:5000
