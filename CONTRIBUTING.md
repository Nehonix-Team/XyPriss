# Contributing to XyPriss

Thank you for your interest in contributing to the XyPriss framework. We welcome contributions that align with our mission of providing high-performance, secure, and developer-friendly infrastructure.

## License Compliance

XyPriss is licensed under the **Nehonix Open Source License (NOSL) v1.0**. By contributing to this project, you agree that:

1.  **Work for Hire**: All contributions, including code, documentation, and assets, are considered "works made for hire" for Nehonix.
2.  **IP Protection**: Nehonix retains all intellectual property rights. You grant Nehonix a non-exclusive, perpetual, irrevocable, worldwide, royalty-free license to use, modify, and distribute your contributions.
3.  **No Unauthorized Distribution**: You may not distribute derivative works of XyPriss outside the terms specified in the NOSL without explicit written authorization from Nehonix Legal Department.

For the full legal text, please refer to the [LICENSE](LICENSE) or visit [https://dll.nehonix.com/licenses/NOSL](https://dll.nehonix.com/licenses/NOSL).

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

### 1. Preparation
Before starting work, search the active issues to ensure you are not duplicating effort. For significant changes, please open a new issue to discuss your proposed design with the Nehonix Team.

### 2. Implementation
1.  **Fork** the repository and create a feature branch from `master`.
2.  **Develop** your changes following the technical standards mentioned above.
3.  **Test** your implementation thoroughly. Performance-critical changes should include benchmarks.

### 3. Submission
1.  Ensure your branch is up-to-date with the upstream `master`.
2.  Submit a **Pull Request (PR)** with a concise, technical description of the changes.
3.  Link the PR to the relevant issue using "Closes #issue-number".

## Pull Request Guidelines

-   **Atomic Commits**: Keep commits focused on a single logical change.
-   **Documentation**: Update relevant `.md` files in `docs/` if your change affects the public API or behavior.
-   **No Breaking Changes**: If a breaking change is necessary, it must be explicitly highlighted in the PR description for architectural review.

## Security Disclosures

Do not report security vulnerabilities through public issues. To report a security concern, please contact our security team at [support@team.nehonix.com](mailto:support@team.nehonix.com).

---

*© 2026 Nehonix Team. All rights reserved.*
