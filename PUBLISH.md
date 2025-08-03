# Publishing to NPM

## Prerequisites

1. **NPM Account**: Create account at [npmjs.com](https://www.npmjs.com)
2. **NPM CLI**: Install with `npm install -g npm`
3. **Login**: Run `npm login` and enter credentials

## Pre-publish Checklist

- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` with new version
- [ ] Update author information in `package.json`
- [ ] Update repository URLs in `package.json`
- [ ] Ensure all tests pass: `npm test`
- [ ] Build the project: `npm run build`
- [ ] Check package contents: `npm pack --dry-run`

## Publishing Steps

### 1. Update Package Information

```bash
# Update package.json with your details
npm config set init-author-name "Your Name"
npm config set init-author-email "your.email@example.com"
```

### 2. Version Management

```bash
# Patch version (1.0.0 -> 1.0.1)
npm version patch

# Minor version (1.0.0 -> 1.1.0)
npm version minor

# Major version (1.0.0 -> 2.0.0)
npm version major
```

### 3. Test Package Locally

```bash
# Create tarball to inspect contents
npm pack

# Test installation locally
npm install -g ./nodejs-rag-module-1.0.0.tgz
```

### 4. Publish to NPM

```bash
# Publish to public registry
npm publish

# Publish scoped package
npm publish --access public
```

## Post-publish

1. **Verify**: Check package at `https://www.npmjs.com/package/nodejs-rag-module`
2. **Tag Release**: Create GitHub release with same version
3. **Update Documentation**: Ensure installation instructions are correct

## Package Structure

```
nodejs-rag-module/
├── dist/                 # Built JavaScript files
│   ├── index.js
│   ├── index.d.ts
│   └── services/
├── README.md
├── LICENSE
├── CHANGELOG.md
└── package.json
```

## Installation for Users

```bash
npm install nodejs-rag-module
```

## Usage Example

```typescript
import { RAGModule } from 'nodejs-rag-module';

const rag = new RAGModule({
  modelPath: './nomic-embed-text-v1.5.Q5_K_M.gguf',
  databasePath: './vectors.db'
});
```