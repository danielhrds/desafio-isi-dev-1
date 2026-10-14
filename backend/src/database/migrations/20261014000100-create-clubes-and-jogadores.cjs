module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'clubes',
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          nome: { type: Sequelize.STRING(60), allowNull: false },
          nome_normalizado: {
            type: Sequelize.STRING(60),
            allowNull: false,
          },
          nome_busca: { type: Sequelize.STRING(60), allowNull: false },
          sigla: {
            type: Sequelize.CHAR(3),
            allowNull: false,
          },
          caixa: {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: '300.00',
          },
          formacao: { type: Sequelize.STRING(5), allowNull: true },
          criado_em: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
        },
        { transaction },
      );

      await queryInterface.addConstraint('clubes', {
        fields: ['nome_normalizado'],
        type: 'unique',
        name: 'clubes_nome_normalizado_unique',
        transaction,
      });
      await queryInterface.addConstraint('clubes', {
        fields: ['sigla'],
        type: 'unique',
        name: 'clubes_sigla_unique',
        transaction,
      });

      await queryInterface.createTable(
        'jogadores',
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          nome: { type: Sequelize.STRING(100), allowNull: false },
          nome_busca: { type: Sequelize.STRING(100), allowNull: false },
          posicao: { type: Sequelize.STRING(3), allowNull: false },
          agilidade: { type: Sequelize.INTEGER, allowNull: false },
          idade: { type: Sequelize.INTEGER, allowNull: false },
          valor_base: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
          condicao: {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: 'APTO',
          },
          clube_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: 'clubes', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          velocidade: { type: Sequelize.INTEGER, allowNull: false },
          finalizacao: { type: Sequelize.INTEGER, allowNull: false },
          passe: { type: Sequelize.INTEGER, allowNull: false },
          drible: { type: Sequelize.INTEGER, allowNull: false },
          defesa: { type: Sequelize.INTEGER, allowNull: false },
          fisico: { type: Sequelize.INTEGER, allowNull: false },
          potencial: { type: Sequelize.INTEGER, allowNull: false },
          excluido_em: { type: Sequelize.DATE, allowNull: true },
          criado_em: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
          atualizado_em: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
        },
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('jogadores', { transaction });
      await queryInterface.dropTable('clubes', { transaction });
    });
  },
};
