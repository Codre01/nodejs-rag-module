# Contributing to Embedding Vector Database (RAG Module)

Thank you for your interest in contributing to the Embedding Vector Database project! This guide will help you get started with contributing to our TypeScript Node.js RAG module.

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 16.0.0
- **npm** or **yarn**
- **Git**
- **TypeScript** knowledge

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/embedding-vec2-o.git
   cd embedding-vec2-o
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Download Model** (for testing)
   ```bash
   # Download the embedding model
   wget https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q5_K_M.gguf
   ```

4. **Build Project**
   ```bash
   npm run build
   ```

5. **Run Tests**
   ```bash
   npm test
   ```

## 📋 How to Contribute

### Types of Contributions

- **Bug Reports** - Help us identify and fix issues
- **Feature Requests** - Suggest new functionality
- **Code Contributions** - Submit bug fixes or new features
- **Documentation** - Improve docs, examples, or guides
- **Testing** - Add test cases or improve test coverage

### Before You Start

1. **Check existing issues** to avoid duplicates
2. **Create an issue** for major changes to discuss approach
3. **Follow coding standards** outlined below

## 🐛 Reporting Bugs

### Bug Report Template

```markdown
**Bug Description**
A clear description of the bug.

**Steps to Reproduce**
1. Initialize RAG module with...
2. Call method...
3. See error...

**Expected Behavior**
What should have happened.

**Environment**
- Node.js version:
- OS:
- Package version:

**Additional Context**
Any other relevant information.
```

### Before Submitting

- [ ] Search existing issues
- [ ] Include minimal reproduction case
- [ ] Test with latest version
- [ ] Include error logs/stack traces

## 💡 Feature Requests

### Feature Request Template

```markdown
**Feature Description**
Clear description of the proposed feature.

**Use Case**
Why is this feature needed? What problem does it solve?

**Proposed Solution**
How should this feature work?

**Alternatives Considered**
Other approaches you've considered.
```

## 🔧 Development Guidelines

### Code Style

- **TypeScript** with strict mode enabled
- **ESLint** for code linting
- **Prettier** for code formatting
- **JSDoc** comments for public APIs

### Project Structure

```
src/
├── index.ts              # Main entry point
├── types/                # TypeScript type definitions
├── services/             # Core services (embedding, database, search)
├── utils/                # Utility functions
├── errors/               # Error handling
└── __tests__/            # Test files
```

### Coding Standards

1. **Naming Conventions**
   - Classes: `PascalCase`
   - Functions/Variables: `camelCase`
   - Constants: `UPPER_SNAKE_CASE`
   - Files: `camelCase.ts`

2. **Error Handling**
   - Use custom `RAGError` class
   - Include error codes and context
   - Provide meaningful error messages

3. **Async/Await**
   - Use async/await over Promises
   - Handle errors properly
   - Clean up resources in finally blocks

4. **Documentation**
   - JSDoc for all public methods
   - Include usage examples
   - Document error conditions

### Example Code Style

```typescript
/**
 * Embeds text and saves it to the database.
 * 
 * @param request - The save request containing text and metadata
 * @returns Promise that resolves to true if successful
 * @throws {RAGError} When validation fails or save operation fails
 * 
 * @example
 * ```typescript
 * const success = await rag.save({
 *   id: 1,
 *   text: 'Sample text',
 *   tablename: 'documents'
 * });
 * ```
 */
async save(request: SaveRequest): Promise<boolean> {
  try {
    this.validateSaveRequest(request);
    // Implementation...
    return true;
  } catch (error) {
    this.logger.error('Save operation failed', { error });
    throw new RAGError(
      `Failed to save: ${error.message}`,
      ErrorCodes.VECTOR_SAVE_FAILED,
      error
    );
  }
}
```

## 🧪 Testing

### Test Structure

- **Unit Tests** - Test individual components
- **Integration Tests** - Test component interactions
- **End-to-End Tests** - Test complete workflows

### Writing Tests

```typescript
describe('RAGModule', () => {
  let rag: RAGModule;

  beforeEach(async () => {
    rag = new RAGModule({
      modelPath: './test-model.gguf',
      databasePath: ':memory:'
    });
    await rag.initialize();
  });

  afterEach(async () => {
    await rag.close();
  });

  it('should embed text successfully', async () => {
    const vector = await rag.embed({ text: 'test text' });
    expect(vector).toHaveLength(768);
    expect(vector[0]).toBeTypeOf('number');
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- embedding.test.ts
```

## 📝 Pull Request Process

### Before Submitting

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Follow coding standards
   - Add tests for new functionality
   - Update documentation

3. **Test Your Changes**
   ```bash
   npm test
   npm run build
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new embedding model support"
   ```

### Commit Message Format

Use conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding tests
- `refactor`: Code refactoring
- `perf`: Performance improvements

**Examples:**
```
feat(embedding): add support for custom models
fix(database): resolve connection timeout issue
docs(readme): update installation instructions
test(search): add edge case tests for empty results
```

### Pull Request Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement

## Testing
- [ ] Tests pass locally
- [ ] Added new tests for changes
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

## 🏗️ Architecture Guidelines

### Adding New Features

1. **Design First** - Create issue to discuss approach
2. **Interface Design** - Define TypeScript interfaces
3. **Implementation** - Follow existing patterns
4. **Testing** - Comprehensive test coverage
5. **Documentation** - Update README and JSDoc

### Database Changes

- Maintain backward compatibility
- Add migration scripts if needed
- Test with different SQLite versions
- Consider performance implications

### Model Integration

- Support GGUF format models
- Validate model compatibility
- Handle model loading errors gracefully
- Document model requirements

## 🔍 Code Review Process

### What We Look For

- **Correctness** - Does the code work as intended?
- **Performance** - Are there any performance issues?
- **Security** - Are there security vulnerabilities?
- **Maintainability** - Is the code easy to understand and modify?
- **Testing** - Is there adequate test coverage?

### Review Checklist

- [ ] Code follows project standards
- [ ] Tests are comprehensive
- [ ] Documentation is updated
- [ ] No breaking changes (or properly documented)
- [ ] Performance impact considered
- [ ] Error handling is robust

## 🚀 Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** - Breaking changes
- **MINOR** - New features (backward compatible)
- **PATCH** - Bug fixes (backward compatible)

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Git tag created
- [ ] NPM package published

## 🤝 Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Maintain professional communication

### Getting Help

- **GitHub Issues** - For bugs and feature requests
- **GitHub Discussions** - For questions and general discussion
- **Documentation** - Check README and code comments first

## 📚 Resources

### Learning Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [SQLite Documentation](https://sqlite.org/docs.html)
- [Vector Databases Guide](https://www.pinecone.io/learn/vector-database/)

### Project Resources

- [Project Architecture](/.kiro/specs/nodejs-rag-module/design.md)
- [Requirements Document](/.kiro/specs/nodejs-rag-module/requirements.md)
- [API Documentation](./README.md#api-reference)

---

Thank you for contributing to the Embedding Vector Database project! 🎉