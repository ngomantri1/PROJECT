FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ElevatorERP.Api.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
RUN mkdir -p /app/uploads /app/data-protection-keys \
    && chown -R app:app /app/uploads /app/data-protection-keys
EXPOSE 8080
ENTRYPOINT ["dotnet", "ElevatorERP.Api.dll"]
