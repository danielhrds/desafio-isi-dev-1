import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../database/sequelize.js';

export type TransactionType = 'COMPRA' | 'VENDA';

export class MarketTransaction extends Model<
  InferAttributes<MarketTransaction>,
  InferCreationAttributes<MarketTransaction>
> {
  declare id: CreationOptional<number>;
  declare clubId: number;
  declare playerId: number;
  declare playerName: string;
  declare type: TransactionType;
  declare value: string;
  declare fee: string;
  declare penalty: string;
  declare profit: string | null;
  declare cashChange: string;
  declare createdAt: Date;
}

MarketTransaction.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    clubId: { type: DataTypes.INTEGER, allowNull: false, field: 'clube_id' },
    playerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'jogador_id',
    },
    playerName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'nome_jogador',
    },
    type: { type: DataTypes.STRING(6), allowNull: false, field: 'tipo' },
    value: { type: DataTypes.DECIMAL(6, 2), allowNull: false, field: 'valor' },
    fee: { type: DataTypes.DECIMAL(6, 2), allowNull: false, field: 'taxa' },
    penalty: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      field: 'multa',
    },
    profit: { type: DataTypes.DECIMAL(7, 2), allowNull: true, field: 'lucro' },
    cashChange: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      field: 'variacao_caixa',
    },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'criado_em' },
  },
  {
    sequelize,
    modelName: 'MarketTransaction',
    tableName: 'transacoes',
    timestamps: false,
  },
);
