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
      get: {
        summary: 'Lista jogadores com busca, filtros, ordenação e paginação',
        parameters: [
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string', minLength: 2, maxLength: 100 },
          },
          {
            name: 'position',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'],
            },
          },
          {
            name: 'condition',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['APTO', 'MAL_CONDICIONADO', 'DOENTE'],
            },
          },
          {
            name: 'free',
            in: 'query',
            schema: { type: 'string', enum: ['true', 'false'] },
          },
          {
            name: 'club_id',
            in: 'query',
            schema: { type: 'integer', minimum: 1 },
          },
          {
            name: 'min_age',
            in: 'query',
            schema: { type: 'integer', minimum: 16, maximum: 45 },
          },
          {
            name: 'max_age',
            in: 'query',
            schema: { type: 'integer', minimum: 16, maximum: 45 },
          },
          {
            name: 'min_value',
            in: 'query',
            schema: { type: 'number', minimum: 0, maximum: 550 },
          },
          {
            name: 'max_value',
            in: 'query',
            schema: { type: 'number', minimum: 0, maximum: 550 },
          },
          {
            name: 'sort',
            in: 'query',
            description:
              'Até dois critérios distintos, separados por vírgula; empate por nome e id.',
            schema: {
              type: 'string',
              default: 'name',
              example: 'value_desc,age_asc',
            },
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', minimum: 1, default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
          },
        ],
        responses: {
          '200': {
            description: 'Jogadores filtrados na página solicitada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['data', 'meta'],
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: [
                          'id',
                          'name',
                          'position',
                          'agility',
                          'age',
                          'condition',
                          'base_value',
                          'market_value',
                          'pace',
                          'shooting',
                          'passing',
                          'dribbling',
                          'defending',
                          'physical',
                          'potential',
                          'overall',
                          'club_id',
                        ],
                        properties: {
                          id: { type: 'integer' },
                          name: { type: 'string' },
                          position: { type: 'string' },
                          agility: { type: 'integer' },
                          age: { type: 'integer' },
                          condition: { type: 'string' },
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
                    meta: {
                      type: 'object',
                      required: ['page', 'limit', 'total_items', 'total_pages'],
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total_items: { type: 'integer' },
                        total_pages: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Parâmetro inválido ou contraditório' },
          '404': { description: 'Clube do filtro inexistente' },
        },
      },
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
    '/players/{id}': {
      get: {
        summary: 'Consulta um jogador ativo por id',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer', minimum: 1, maximum: 2147483647 },
          },
        ],
        responses: {
          '200': {
            description: 'Jogador com overall e valor de mercado atuais',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: [
                    'id',
                    'name',
                    'position',
                    'agility',
                    'age',
                    'condition',
                    'base_value',
                    'market_value',
                    'pace',
                    'shooting',
                    'passing',
                    'dribbling',
                    'defending',
                    'physical',
                    'potential',
                    'overall',
                    'club_id',
                  ],
                  properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                    position: { type: 'string' },
                    agility: { type: 'integer' },
                    age: { type: 'integer' },
                    condition: { type: 'string' },
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
          '404': {
            description: 'Jogador inexistente, excluído ou id inválido',
          },
        },
      },
      put: {
        summary: 'Atualiza nome, posição, agilidade e idade de um jogador',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer', minimum: 1, maximum: 2147483647 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'position', 'agility', 'age'],
                properties: {
                  name: { type: 'string', example: 'Meia Lua' },
                  position: {
                    type: 'string',
                    enum: ['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'],
                  },
                  agility: { type: 'integer', minimum: 1, maximum: 100 },
                  age: { type: 'integer', minimum: 16, maximum: 45 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description:
              'Jogador atualizado, com o mesmo formato da resposta do cadastro',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: [
                    'id',
                    'name',
                    'position',
                    'agility',
                    'age',
                    'condition',
                    'base_value',
                    'market_value',
                    'pace',
                    'shooting',
                    'passing',
                    'dribbling',
                    'defending',
                    'physical',
                    'potential',
                    'overall',
                    'club_id',
                  ],
                  properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                    position: { type: 'string' },
                    agility: { type: 'integer' },
                    age: { type: 'integer' },
                    condition: { type: 'string' },
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
          '400': { description: 'Corpo inválido' },
          '404': { description: 'Jogador inexistente ou excluído' },
          '409': {
            description: 'Idade reduzida ou mudança de posição com clube',
          },
        },
      },
      delete: {
        summary: 'Exclui logicamente um jogador livre',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer', minimum: 1, maximum: 2147483647 },
          },
        ],
        responses: {
          '204': { description: 'Jogador excluído, sem corpo' },
          '404': {
            description: 'Jogador inexistente, excluído ou id inválido',
          },
          '409': { description: 'Jogador pertence a um clube' },
        },
      },
    },
    '/players/{id}/buy': {
      post: {
        summary: 'Compra um jogador livre e cria contrato e transação',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer', minimum: 1, maximum: 2147483647 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['club_id', 'loyalty_until'],
                properties: {
                  club_id: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 2147483647,
                  },
                  loyalty_until: {
                    type: 'string',
                    pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}-03:00$',
                    description:
                      'Data/hora de Brasília futura, até 1.095 dias após a compra.',
                    example: '2027-03-02T10:15-03:00',
                  },
                },
              },
              example: {
                club_id: 1,
                loyalty_until: '2027-03-02T10:15-03:00',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Compra concluída com contrato e novo caixa',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: [
                    'id',
                    'club_id',
                    'player_id',
                    'player_name',
                    'type',
                    'value',
                    'fee',
                    'penalty',
                    'profit',
                    'cash_change',
                    'created_at',
                    'contract',
                    'club_cash',
                  ],
                  properties: {
                    id: { type: 'integer' },
                    club_id: { type: 'integer' },
                    player_id: { type: 'integer' },
                    player_name: { type: 'string' },
                    type: { type: 'string', enum: ['COMPRA'] },
                    value: { type: 'number' },
                    fee: { type: 'number' },
                    penalty: { type: 'number', example: 0 },
                    profit: { type: 'null' },
                    cash_change: { type: 'number' },
                    created_at: { type: 'string' },
                    contract: {
                      type: 'object',
                      required: ['purchase_value', 'loyalty_until', 'status'],
                      properties: {
                        purchase_value: { type: 'number' },
                        loyalty_until: { type: 'string' },
                        status: { type: 'string', enum: ['ATIVO'] },
                      },
                    },
                    club_cash: { type: 'number' },
                  },
                },
              },
            },
          },
          '400': { description: 'Corpo ou fidelidade inválidos' },
          '404': { description: 'Jogador ou clube inexistente' },
          '409': {
            description:
              'Jogador ocupado, recompra, elenco cheio ou limite de caixa excedido',
          },
        },
      },
    },
    '/clubs': {
      get: {
        summary: 'Lista clubes com valor do elenco e patrimônio atuais',
        parameters: [
          {
            name: 'sort',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['name', 'net_worth_asc', 'net_worth_desc'],
              default: 'name',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Array de clubes ordenado, sem o elenco',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: [
                      'id',
                      'name',
                      'acronym',
                      'cash',
                      'squad_value',
                      'net_worth',
                    ],
                    properties: {
                      id: { type: 'integer' },
                      name: { type: 'string' },
                      acronym: { type: 'string' },
                      cash: { type: 'number' },
                      squad_value: { type: 'number' },
                      net_worth: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Ordenação inválida' },
        },
      },
      post: {
        summary: 'Cadastra um clube',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'acronym'],
                properties: {
                  name: { type: 'string', minLength: 3, maxLength: 60 },
                  acronym: { type: 'string', pattern: '^[A-Z]{3}$' },
                },
              },
              example: { name: 'Águias FC', acronym: 'AGU' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Clube criado',
            headers: {
              Location: {
                description: 'Caminho do clube criado',
                schema: { type: 'string' },
              },
            },
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: [
                    'id',
                    'name',
                    'acronym',
                    'cash',
                    'squad_value',
                    'net_worth',
                  ],
                  properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                    acronym: { type: 'string' },
                    cash: { type: 'number', example: 300 },
                    squad_value: { type: 'number', example: 0 },
                    net_worth: { type: 'number', example: 300 },
                  },
                },
              },
            },
          },
          '400': { description: 'Nome ou sigla inválidos' },
          '409': { description: 'Nome ou sigla duplicados ou liga cheia' },
        },
      },
    },
    '/clubs/{id}/transactions': {
      get: {
        summary: 'Consulta o histórico e os totais filtrados de um clube',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer', minimum: 1, maximum: 2147483647 },
          },
          {
            name: 'type',
            in: 'query',
            description:
              'Um ou dois tipos, separados por vírgula e sem repetição.',
            schema: {
              type: 'string',
              enum: ['COMPRA', 'VENDA', 'COMPRA,VENDA', 'VENDA,COMPRA'],
            },
          },
          {
            name: 'player_id',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 2147483647 },
          },
        ],
        responses: {
          '200': {
            description: 'Transações filtradas e resumo dos mesmos registros',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['data', 'summary'],
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: [
                          'id',
                          'club_id',
                          'player_id',
                          'player_name',
                          'type',
                          'value',
                          'fee',
                          'penalty',
                          'profit',
                          'cash_change',
                          'created_at',
                        ],
                        properties: {
                          id: { type: 'integer' },
                          club_id: { type: 'integer' },
                          player_id: { type: 'integer' },
                          player_name: { type: 'string' },
                          type: { type: 'string', enum: ['COMPRA', 'VENDA'] },
                          value: { type: 'number' },
                          fee: { type: 'number' },
                          penalty: { type: 'number' },
                          profit: { type: ['number', 'null'] },
                          cash_change: { type: 'number' },
                          created_at: { type: 'string' },
                        },
                      },
                    },
                    summary: {
                      type: 'object',
                      required: [
                        'total_spent',
                        'total_received',
                        'total_fees',
                        'total_penalties',
                        'total_profit',
                      ],
                      properties: {
                        total_spent: { type: 'number' },
                        total_received: { type: 'number' },
                        total_fees: { type: 'number' },
                        total_penalties: { type: 'number' },
                        total_profit: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Filtro inválido' },
          '404': { description: 'Clube ou jogador inexistente ou excluído' },
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
