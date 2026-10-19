module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'partidas',
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          mandante_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'clubes', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          visitante_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'clubes', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          gols_mandante: { type: Sequelize.INTEGER, allowNull: false },
          gols_visitante: { type: Sequelize.INTEGER, allowNull: false },
          formacao_mandante: { type: Sequelize.STRING(5), allowNull: false },
          formacao_visitante: { type: Sequelize.STRING(5), allowNull: false },
          jogada_em: { type: Sequelize.DATE, allowNull: false },
        },
        { transaction },
      );

      await queryInterface.createTable(
        'duelos_partida',
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          partida_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'partidas', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          ordem: { type: Sequelize.INTEGER, allowNull: false },
          clube_atacante_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'clubes', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          atacante_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'jogadores', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          defensor_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'jogadores', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          nome_atacante: { type: Sequelize.STRING(100), allowNull: false },
          nome_defensor: { type: Sequelize.STRING(100), allowNull: false },
          posicao_atacante: { type: Sequelize.STRING(3), allowNull: false },
          posicao_defensor: { type: Sequelize.STRING(3), allowNull: false },
          condicao_atacante: { type: Sequelize.STRING(20), allowNull: false },
          condicao_defensor: { type: Sequelize.STRING(20), allowNull: false },
          atributo_ataque: { type: Sequelize.STRING(10), allowNull: false },
          atributo_defesa: { type: Sequelize.STRING(10), allowNull: false },
          valor_ataque: { type: Sequelize.INTEGER, allowNull: false },
          valor_defesa: { type: Sequelize.INTEGER, allowNull: false },
          gol: { type: Sequelize.BOOLEAN, allowNull: false },
        },
        { transaction },
      );

      await queryInterface.addConstraint('duelos_partida', {
        fields: ['partida_id', 'ordem'],
        type: 'unique',
        name: 'duelos_partida_partida_ordem_unique',
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('duelos_partida', { transaction });
      await queryInterface.dropTable('partidas', { transaction });
    });
  },
};
