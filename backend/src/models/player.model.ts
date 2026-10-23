import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../database/sequelize.js';

export type PlayerPosition = 'GOL' | 'ZAG' | 'LAT' | 'MEI' | 'ATA';
export type PlayerCondition = 'APTO' | 'MAL_CONDICIONADO' | 'DOENTE';

export class Player extends Model<
  InferAttributes<Player>,
  InferCreationAttributes<Player>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare searchName: string;
  declare position: PlayerPosition;
  declare agility: number;
  declare age: number;
  declare baseValue: string;
  declare condition: CreationOptional<PlayerCondition>;
  declare clubId: CreationOptional<number | null>;
  declare pace: number;
  declare shooting: number;
  declare passing: number;
  declare dribbling: number;
  declare defending: number;
  declare physical: number;
  declare potential: number;
  declare deletedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Player.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false, field: 'nome' },
    searchName: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'nome_busca',
    },
    position: { type: DataTypes.STRING(3), allowNull: false, field: 'posicao' },
    agility: { type: DataTypes.INTEGER, allowNull: false, field: 'agilidade' },
    age: { type: DataTypes.INTEGER, allowNull: false, field: 'idade' },
    baseValue: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      field: 'valor_base',
    },
    condition: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'APTO',
      field: 'condicao',
    },
    clubId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'clube_id',
    },
    pace: { type: DataTypes.INTEGER, allowNull: false, field: 'velocidade' },
    shooting: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'finalizacao',
    },
    passing: { type: DataTypes.INTEGER, allowNull: false, field: 'passe' },
    dribbling: { type: DataTypes.INTEGER, allowNull: false, field: 'drible' },
    defending: { type: DataTypes.INTEGER, allowNull: false, field: 'defesa' },
    physical: { type: DataTypes.INTEGER, allowNull: false, field: 'fisico' },
    potential: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'potencial',
    },
    deletedAt: { type: DataTypes.DATE, allowNull: true, field: 'excluido_em' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'criado_em' },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'atualizado_em',
    },
  },
  {
    sequelize,
    modelName: 'Player',
    tableName: 'jogadores',
    timestamps: true,
    paranoid: true,
  },
);
