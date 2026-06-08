# dummy-app


Welcome to your new **XyPriss** project. This project has been initialized using the high-performance XHSC engine and is designed with a **Zero-Trust** security model in mind.

## Overview

A high-performance XyPriss server.


## Project Architecture

The project is organized into modular layers to ensure strict separation of concerns:

- **Core Entry Point**: The main server instance (typically `src/server.ts`) orchestrates subsystems and boot cycles.
- **Configuration Store**: Managed via the **Environment Security Shield**, ensuring no secrets leak globally.
- **Traffic Management**: Uses the native Radix-Trie router for efficient request distribution.
- **Business Logic**: Isolated service layers for simplified maintenance and testing.
- **Server Definitions**: (XMS Mode) Multiple isolated server instances (e.g., API, Auth, Admin) running on distinct ports.

## Project Architecture

The project is organized into modular layers to ensure strict separation of concerns:

- **Core Entry Point**: The main server instance (typically `src/server.ts`) orchestrates subsystems and boot cycles.
- **Configuration Store**: Managed via the **Environment Security Shield**, ensuring no secrets leak globally.
- **Traffic Management**: Uses the native Radix-Trie router for efficient request distribution.
- **Business Logic**: Isolated service layers for simplified maintenance and testing.
- **Server Definitions**: (XMS Mode) Multiple isolated server instances (e.g., API, Auth, Admin) running on distinct ports.

## Getting Started

1. **Install Dependencies**:
   ```bash
   xfpm install
   ```

2. **Configure Environment**:
   Copy `.env.example` to `.env` and fill in your secrets.

3. **Run in Development**:
   ```bash
   xfpm dev
   ```

4. **Run Audit**:
   ```bash
   xfpm run audit
   ```

---
*Project initialized by Nehonix-Team using XFPM*
