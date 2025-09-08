# Error Handling

This document describes PromptBridge's error handling strategy and implementation.

## Overview

PromptBridge uses a two-tier error handling approach:
- **Top-level UI errors**: For main application flow failures (model loading, conversation resume)
- **Per-pane errors**: For individual model streaming failures

## Top-Level UI Errors

### When to Use

Use the top-level `uiError` state for errors that affect the core application functionality:

- Model loading failures (API/network issues)
- Conversation loading failures (resume from history)
- Authentication/authorization errors
- Critical system errors

### Implementation

Top-level errors are displayed via the `uiError` state and rendered in a banner at lines 669-674 in `src/app/page.tsx`:

```tsx
{uiError && (
  <div role="alert" className="mb-3 rounded-xl border border-red-400/20 bg-red-500/10 text-red-300 px-3 py-2 flex items-start justify-between gap-3">
    <span className="text-sm">{uiError}</span>
    <button className="px-2 py-1 text-xs rounded-md border border-white/10 hover:bg-white/10" onClick={() => setUiError("")}>Dismiss</button>
  </div>
)}
```

### Error Message Guidelines

- Keep messages short and user-friendly
- Provide actionable guidance when possible
- Include brief technical details in parentheses if helpful
- Truncate technical details to ~120 characters

Examples:
```typescript
// Model loading failure
const msg = 'Failed to load models. Please try again.';
setUiError(err?.message ? `${msg} (${String(err.message).slice(0, 120)})` : msg);

// Conversation loading failure
setUiError('Failed to load conversation. Please refresh or try again later.');
```

## Per-Pane Errors

### When to Use

Use per-pane errors for individual model streaming failures:

- Network timeouts during streaming
- Model-specific API errors
- Rate limiting for specific models
- Individual model authentication failures

### Implementation

Per-pane errors are stored in the `panes` state and displayed below each model's transcript:

```tsx
{panes[id]?.error && (
  <p className="text-sm text-red-400 mt-2">{panes[id]?.error}</p>
)}
```

These errors are set in the streaming callbacks and don't interrupt the overall application flow.

## Debug Information

For development and debugging:

- Use `console.debug()` for technical details that developers need
- Avoid `console.error()` for expected failures (use debug level instead)
- Include trace IDs and context in debug logs
- Keep debug information separate from user-facing messages

Example:
```typescript
catch (err: any) {
  const msg = 'Failed to load models. Please try again.';
  setUiError(err?.message ? `${msg} (${String(err.message).slice(0, 120)})` : msg);
  console.debug('fetchModels error', err);
}
```

## Error Recovery

- All top-level errors include a "Dismiss" button
- Per-pane errors can be resolved by retrying the specific model
- Failed model loads can be retried by refreshing the page
- Failed conversation loads can be retried by navigating to the conversation again

## Accessibility

- All error banners use `role="alert"` for screen reader announcement
- Error text meets WCAG contrast requirements with the red color scheme
- Error messages are dismissible and don't trap focus
