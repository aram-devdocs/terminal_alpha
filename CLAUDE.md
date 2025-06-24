# Claude Development Guidelines

## Pre-task Workflow

When starting any development task, follow this workflow to ensure code quality:

1. **Format first**: Run `npm run format` to fix any formatting issues
2. **Build the project**: Run `npm run build` to compile TypeScript
3. **Check linting**: Run `npm run lint` to identify any code issues
4. **Fix linting issues**: Run `npm run lint:fix` if there are auto-fixable issues

## Code Standards

### TypeScript Requirements

- **No `any` types**: All variables must have explicit types
- **Explicit return types**: All functions must declare their return type
- **Strict null checks**: Handle null/undefined cases explicitly
- **Use const assertions**: Where applicable for literal types

### Code Style

- Use `const` for all variables that won't be reassigned
- Prefer optional chaining (`?.`) over manual null checks
- Use nullish coalescing (`??`) instead of `||` for default values
- Arrow functions should always use parentheses: `(param) => {}`

### Project Structure

- Keep files focused and single-purpose
- Use descriptive file and variable names
- Group related functionality in directories
- Export types from dedicated type files

## Available Scripts

- `npm run dev` - Build and run the application
- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch mode for TypeScript compilation
- `npm run lint` - Check for linting errors
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format all code with Prettier
- `npm run format:check` - Check if code is properly formatted

## Pre-commit Hooks

The project uses Husky and lint-staged to ensure code quality. Before each commit:

1. ESLint will check for code issues
2. Prettier will format the code
3. Only properly formatted and linted code will be committed

## Adding New Features

When adding new functionality:

1. Create appropriate types/interfaces first
2. Implement with proper error handling
3. Add inline documentation for complex logic
4. Ensure all functions have explicit return types
5. Run the full pre-task workflow before committing
