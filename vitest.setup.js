import '@testing-library/jest-dom';

// Editing needs an edit password; tests that check its absence remove it
globalThis.process.env.EDIT_PASSWORD ??= 'test-edit-password';
