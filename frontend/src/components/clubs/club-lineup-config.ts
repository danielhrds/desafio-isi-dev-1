import type { ClubFormation } from '@/types/club';
import type { PlayerPosition } from '@/types/player';

export type LineupSector = 'goleiro' | 'defesa' | 'meio' | 'ataque';

export interface LineupSlot {
  id: string;
  label: string;
  positionHint: string;
  eligiblePositions: readonly PlayerPosition[];
  sector: LineupSector;
  x: number;
  y: number;
}

export const formationOptions: Array<{
  value: ClubFormation;
  description: string;
}> = [
  { value: '3-1', description: 'Defesa 3, ataque 1' },
  { value: '2-2', description: 'Defesa 2, ataque 2' },
  { value: '2-1-1', description: 'Defesa 2, meio 1, ataque 1' },
  { value: '1-2-1', description: 'Defesa 1, meio 2, ataque 1' },
];

const goalkeeper: LineupSlot = {
  id: 'goleiro',
  label: 'Goleiro',
  positionHint: 'GOL',
  eligiblePositions: ['GOL'],
  sector: 'goleiro',
  x: 50,
  y: 84,
};

function defenseSlot(index: number, x: number, y = 65): LineupSlot {
  return {
    id: `defesa-${index}`,
    label: 'Defesa',
    positionHint: 'ZAG ou LAT',
    eligiblePositions: ['ZAG', 'LAT'],
    sector: 'defesa',
    x,
    y,
  };
}

function midfieldSlot(index: number, x: number, y = 46): LineupSlot {
  return {
    id: `meio-${index}`,
    label: 'Meio',
    positionHint: 'MEI',
    eligiblePositions: ['MEI'],
    sector: 'meio',
    x,
    y,
  };
}

function attackSlot(index: number, x: number, y = 23): LineupSlot {
  return {
    id: `ataque-${index}`,
    label: 'Ataque',
    positionHint: 'ATA',
    eligiblePositions: ['ATA'],
    sector: 'ataque',
    x,
    y,
  };
}

export const formationSlots: Record<ClubFormation, LineupSlot[]> = {
  '3-1': [
    goalkeeper,
    defenseSlot(1, 18),
    defenseSlot(2, 50),
    defenseSlot(3, 82),
    attackSlot(1, 50),
  ],
  '2-2': [
    goalkeeper,
    defenseSlot(1, 28),
    defenseSlot(2, 72),
    attackSlot(1, 28),
    attackSlot(2, 72),
  ],
  '2-1-1': [
    goalkeeper,
    defenseSlot(1, 28),
    defenseSlot(2, 72),
    midfieldSlot(1, 50),
    attackSlot(1, 50),
  ],
  '1-2-1': [
    goalkeeper,
    defenseSlot(1, 50),
    midfieldSlot(1, 28),
    midfieldSlot(2, 72),
    attackSlot(1, 50),
  ],
};
