// Lightweight whale detection logic and thresholds
const WHALE_THRESHOLDS = {
  DOLPHIN: 200_000,    // $200K
  WHALE: 500_000,      // $500K
  MEGALODON: 1_000_000 // $1M
};

function classify(value) {
  if (value >= WHALE_THRESHOLDS.MEGALODON) return 'MEGALODON';
  if (value >= WHALE_THRESHOLDS.WHALE) return 'WHALE';
  if (value >= WHALE_THRESHOLDS.DOLPHIN) return 'DOLPHIN';
  return null;
}

module.exports = { WHALE_THRESHOLDS, classify };
