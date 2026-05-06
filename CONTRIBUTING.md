# Contributing to XyPriss

Thank you for your interest in contributing to the XyPriss framework. We welcome contributions that align with our mission of providing high-performance, secure, and developer-friendly infrastructure.

## License Compliance

XyPriss is licensed under the **Nehonix Open Source License (NOSL) v2.0**. By contributing to this project, you agree that:

1.  **Work for Hire**: All contributions, including code, documentation, and assets, are considered "works made for hire" for Nehonix.
2.  **IP Protection**: Nehonix retains all intellectual property rights. You grant Nehonix a non-exclusive, perpetual, irrevocable, worldwide, royalty-free license to use, modify, and distribute your contributions.
3.  **No Unauthorized Distribution**: You may not distribute derivative works of XyPriss outside the terms specified in the NOSL without explicit written authorization from Nehonix Legal Department.

For the full legal text, please refer to the [LICENSE](LICENSE) or visit [https://dll.nehonix.com/licenses/NOSL/v2](https://dll.nehonix.com/licenses/NOSL/v2).

## Technical Standards

To maintain the integrity and performance of XyPriss, all contributions must adhere to these standards:

-   **Language**: Use TypeScript for all application-layer logic and Go for core engine (XHSC) updates.
-   **Modularity**: Code must be modular and maintainable. Avoid monolithic functions or classes.
-   **Style**:
    -   Maintain a professional and serious tone in all comments and documentation.
    -   **No emojis** are permitted in the codebase or documentation.
    -   Use `lucide-react` for frontend icons if applicable.
-   **Tooling**: Use `xfpm` for dependency management and task execution.

## Contribution Workflow

### 1. Environment Setup
To maintain consistency with the XyPriss security and performance model, contributors must adhere to the following setup:

1.  **Fork** the repository and create a feature branch from `master`.
2.  **Tooling**: Ensure `xfpm` is installed on your system. **npm, yarn, or pnpm are strictly prohibited** for dependency management in this project.
3.  **Native Engine (XHSC)**: You must install the XHSC core in a `bin/` directory at the project root. You can choose one of the following methods:
    -   **Automated (Recommended)**:
        -   *Linux/macOS*: `curl -sL https://dll.nehonix.com/tools/xypriss/install-xhsc.sh | bash`
        -   *Windows*: `iwr -useb https://dll.nehonix.com/tools/xypriss/install-xhsc.ps1 | iex`
    -   **Manual**: Download the binary for your platform from [http://dll.nehonix.com/repo/xypriss/xhsc/bin](http://dll.nehonix.com/repo/xypriss/xhsc/bin), create a `bin/` folder at the root, and save the binary as `xhsc` (or `xhsc.exe` on Windows).
4.  **Initialization**: Execute `xfpm install` to resolve dependencies and link the native core.

### 2. Implementation & Validation
1.  **Develop** your changes following the technical standards mentioned above.
2.  **Mandatory Simulation**: Every contribution must be accompanied by a simulation project located in the `simulations/` directory (e.g., `simulations/your-feature`).
3.  **Simulation Architecture**: Your simulation must follow the architecture of `simulations/XCIS`:
    -   **TypeScript Configuration**: The `tsconfig.json` must map the `xypriss` module to the local source: `"xypriss": ["../../src/index.ts"]`.
    -   **Dependency Management**: The simulation's `package.json` **must not** include `xypriss` in the `dependencies` list.
4.  **Pre-Submission Testing**: Implement the necessary routes, tests, and scenarios within your simulation to verify and approve the feature before opening a Pull Request.

### 3. Submission
1.  Ensure your branch is up-to-date with the upstream `master`.
2.  Submit a **Pull Request (PR)** with a concise, technical description of the changes and a link to your simulation for review.
3.  Link the PR to the relevant issue using "Closes #issue-number".

## Pull Request Guidelines

-   **Atomic Commits**: Keep commits focused on a single logical change.
-   **Documentation**: Update relevant `.md` files in `docs/` if your change affects the public API or behavior.
-   **No Breaking Changes**: If a breaking change is necessary, it must be explicitly highlighted in the PR description for architectural review.

## Security Disclosures

Do not report security vulnerabilities through public issues. To report a security concern, please contact our security team at [support@team.nehonix.com](mailto:support@team.nehonix.com).

---

*© 2026 Nehonix Team. All rights reserved.*
