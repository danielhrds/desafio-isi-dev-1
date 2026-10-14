export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Passe API',
    version: '0.1.0',
    description:
      'Contratos da API serão adicionados conforme os módulos forem implementados.',
  },
  servers: [{ url: 'http://localhost:3000/api/v1' }],
  paths: {
    '/health': {
      get: {
        summary: 'Verifica se a API está disponível',
        responses: { '200': { description: 'API disponível' } },
      },
    },
  },
};
