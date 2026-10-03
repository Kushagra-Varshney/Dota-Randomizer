export interface Combo {
  id: string;
  name: string;
  /** Hero keys that make up the combo. */
  heroes: string[];
  how: string;
}

export const COMBOS: readonly Combo[] = [
  // Duos
  { id: 'ravage-bh', name: 'Ravage into Black Hole', heroes: ['tidehunter', 'enigma'], how: 'Tide Ravages the pile, Enigma Black Holes them while they are still stunned.' },
  { id: 'rp-echo', name: 'RP into Echo Slam', heroes: ['magnataur', 'earthshaker'], how: 'Magnus groups them with Reverse Polarity, Earthshaker blinks in for a huge Echo.' },
  { id: 'ravage-echo', name: 'Ravage into Echo Slam', heroes: ['tidehunter', 'earthshaker'], how: 'Ravage first, then Echo Slam the helpless clump.' },
  { id: 'chrono-ward', name: 'Chrono Death Ward', heroes: ['faceless_void', 'witch_doctor'], how: 'Void freezes the fight, Witch Doctor drops Death Ward inside the dome.' },
  { id: 'chrono-flare', name: 'Chrono Mystic Flare', heroes: ['faceless_void', 'skywrath_mage'], how: 'Chronosphere a cluster, Skywrath pours Mystic Flare into it.' },
  { id: 'chrono-freeze', name: 'Frozen in Time', heroes: ['faceless_void', 'crystal_maiden'], how: 'Crystal Maiden channels Freezing Field inside Chronosphere, untouched.' },
  { id: 'bh-macropyre', name: 'Black Hole Macropyre', heroes: ['enigma', 'jakiro'], how: 'Black Hole, then Macropyre across the spinning enemies.' },
  { id: 'bh-sonic', name: 'Black Hole Sonic Wave', heroes: ['enigma', 'queenofpain'], how: 'Black Hole holds them, Queen of Pain Sonic Waves straight through.' },
  { id: 'vacuum-rp', name: 'Vacuum into RP', heroes: ['dark_seer', 'magnataur'], how: 'Dark Seer Vacuums them together, Magnus Reverse Polarities the clump.' },
  { id: 'vacuum-echo', name: 'Vacuum into Echo Slam', heroes: ['dark_seer', 'earthshaker'], how: 'Vacuum stacks them on top of each other for a giant Echo.' },
  { id: 'empower-cleave', name: 'Empowered Cleave', heroes: ['magnataur', 'sven'], how: "Empower on Sven means God's Strength cleaves through the whole team." },
  { id: 'io-tiny', name: 'Io Express', heroes: ['wisp', 'tiny'], how: 'Io tethers Tiny and Relocates in for a surprise Avalanche + Toss.' },
  { id: 'io-gyro', name: 'Relocate Gyro', heroes: ['wisp', 'gyrocopter'], how: 'Io Relocates a farmed Gyro straight into the fight, Call Down incoming.' },
  { id: 'promise-huskar', name: 'Unkillable Huskar', heroes: ['oracle', 'huskar'], how: 'False Promise turns Huskar dancing on 1 HP into a full heal.' },
  { id: 'kinetic-chain', name: 'Chain Frost in a Box', heroes: ['disruptor', 'lich'], how: 'Kinetic Field traps them, Chain Frost bounces until everyone is dead.' },
  { id: 'arena-macropyre', name: 'Arena of Fire', heroes: ['mars', 'jakiro'], how: 'Arena of Blood traps them, Macropyre burns everything inside.' },
  { id: 'arena-wukong', name: 'Ring of Death', heroes: ['mars', 'monkey_king'], how: "Wukong's Command inside Arena of Blood. Nowhere to run." },
  { id: 'torrent-lsa', name: 'Torrent Strike', heroes: ['kunkka', 'lina'], how: 'Time Light Strike Array with Torrent for a long chain stun.' },
  { id: 'rp-supernova', name: 'Sun Pull', heroes: ['magnataur', 'phoenix'], how: 'Reverse Polarity, then Supernova on the stunned pile.' },
  { id: 'song-echo', name: 'Siren Echo', heroes: ['naga_siren', 'earthshaker'], how: 'Song of the Siren sets up a perfectly timed Echo Slam blink.' },
  // Trios
  { id: 'chrono-massacre', name: 'Time Stop Massacre', heroes: ['faceless_void', 'witch_doctor', 'skywrath_mage'], how: 'Chrono, Death Ward and Mystic Flare. Everything inside dies.' },
  { id: 'hell-arena', name: 'Hell Arena', heroes: ['mars', 'lich', 'jakiro'], how: 'Arena of Blood, Chain Frost bouncing inside and Macropyre on top.' },
  { id: 'mega-wombo', name: 'The Mega Wombo', heroes: ['tidehunter', 'enigma', 'queenofpain'], how: 'Ravage, Black Hole, Sonic Wave. A classic pub stomp.' },
  { id: 'gravity-well', name: 'Gravity Well', heroes: ['dark_seer', 'magnataur', 'earthshaker'], how: 'Vacuum, Reverse Polarity, Echo Slam. Pray it lands.' },
];

export const getCombo = (id: string | undefined): Combo | undefined => COMBOS.find((c) => c.id === id);
