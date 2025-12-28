# XyPriss Plugin System

This directory contains the core logic and modules for the XyPriss plugin system.

## Directory Structure

-   `api/`: Public API for plugin interaction.
-   `const/`: Constants and Hook IDs.
-   `core/`: Core implementation (PluginManager, etc.).
-   `modules/`: Built-in plugin modules.
-   `types/`: TypeScript type definitions.

## Security and Permissions

XyPriss prioritizes security in its plugin architecture. Plugins are subject to strict controls to ensure system stability and data privacy.

### Key Security Features

1.  **Permission Model**: Plugins must have explicit permission to execute specific hooks. See [PLUGIN_PERMISSIONS.md](../../docs/PLUGIN_PERMISSIONS.md) for details.
2.  **Request Data Masking**: Sensitive request data (`body`, `query`, `cookies`, `params`) is masked in plugin hooks to prevent unauthorized data access. See [PLUGIN_DATA_MASKING.md](../../docs/PLUGIN_DATA_MASKING.md) for more information.

## Developing Plugins

For a comprehensive guide on how to create and manage plugins, please refer to the [Plugin Development Guide](../../docs/PLUGIN_DEVELOPMENT_GUIDE.md).

