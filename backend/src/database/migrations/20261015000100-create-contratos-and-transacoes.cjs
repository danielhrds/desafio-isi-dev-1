module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'contratos',
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          jogador_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'jogadores', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          clube_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'clubes', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          valor_compra: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
          fidelidade_ate: { type: Sequelize.DATE, allowNull: false },
          situacao: { type: Sequelize.STRING(12), allowNull: false },
          iniciado_em: { type: Sequelize.DATE, allowNull: false },
          encerrado_em: { type: Sequelize.DATE, allowNull: true },
        },
        { transaction },
      );

      await queryInterface.addIndex('contratos', ['jogador_id'], {
        name: 'contratos_jogador_ativo_unique',
        unique: true,
        where: { situacao: 'ATIVO' },
        transaction,
      });

      await queryInterface.createTable(
        'transacoes',
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          clube_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'clubes', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          jogador_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'jogadores', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          nome_jogador: { type: Sequelize.STRING(100), allowNull: false },
          tipo: { type: Sequelize.STRING(6), allowNull: false },
          valor: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
          taxa: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
          multa: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
          lucro: { type: Sequelize.DECIMAL(7, 2), allowNull: true },
          variacao_caixa: { type: Sequelize.DECIMAL(8, 2), allowNull: false },
          criado_em: { type: Sequelize.DATE, allowNull: false },
        },
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('transacoes', { transaction });
      await queryInterface.dropTable('contratos', { transaction });
    });
  },
};
