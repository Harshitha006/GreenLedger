const logger = require('../config/logger');

const EMISSION_FACTORS = {
  electricity: 0.82, // kg CO2 per kWh (India grid average)
  solar: 0.95,       // kg CO2 per kWh (vs grid)
  ev: 0.12,          // kg CO2 per km (vs petrol car)
  transport: 0.15,   // kg CO2 per km saved (car vs public transport)
  water: 0.0003,     // kg CO2 per liter (treatment + pumping)
  waste: 0.5,        // kg CO2 per kg (landfill methane avoidance)
  tree: 20,          // kg CO2 per tree per year
};

const REGIONAL_FACTORS = {
  north: 1.1,    // Coal-heavy grid
  south: 0.85,   // More renewables
  east: 1.2,     // Coal-heavy
  west: 0.95,    // Mixed
  northeast: 0.7 // Hydro-rich
};

const calculateImpact = async (action) => {
  const impact = {
    co2SavedKg: 0,
    energySavedKwh: 0,
    waterSavedL: 0,
    wasteDivertedKg: 0,
    treesEquivalent: 0,
    creditsEarned: 0,
    calculationFormula: '',
    calculatedAt: new Date()
  };

  try {
    const region = action.userId?.region || 'national';
    const regionalFactor = REGIONAL_FACTORS[region] || 1.0;

    switch (action.actionType) {
      case 'electricity':
        impact.energySavedKwh = action.extractedData?.unitsConsumed || 0;
        impact.co2SavedKg = impact.energySavedKwh * EMISSION_FACTORS.electricity * regionalFactor;
        impact.creditsEarned = Math.floor(impact.co2SavedKg / 10); // 1 credit = 10 kg CO2
        impact.calculationFormula = `CO2 = units × ${EMISSION_FACTORS.electricity} × regional_factor`;
        break;

      case 'solar':
        const capacity = action.extractedData?.capacity || 0;
        const dailyGeneration = capacity * 4.5; // 4.5 peak sun hours
        const annualGeneration = dailyGeneration * 365;
        impact.energySavedKwh = annualGeneration;
        impact.co2SavedKg = annualGeneration * EMISSION_FACTORS.solar;
        impact.creditsEarned = Math.floor(impact.co2SavedKg / 10);
        impact.calculationFormula = `CO2 = (capacity × 4.5 × 365) × ${EMISSION_FACTORS.solar}`;
        break;

      case 'ev':
        const distance = action.extractedData?.distance || 0;
        // EV vs petrol car: 0.12 vs 0.15 kg/km
        impact.co2SavedKg = distance * (0.15 - 0.12);
        impact.creditsEarned = Math.floor(impact.co2SavedKg / 10);
        impact.calculationFormula = 'CO2 = distance × 0.03 (savings vs petrol)';
        break;

      case 'transport':
        const kmByMetro = action.extractedData?.metroDistance || 0;
        const kmByBus = action.extractedData?.busDistance || 0;

        const metroSavings = kmByMetro * (0.15 - 0.03);
        const busSavings = kmByBus * (0.15 - 0.002);

        impact.co2SavedKg = metroSavings + busSavings;
        impact.creditsEarned = Math.floor(impact.co2SavedKg / 10);
        impact.calculationFormula = 'CO2 = (metro_km × 0.12) + (bus_km × 0.148)';
        break;

      case 'water':
        const volume = action.extractedData?.volume || 0;
        impact.waterSavedL = volume;
        impact.co2SavedKg = volume * EMISSION_FACTORS.water;
        impact.creditsEarned = Math.floor(impact.co2SavedKg / 10);
        impact.calculationFormula = `CO2 = liters × ${EMISSION_FACTORS.water}`;
        break;

      case 'waste':
        const weight = action.extractedData?.weight || 0;
        impact.wasteDivertedKg = weight;
        impact.co2SavedKg = weight * EMISSION_FACTORS.waste;
        impact.creditsEarned = Math.floor(impact.co2SavedKg / 10);
        impact.calculationFormula = `CO2 = kg × ${EMISSION_FACTORS.waste}`;
        break;

      case 'tree':
        const treeCount = action.extractedData?.treeCount || 0;
        impact.co2SavedKg = treeCount * EMISSION_FACTORS.tree;
        impact.creditsEarned = Math.floor(impact.co2SavedKg / 10);
        impact.calculationFormula = `CO2 = trees × ${EMISSION_FACTORS.tree}`;
        break;

      default:
        logger.warn(`Unknown action type: ${action.actionType}`);
    }

    // Calculate trees equivalent (20 kg CO2 per tree per year)
    impact.treesEquivalent = Math.round(impact.co2SavedKg / 20);

    // Ensure credits are positive
    impact.creditsEarned = Math.max(0, impact.creditsEarned);

    logger.info(`Impact calculated for action ${action._id}: ${impact.creditsEarned} credits`);

  } catch (error) {
    logger.error('Impact calculation failed:', error);
    throw error;
  }

  return impact;
};

const calculateBatchImpact = async (actions) => {
  const results = [];
  for (const action of actions) {
    const impact = await calculateImpact(action);
    results.push(impact);
  }
  return results;
};

module.exports = {
  calculateImpact,
  calculateBatchImpact,
  EMISSION_FACTORS,
  REGIONAL_FACTORS
};
