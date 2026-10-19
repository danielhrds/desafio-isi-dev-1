import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../database/sequelize.js';
import type { PlayerPosition } from './player.model.js';

export type DuelCondition = 'APTO' | 'MAL_CONDICIONADO';
export type AttackAttribute = 'shooting' | 'passing' | 'dribbling';

export class MatchDuel extends Model<
  InferAttributes<MatchDuel>,
  InferCreationAttributes<MatchDuel>
> {
  declare id: CreationOptional<number>;
  declare matchId: number;
  declare order: number;
  declare attackingClubId: number;
  declare attackerId: number;
  declare defenderId: number;
  declare attackerName: string;
  declare defenderName: string;
  declare attackerPosition: PlayerPosition;
  declare defenderPosition: PlayerPosition;
  declare attackerCondition: DuelCondition;
  declare defenderCondition: DuelCondition;
  declare attackAttribute: AttackAttribute;
  declare defenseAttribute: 'defending';
  declare attackValue: number;
  declare defenseValue: number;
  declare goal: boolean;
}

MatchDuel.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    matchId: { type: DataTypes.INTEGER, allowNull: false, field: 'partida_id' },
    order: { type: DataTypes.INTEGER, allowNull: false, field: 'ordem' },
    attackingClubId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'clube_atacante_id',
    },
    attackerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'atacante_id',
    },
    defenderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'defensor_id',
    },
    attackerName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'nome_atacante',
    },
    defenderName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'nome_defensor',
    },
    attackerPosition: {
      type: DataTypes.STRING(3),
      allowNull: false,
      field: 'posicao_atacante',
    },
    defenderPosition: {
      type: DataTypes.STRING(3),
      allowNull: false,
      field: 'posicao_defensor',
    },
    attackerCondition: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'condicao_atacante',
    },
    defenderCondition: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'condicao_defensor',
    },
    attackAttribute: {
      type: DataTypes.STRING(10),
      allowNull: false,
      field: 'atributo_ataque',
    },
    defenseAttribute: {
      type: DataTypes.STRING(10),
      allowNull: false,
      field: 'atributo_defesa',
    },
    attackValue: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'valor_ataque',
    },
    defenseValue: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'valor_defesa',
    },
    goal: { type: DataTypes.BOOLEAN, allowNull: false, field: 'gol' },
  },
  {
    sequelize,
    modelName: 'MatchDuel',
    tableName: 'duelos_partida',
    timestamps: false,
  },
);
