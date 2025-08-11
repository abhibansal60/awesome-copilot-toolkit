# Changelog

All notable changes to the Awesome Copilot Toolkit extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of Awesome Copilot Toolkit
- Browse and search functionality for awesome-copilot repository items
- Support for Custom Instructions, Reusable Prompts, and Custom Chat Modes
- **Keyword search functionality with intelligent suggestions (no minimum limit)**
- **Advanced rate limiting protection with automatic delays and smart waiting**
- **Multiple UX access methods: Status bar, sidebar panel, context menus**
- **Real-time rate limit monitoring in status bar**
- Rich preview system for markdown and JSON content
- One-click installation to workspace or untitled documents
- Smart caching system with configurable TTL
- Deep link support for chat instructions
- Comprehensive configuration options
- Telemetry tracking (respects VS Code settings)
- Command palette integration
- Error handling and offline fallback support

### Features
- **Content Indexing**: Automatic indexing of GitHub repository contents
- **Quick Pick Browser**: Intuitive search and filtering interface
- **Preview System**: Webview-based preview with action buttons
- **Installation Service**: Flexible installation options
- **GitHub Integration**: REST API with ETag support and rate limiting
- **Caching**: Local storage with TTL-based invalidation
- **Error Handling**: Graceful fallbacks and user-friendly error messages
- **Status Bar Integration**: Always visible access with dropdown menu
- **Sidebar Panel**: Dedicated tree view for browsing and actions
- **Context Menus**: Right-click integration for quick actions

### Technical
- TypeScript implementation with strict type checking
- VS Code Extension API integration
- esbuild bundling for optimal performance
- ESLint and Prettier code quality tools
- Comprehensive test suite with E2E smoke tests
- Modern ES2020+ features and async/await patterns

## [0.1.0] - 2024-01-XX

### Added
- Initial beta release
- Core browsing and installation functionality
- Basic preview system
- Configuration management
- Error handling and logging

### Known Issues
- Deep linking may not work in all VS Code versions
- Network failures fall back to cached data
- Rate limiting may occur with heavy GitHub API usage
