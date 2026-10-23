import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../database/sequelize.js';

export type ClubFormation = '3-1' | '2-2' | '2-1-1' | '1-2-1';

export class Club extends Model<
  InferAttributes<Club>,
  InferCreationAttributes<Club>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare normalizedName: string;
  declare searchName: string;
  declare acronym: string;
  declare cash: CreationOptional<string>;
  declare formation: CreationOptional<ClubFormation | null>;
  declare createdAt: CreationOptional<Date>;
}

Club.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(60), allowNull: false, field: 'nome' },
    normalizedName: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'nome_normalizado',
    },
    searchName: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'nome_busca',
    },
    acronym: { type: DataTypes.CHAR(3), allowNull: false, field: 'sigla' },
    cash: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: '300.00',
      field: 'caixa',
    },
    formation: {
      type: DataTypes.STRING(5),
      allowNull: true,
      field: 'formacao',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'criado_em',
    },
  },
  {
    sequelize,
    modelName: 'Club',
    tableName: 'clubes',
    timestamps: false,
  },
);
