import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../database/sequelize.js';

export type ContractStatus = 'ATIVO' | 'ENCERRADO' | 'RESCINDIDO';

export class Contract extends Model<
  InferAttributes<Contract>,
  InferCreationAttributes<Contract>
> {
  declare id: CreationOptional<number>;
  declare playerId: number;
  declare clubId: number;
  declare purchaseValue: string;
  declare loyaltyUntil: Date;
  declare status: ContractStatus;
  declare startedAt: Date;
  declare endedAt: CreationOptional<Date | null>;
}

Contract.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    playerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'jogador_id',
    },
    clubId: { type: DataTypes.INTEGER, allowNull: false, field: 'clube_id' },
    purchaseValue: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      field: 'valor_compra',
    },
    loyaltyUntil: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'fidelidade_ate',
    },
    status: { type: DataTypes.STRING(12), allowNull: false, field: 'situacao' },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'iniciado_em',
    },
    endedAt: { type: DataTypes.DATE, allowNull: true, field: 'encerrado_em' },
  },
  {
    sequelize,
    modelName: 'Contract',
    tableName: 'contratos',
    timestamps: false,
  },
);
