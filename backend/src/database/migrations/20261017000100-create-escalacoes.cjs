module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'escalacoes',
        {
          clube_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: { model: 'clubes', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          jogador_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: { model: 'jogadores', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          criado_em: { type: Sequelize.DATE, allowNull: false },
        },
        { transaction },
      );

      await queryInterface.addConstraint('escalacoes', {
        fields: ['jogador_id'],
        type: 'unique',
        name: 'escalacoes_jogador_id_unique',
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('escalacoes', { transaction });
    });
  },
};
