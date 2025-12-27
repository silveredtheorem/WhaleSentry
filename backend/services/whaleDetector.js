// Lightweight whale detection logic and thresholds
const WHALE_THRESHOLDS = {
  DOLPHIN: 1_000,      // $1K (testing-friendly)
  WHALE: 10_000,       // $10K (adjusted for testing)
  MEGALODON: 50_000    // $50K
};

function classify(value) {
  if (value >= WHALE_THRESHOLDS.MEGALODON) return 'MEGALODON';
  if (value >= WHALE_THRESHOLDS.WHALE) return 'WHALE';
  if (value >= WHALE_THRESHOLDS.DOLPHIN) return 'DOLPHIN';
  return null;
}

module.exports = { WHALE_THRESHOLDS, classify };
