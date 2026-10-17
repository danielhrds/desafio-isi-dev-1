import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../database/sequelize.js';

export class Lineup extends Model<
  InferAttributes<Lineup>,
  InferCreationAttributes<Lineup>
> {
  declare clubId: number;
  declare playerId: number;
  declare createdAt: Date;
}

Lineup.init(
  {
    clubId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      field: 'clube_id',
    },
    playerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      unique: true,
      field: 'jogador_id',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'criado_em',
    },
  },
  {
    sequelize,
    modelName: 'Lineup',
    tableName: 'escalacoes',
    timestamps: false,
  },
);
