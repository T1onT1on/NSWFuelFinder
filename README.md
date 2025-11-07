# NSWFuelFinder  
**Full-stack showcase project for NSW FuelCheck — ASP.NET Core Minimal API + React + Vite**

![.NET](https://img.shields.io/badge/.NET-8.0-blue?logo=dotnet)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react)
![Postgres]([https://img.shields.io/badge/SQLite-3-lightgrey?logo=sqlite](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white))
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Overview  
**NSWFuelFinder** is a full-stack web application that visualizes live NSW FuelCheck data — showing nearby stations, cheapest prices, and price trends.

It demonstrates:
- Building a **Minimal API backend** with ASP.NET Core 8 + EF Core (SQLite)  
- Implementing **JWT authentication** and **Google OAuth**  
- Designing a **React + Vite (TypeScript)** frontend  
- Scheduling background data sync with NSW Fuel API  


---

## Tech Stack  

### Backend  
- ASP.NET Core 8.0 Minimal API  
- Entity Framework Core + SQLite  
- Dapper (optional lightweight queries)  
- JWT Auth + Google OAuth  
- Background Hosted Service for NSW Fuel API sync  

### Frontend  
- React 18 + TypeScript + Vite  
- Fast Refresh HMR + ESLint  
- Modular folder structure  

---

## Core API Endpoints  

| Method | Endpoint | Description |
|:-------|:----------|:-------------|
| `GET` | `/api/stations/nearby` | Query nearby fuel stations by suburb, fuel type, or radius |
| `GET` | `/api/prices/cheapest` | Aggregate the cheapest price per fuel type |
| `GET` | `/api/stations/{code}/trends` | Retrieve 7 / 30 / 90 day price trends |
| `POST` | `/api/auth/register` / `login` | Local account registration / login |
| `GET` | `/api/auth/google/login` | Start Google OAuth login |
| `GET` | `/api/auth/google/callback` | Handle Google OAuth callback |

---

## Quick Start  

### Backend  
```bash
cd backend
dotnet restore
dotnet run
```

more details will be updated...
