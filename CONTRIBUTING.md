# Contributing to XyPriss

Thank you for your interest in contributing to XyPriss! This document provides guidelines and information for contributors.

## Table of Contents

-   [Code of Conduct](#code-of-conduct)
-   [Getting Started](#getting-started)
-   [Development Setup](#development-setup)
-   [Project Structure](#project-structure)
-   [Contributing Guidelines](#contributing-guidelines)
-   [Pull Request Process](#pull-request-process)
-   [Testing](#testing)
-   [Documentation](#documentation)
-   [Security](#security)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. We are committed to providing a welcoming and inclusive environment for all contributors.

### Our Standards

-   Use welcoming and inclusive language
-   Be respectful of differing viewpoints and experiences
-   Gracefully accept constructive criticism
-   Focus on what is best for the community
-   Show empathy towards other community members

## Getting Started

### Prerequisites

-   Node.js 18+
-   npm or yarn
-   Git
-   TypeScript knowledge
-   Express.js familiarity

### Development Setup

1. **Fork the repository**

    ```bash
    git clone https://github.com/your-username/XyPriss.git
    cd XyPriss
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Build the project**

    ```bash
    npm run build
    ```

4. **Run tests**

    ```bash
    npm test
    ```

5. **Start development**
    ```bash
    npm run dev
    ```

## Project Structure

```
XyPriss/
├── src/                      # Core framework source
│   ├── ServerFactory.ts      # Main entry point
│   ├── server/              # Server implementation
│   ├── cache/               # Caching system
│   ├── cluster/             # Clustering features
│   ├── security-middleware.ts # Security layer
│   ├── plugins/             # Plugin system
│   └── types/               # TypeScript definitions
├── mods/security            # XyPriss Security module
│   ├── src/core/           # Cryptographic core
│   ├── src/components/     # Secure data structures
│   └── src/utils/          # Security utilities
├── __tests__/              # Test files
├── docs/                   # Documentation
└── dist/                   # Built files
```

## Contributing Guidelines

### Types of Contributions

We welcome several types of contributions:

1. **Bug Reports**: Help us identify and fix issues
2. **Feature Requests**: Suggest new features or improvements
3. **Code Contributions**: Submit bug fixes or new features
4. **Documentation**: Improve or add documentation
5. **Testing**: Add or improve test coverage

### Before You Start

1. **Check existing issues** to avoid duplicate work
2. **Create an issue** for significant changes to discuss the approach
3. **Follow coding standards** outlined below
4. **Write tests** for new functionality
5. **Update documentation** as needed

### Coding Standards

#### TypeScript Guidelines

-   Use TypeScript for all new code
-   Provide proper type definitions
-   Avoid `any` types when possible
-   Use interfaces for object shapes
-   Follow existing naming conventions

#### Code Style

-   Use 4 spaces for indentation
-   Use semicolons
-   Use double quotes for strings
-   Follow existing code formatting
-   Use meaningful variable and function names

#### Example Code Style

```typescript
interface ServerConfig {
    port?: number;
    host?: string;
    security?: SecurityConfig;
}

export function createServer(options: ServerConfig = {}): Express {
    const app = express();

    if (options.security?.enabled) {
        app.use(securityMiddleware(options.security));
    }

    return app;
}
```

### Commit Guidelines

#### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

#### Types

-   `feat`: New feature
-   `fix`: Bug fix
-   `docs`: Documentation changes
-   `style`: Code style changes (formatting, etc.)
-   `refactor`: Code refactoring
-   `test`: Adding or updating tests
-   `chore`: Maintenance tasks

#### Examples

```
feat(cache): add Redis cluster support

Add support for Redis cluster configuration in cache system.
Includes automatic failover and load balancing.

Closes #123
```

```
fix(security): resolve timing attack vulnerability

Fix constant-time comparison in authentication middleware
to prevent timing-based attacks.

Security issue reported by: @security-researcher
```

## Pull Request Process

### Before Submitting

1. **Create a feature branch** from `master`

    ```bash
    git checkout -b feature/your-feature-name
    ```

2. **Make your changes** following the guidelines above

3. **Add tests** for new functionality

4. **Update documentation** if needed

5. **Run the test suite**

    ```bash
    npm test
    ```

6. **Build the project**
    ```bash
    npm run build
    ```

### Submitting the Pull Request

1. **Push your branch** to your fork

    ```bash
    git push origin feature/your-feature-name
    ```

2. **Create a pull request** with:

    - Clear title and description
    - Reference to related issues
    - Screenshots if applicable
    - Test results

3. **Respond to feedback** from reviewers

### Pull Request Template

```markdown
## Description

Brief description of changes

## Type of Change

-   [ ] Bug fix
-   [ ] New feature
-   [ ] Breaking change
-   [ ] Documentation update

## Testing

-   [ ] Tests pass locally
-   [ ] New tests added for new functionality
-   [ ] Manual testing completed

## Checklist

-   [ ] Code follows project style guidelines
-   [ ] Self-review completed
-   [ ] Documentation updated
-   [ ] No breaking changes (or clearly documented)
```

## Testing

### Test Structure

```
__tests__/
├── unit/                    # Unit tests
├── integration/             # Integration tests
├── security/               # Security tests
└── performance/            # Performance tests
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- cache.test.ts

# Run tests with coverage
npm run test:coverage

# Run security tests
npm run test:security
```

### Writing Tests

-   Use Jest for testing framework
-   Write descriptive test names
-   Test both success and error cases
-   Mock external dependencies
-   Aim for high test coverage

#### Example Test

```typescript
describe("createServer", () => {
    it("should create server with default configuration", () => {
        const server = createServer();
        expect(server).toBeDefined();
        expect(server.listen).toBeDefined();
    });

    it("should apply custom port configuration", () => {
        const server = createServer({
            server: { port: 8080 },
        });
        // Test implementation
    });
});
```

## Documentation

### Documentation Types

1. **API Documentation**: Function and class documentation
2. **User Guides**: How-to guides and tutorials
3. **Architecture Documentation**: System design and structure
4. **Examples**: Code examples and use cases

### Documentation Standards

-   Use clear, concise language
-   Provide code examples
-   Keep documentation up-to-date with code changes
-   Use proper markdown formatting
-   Include table of contents for long documents

### Building Documentation

```bash
# Generate API documentation
npm run docs:api

# Build all documentation
npm run docs:build

# Serve documentation locally
npm run docs:serve
```

## Security

### Security Considerations

-   Never commit sensitive information (keys, passwords, etc.)
-   Follow secure coding practices
-   Report security vulnerabilities privately
-   Use the XyPriss Security module for cryptographic operations

### Reporting Security Issues

**Do not create public issues for security vulnerabilities.**

Instead, email security issues to: security@nehonix.com

Include:

-   Description of the vulnerability
-   Steps to reproduce
-   Potential impact
-   Suggested fix (if any)

### Security Review Process

All security-related changes undergo additional review:

1. Security team review
2. Automated security scanning
3. Manual security testing
4. Documentation review

## Getting Help

### Resources

-   [Documentation](./docs/)
-   [API Reference](./docs/api-reference.md)
-   [Architecture Guide](./docs/architecture.md)
-   [GitHub Issues](https://github.com/Nehonix-Team/XyPriss/issues)

### Community

-   GitHub Discussions for questions and ideas
-   Issues for bug reports and feature requests
-   Pull requests for code contributions

### Contact

-   General questions: Create a GitHub Discussion
-   Bug reports: Create a GitHub Issue
-   Security issues: security@nehonix.com
-   Maintainers: @Nehonix-Team

## Recognition

Contributors are recognized in:

-   CONTRIBUTORS.md file
-   Release notes for significant contributions
-   GitHub contributor statistics

Thank you for contributing to XyPriss! Your contributions help make the framework better for everyone.

