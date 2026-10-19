export const basePath = window.location.pathname === '/stratus' || window.location.pathname.startsWith('/stratus/')
  ? '/stratus' : '';
export const routePath = (path: string) => `${basePath}${path}` || '/';
