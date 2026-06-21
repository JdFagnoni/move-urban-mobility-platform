import {
  DEFAULT_CATEGORY_BEHAVIOR,
  DEFAULT_CATEGORY_PRICING,
  type CategoryBehaviorConfig,
  type CategoryPricingConfig,
} from "@move/shared";

/**
 * Pricing/behavior tiers applied when seeding categories.
 *
 * Each seed category (see `data/categories.csv`) is mapped to a tier by its
 * CSV source id. Categories that are not mapped explicitly fall back to the
 * `standard` tier, whose values match `DEFAULT_CATEGORY_PRICING` /
 * `DEFAULT_CATEGORY_BEHAVIOR`.
 *
 * The tier values intentionally differentiate cargo that is more expensive to
 * move or handle (fragile electronics, hazardous chemicals, heavy industrial
 * freight, medical goods, etc.) instead of charging a single flat rate for
 * every kind of cargo.
 */
export type CategoryPricingTier =
  | "standard"
  | "fragile"
  | "highValue"
  | "bulky"
  | "hazardous"
  | "medical"
  | "industrial";

export interface CategoryTierConfig {
  pricing: CategoryPricingConfig;
  behavior: CategoryBehaviorConfig;
}

export const CATEGORY_PRICING_TIERS: Record<CategoryPricingTier, CategoryTierConfig> = {
  // Generic consumer goods: clothing, crafts, stationery, toys. Flat default rate.
  standard: {
    pricing: { ...DEFAULT_CATEGORY_PRICING },
    behavior: { ...DEFAULT_CATEGORY_BEHAVIOR },
  },
  // Fragile / breakable cargo: consumer electronics, screens, glassware.
  fragile: {
    pricing: { baseFare: 150, pricePerKm: 12, surchargeType: "percentage", surchargeValue: 10 },
    behavior: { requiresMonitoring: false, generatesAlerts: false },
  },
  // High-value cargo: computers, fine jewelry, precision instruments, gift cards.
  highValue: {
    pricing: { baseFare: 200, pricePerKm: 15, surchargeType: "percentage", surchargeValue: 15 },
    behavior: { requiresMonitoring: true, generatesAlerts: false },
  },
  // Bulky / heavy but not sensitive: furniture, large appliances, fitness gear.
  bulky: {
    pricing: { baseFare: 250, pricePerKm: 20, surchargeType: "fixed", surchargeValue: 0 },
    behavior: { requiresMonitoring: false, generatesAlerts: false },
  },
  // Hazardous materials: fuels, lubricants, paints, industrial chemicals, reagents.
  hazardous: {
    pricing: { baseFare: 180, pricePerKm: 15, surchargeType: "fixed", surchargeValue: 20 },
    behavior: { requiresMonitoring: true, generatesAlerts: true },
  },
  // Medical supplies and equipment: time/condition sensitive cargo.
  medical: {
    pricing: { baseFare: 200, pricePerKm: 15, surchargeType: "percentage", surchargeValue: 10 },
    behavior: { requiresMonitoring: true, generatesAlerts: false },
  },
  // Heavy industrial freight: machinery, structural materials, bulk hardware.
  industrial: {
    pricing: { baseFare: 300, pricePerKm: 25, surchargeType: "fixed", surchargeValue: 0 },
    behavior: { requiresMonitoring: false, generatesAlerts: false },
  },
};

/**
 * Maps a category's CSV source id to a pricing tier. Any id not listed here
 * resolves to the `standard` tier via {@link resolveCategoryTier}.
 */
export const CATEGORY_TIER_BY_SOURCE_ID: Readonly<Record<string, CategoryPricingTier>> = {
  // Fragile — consumer electronics, screens, glassware, smart-home devices.
  "22": "fragile", // Lights, Bulbs & Indicators
  "26": "fragile", // Car Electronics & Accessories
  "46": "fragile", // Perfumes & Fragrances
  "56": "fragile", // Computer Monitors
  "58": "fragile", // Tablet Replacement Parts
  "60": "fragile", // Computer Networking
  "66": "fragile", // Computer External Components
  "69": "fragile", // Televisions & Video Products
  "70": "fragile", // GPS & Navigation
  "71": "fragile", // Headphones & Earbuds
  "72": "fragile", // Office Electronics
  "73": "fragile", // Portable Audio & Video
  "74": "fragile", // eBook Readers & Accessories
  "77": "fragile", // Video Projectors
  "78": "fragile", // Vehicle Electronics
  "80": "fragile", // Security & Surveillance Equipment
  "82": "fragile", // Home Audio & Theater Products
  "83": "fragile", // Video Game Consoles & Accessories
  "149": "fragile", // Electronic Components
  "169": "fragile", // Home Lighting & Ceiling Fans
  "170": "fragile", // Kitchen & Dining
  "174": "fragile", // Wall Art
  "181": "fragile", // Fish & Aquatic Pets (aquariums)
  "183": "fragile", // Reptiles & Amphibian Supplies (terrariums)
  "185": "fragile", // Smart Home: New Smart Devices
  "186": "fragile", // Smart Home: Voice Assistants and Hubs
  "187": "fragile", // Smart Home: Smart Locks and Entry
  "188": "fragile", // Smart Home: Home Entertainment
  "189": "fragile", // Smart Home: WiFi and Networking
  "190": "fragile", // Smart Home: Security Cameras and Systems
  "191": "fragile", // Smart Home: Lighting
  "192": "fragile", // Smart Home: Plugs and Outlets
  "193": "fragile", // Smart Home: Vacuums and Mops
  "194": "fragile", // Smart Home Thermostats
  "195": "fragile", // Smart Home: Lawn and Garden
  "196": "fragile", // Smart Home: Other Solutions
  "197": "fragile", // Smart Home: Heating & Cooling
  "206": "fragile", // Light Bulbs

  // High value — computers, fine jewelry, precision instruments, gift cards.
  "18": "highValue", // Automotive Performance Parts & Accessories
  "54": "highValue", // Computer Servers
  "55": "highValue", // Data Storage
  "57": "highValue", // Computers & Tablets
  "63": "highValue", // Computer Components
  "68": "highValue", // Wearable Technology
  "75": "highValue", // Cell Phones & Accessories
  "79": "highValue", // Camera & Photo
  "81": "highValue", // Computers
  "123": "highValue", // Women's Jewelry
  "125": "highValue", // Gift Cards
  "145": "highValue", // Test, Measure & Inspect
  "157": "highValue", // Additive Manufacturing Products

  // Bulky / heavy — furniture, large appliances, fitness equipment.
  "16": "bulky", // Automotive Tires & Wheels
  "27": "bulky", // RV Parts & Accessories
  "41": "bulky", // Nursery Furniture, Bedding & Décor
  "44": "bulky", // Baby Strollers & Accessories
  "124": "bulky", // Kids' Furniture
  "156": "bulky", // Food Service Equipment & Supplies
  "161": "bulky", // Retail Store Fixtures & Equipment
  "166": "bulky", // Furniture
  "171": "bulky", // Heating, Cooling & Air Quality
  "198": "bulky", // Sports & Fitness
  "201": "bulky", // Home Appliances

  // Hazardous — fuels, lubricants, paints, industrial chemicals, reagents.
  "14": "hazardous", // Automotive Paint & Paint Supplies
  "20": "hazardous", // Oils & Fluids
  "143": "hazardous", // Industrial Adhesives, Sealants & Lubricants
  "150": "hazardous", // Lab & Scientific Products
  "151": "hazardous", // Janitorial & Sanitation Supplies
  "204": "hazardous", // Paint, Wall Treatments & Supplies

  // Medical — professional and home medical supplies and equipment.
  "131": "medical", // Health Care Products
  "133": "medical", // Home Use Medical Supplies & Equipment
  "158": "medical", // Professional Medical Supplies
  "159": "medical", // Professional Dental Supplies

  // Industrial — heavy machinery, structural materials, bulk hardware.
  "15": "industrial", // Heavy Duty & Commercial Vehicle Equipment
  "17": "industrial", // Automotive Tools & Equipment
  "138": "industrial", // Commercial Door Products
  "139": "industrial", // Power Transmission Products
  "140": "industrial", // Industrial Materials
  "141": "industrial", // Industrial Hardware
  "142": "industrial", // Abrasive & Finishing Products
  "144": "industrial", // Material Handling Products
  "146": "industrial", // Industrial Power & Hand Tools
  "147": "industrial", // Hydraulics, Pneumatics & Plumbing
  "148": "industrial", // Filtration
  "153": "industrial", // Cutting Tools
  "154": "industrial", // Fasteners
  "162": "industrial", // Industrial & Scientific
  "203": "industrial", // Pumps & Plumbing Equipment
};

/** Resolves the pricing tier for a category's CSV source id. */
export function resolveCategoryTier(sourceId: string): CategoryPricingTier {
  return CATEGORY_TIER_BY_SOURCE_ID[sourceId] ?? "standard";
}

/** Returns the pricing/behavior config for a category's CSV source id. */
export function getCategoryTierConfig(sourceId: string): CategoryTierConfig {
  return CATEGORY_PRICING_TIERS[resolveCategoryTier(sourceId)];
}

/** True when the pricing matches the platform default (i.e. never customized). */
export function isDefaultPricing(pricing: CategoryPricingConfig): boolean {
  return (
    pricing.baseFare === DEFAULT_CATEGORY_PRICING.baseFare &&
    pricing.pricePerKm === DEFAULT_CATEGORY_PRICING.pricePerKm &&
    pricing.surchargeType === DEFAULT_CATEGORY_PRICING.surchargeType &&
    pricing.surchargeValue === DEFAULT_CATEGORY_PRICING.surchargeValue
  );
}

/** True when the behavior matches the platform default (i.e. never customized). */
export function isDefaultBehavior(behavior: CategoryBehaviorConfig): boolean {
  return (
    behavior.requiresMonitoring === DEFAULT_CATEGORY_BEHAVIOR.requiresMonitoring &&
    behavior.generatesAlerts === DEFAULT_CATEGORY_BEHAVIOR.generatesAlerts
  );
}
