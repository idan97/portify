import { client } from '@/api/client';

export const User = {
  me: () => client.auth.me(),
  isAuthenticated: () => client.auth.isAuthenticated(),
  login: () => client.auth.redirectToLogin(),
  logout: () => client.auth.logout(),
};
