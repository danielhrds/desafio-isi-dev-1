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
    '/players': {
      post: {
        summary: 'Cadastra um jogador livre e APTO',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: [
                  'name',
                  'position',
                  'agility',
                  'age',
                  'pace',
                  'shooting',
                  'passing',
                  'dribbling',
                  'defending',
                  'physical',
                  'potential',
                ],
                properties: {
                  name: { type: 'string', example: 'Meia Lua' },
                  position: {
                    type: 'string',
                    enum: ['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'],
                  },
                  agility: { type: 'integer', minimum: 1, maximum: 100 },
                  age: { type: 'integer', minimum: 16, maximum: 45 },
                  pace: { type: 'integer', minimum: 1, maximum: 99 },
                  shooting: { type: 'integer', minimum: 1, maximum: 99 },
                  passing: { type: 'integer', minimum: 1, maximum: 99 },
                  dribbling: { type: 'integer', minimum: 1, maximum: 99 },
                  defending: { type: 'integer', minimum: 1, maximum: 99 },
                  physical: { type: 'integer', minimum: 1, maximum: 99 },
                  potential: { type: 'integer', minimum: 1, maximum: 99 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description:
              'Jogador criado; Location aponta para /api/v1/players/{id}',
            headers: { Location: { schema: { type: 'string' } } },
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                    position: { type: 'string' },
                    agility: { type: 'integer' },
                    age: { type: 'integer' },
                    condition: {
                      type: 'string',
                      enum: ['APTO', 'MAL_CONDICIONADO', 'DOENTE'],
                    },
                    base_value: { type: 'number' },
                    market_value: { type: 'number' },
                    pace: { type: 'integer' },
                    shooting: { type: 'integer' },
                    passing: { type: 'integer' },
                    dribbling: { type: 'integer' },
                    defending: { type: 'integer' },
                    physical: { type: 'integer' },
                    potential: { type: 'integer' },
                    overall: { type: 'integer' },
                    club_id: { type: ['integer', 'null'] },
                  },
                },
              },
            },
          },
          '400': { description: 'Dados inválidos' },
        },
      },
    },
    '/health': {
      get: {
        summary: 'Verifica se a API está disponível',
        responses: { '200': { description: 'API disponível' } },
      },
    },
  },
};
