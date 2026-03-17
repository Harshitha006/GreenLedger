export const ACTION_TYPES = {
    ELECTRICITY: 'electricity',
    SOLAR: 'solar',
    EV: 'ev',
    TRANSPORT: 'transport',
    WATER: 'water',
    WASTE: 'waste'
};

export const ACTION_TYPE_LABELS = {
    [ACTION_TYPES.ELECTRICITY]: 'Electricity Saving',
    [ACTION_TYPES.SOLAR]: 'Solar Installation',
    [ACTION_TYPES.EV]: 'EV Charging',
    [ACTION_TYPES.TRANSPORT]: 'Public Transport',
    [ACTION_TYPES.WATER]: 'Water Conservation',
    [ACTION_TYPES.WASTE]: 'Waste Management'
};

export const ACTION_STATUS = {
    PENDING: 'pending',
    VERIFYING: 'verifying',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    FLAGGED: 'flagged'
};

export const USER_ROLES = {
    USER: 'user',
    ADMIN: 'admin',
    INSTITUTION: 'institution'
};

export const CREDIT_CONVERSION = {
    CO2_PER_CREDIT: 10, // 1 credit = 10 kg CO2
    ELECTRICITY_FACTOR: 0.82, // kg CO2 per kWh
    WATER_FACTOR: 0.0003, // kg CO2 per liter
};

export const REWARD_CATEGORIES = {
    FOOD: 'food',
    SHOPPING: 'shopping',
    TRANSPORT: 'transport',
    DONATION: 'donation'
};
