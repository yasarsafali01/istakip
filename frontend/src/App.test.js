import { render, screen } from '@testing-library/react';
import App from './App';

// Smoke test: without a stored session the app boots to the login page.
test('renders the login page when no session exists', async () => {
  render(<App />);
  expect(await screen.findByRole('button', { name: /giriş yap/i })).toBeInTheDocument();
  expect(screen.getAllByText(/Mersin Üniversitesi/i).length).toBeGreaterThan(0);
});
