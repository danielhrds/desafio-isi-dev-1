import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../database/sequelize.js';
import type { ClubFormation } from './club.model.js';

export class Match extends Model<
  InferAttributes<Match>,
  InferCreationAttributes<Match>
> {
  declare id: CreationOptional<number>;
  declare homeClubId: number;
  declare awayClubId: number;
  declare homeGoals: number;
  declare awayGoals: number;
  declare homeFormation: ClubFormation;
  declare awayFormation: ClubFormation;
  declare playedAt: Date;
}

Match.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    homeClubId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'mandante_id',
    },
    awayClubId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'visitante_id',
    },
    homeGoals: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'gols_mandante',
    },
    awayGoals: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'gols_visitante',
    },
    homeFormation: {
      type: DataTypes.STRING(5),
      allowNull: false,
      field: 'formacao_mandante',
    },
    awayFormation: {
      type: DataTypes.STRING(5),
      allowNull: false,
      field: 'formacao_visitante',
    },
    playedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'jogada_em',
    },
  },
  {
    sequelize,
    modelName: 'Match',
    tableName: 'partidas',
    timestamps: false,
  },
);
