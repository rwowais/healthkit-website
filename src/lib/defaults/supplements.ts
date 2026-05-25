/**
 * Default Supplements Protocol Items
 *
 * Edit this file to add, remove, or modify default supplement protocol items.
 * Each item needs a unique id starting with "supplements-default-XXX".
 * Set itemType to "task" for active check-off items, "reminder" for guidelines.
 */
import type { ProtocolItem } from "../types";

export const defaultSupplementsProtocol: ProtocolItem[] = [
  // ── MORNING (timingAnchor: "wake") ────────────────────────────
  {
    id: "supplements-default-001",
    pillar: "supplements",
    name: "Vitamin D3",
    description:
      "2,000-5,000 IU with breakfast (fat-containing meal). Essential for immune function, bone health, and mood regulation.",
    source: "default",
    itemType: "task",
    timingAnchor: "wake",
    timingOffsetMinutes: 90,
    timeOfDay: "morning",
    daysActive: [true, true, true, true, true, true, true],
    sortOrder: 1,
    isEnabled: true,
    icon: "☀️",
    recommendedBy: ["Clinical research"],
    evidenceNote:
      "Vitamin D deficiency is linked to increased all-cause mortality, immune dysfunction, and depression. Most adults in northern latitudes are insufficient. Take with dietary fat for optimal absorption. Pair with K2 to direct calcium to bones rather than arteries.",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "supplements-default-002",
    pillar: "supplements",
    name: "Omega-3 (EPA/DHA)",
    description:
      "2-4g combined EPA/DHA daily with food. Reduces systemic inflammation, supports cardiovascular and brain health.",
    source: "default",
    itemType: "task",
    timingAnchor: "wake",
    timingOffsetMinutes: 90,
    timeOfDay: "morning",
    daysActive: [true, true, true, true, true, true, true],
    sortOrder: 2,
    isEnabled: true,
    icon: "🐟",
    recommendedBy: ["Clinical research"],
    evidenceNote:
      "High-dose EPA/DHA supplementation (2-4g/day) significantly reduces triglycerides and inflammatory markers (hs-CRP). Longevity research suggests aiming for an omega-3 index above 8% via blood testing.",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "supplements-default-003",
    pillar: "supplements",
    name: "Creatine Monohydrate",
    description:
      "5g daily with any meal. The most researched sports supplement — supports strength, power output, and cognitive function.",
    source: "default",
    itemType: "task",
    timingAnchor: "wake",
    timingOffsetMinutes: 90,
    timeOfDay: "morning",
    daysActive: [true, true, true, true, true, true, true],
    sortOrder: 3,
    isEnabled: true,
    icon: "💪",
    recommendedBy: ["Clinical research"],
    evidenceNote:
      "Creatine monohydrate increases phosphocreatine stores in muscle and brain. Beyond strength gains, emerging evidence shows cognitive benefits, neuroprotection, and potential anti-aging effects. Timing doesn't matter — consistency does.",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "supplements-default-004",
    pillar: "supplements",
    name: "Vitamin K2 (MK-7)",
    description:
      "100-200mcg with breakfast. Directs calcium to bones and teeth rather than arteries. Essential companion to vitamin D3.",
    source: "default",
    itemType: "task",
    timingAnchor: "wake",
    timingOffsetMinutes: 90,
    timeOfDay: "morning",
    daysActive: [true, true, true, true, true, true, true],
    sortOrder: 4,
    isEnabled: true,
    icon: "🦴",
    recommendedBy: ["Longevity research"],
    evidenceNote:
      "Vitamin K2 activates matrix GLA protein (MGP) which inhibits arterial calcification, and osteocalcin which promotes bone mineralization. The MK-7 form has the longest half-life and most research support.",
    createdAt: "2026-01-01T00:00:00Z",
  },

  // ── AFTERNOON (timingAnchor: "wake") ──────────────────────────
  {
    id: "supplements-default-005",
    pillar: "supplements",
    name: "Athletic Greens / AG1",
    description:
      "Comprehensive greens powder covering micronutrient gaps. Not a replacement for whole foods but useful nutritional insurance.",
    source: "default",
    itemType: "task",
    timingAnchor: "wake",
    timingOffsetMinutes: 60,
    timeOfDay: "morning",
    daysActive: [true, true, true, true, true, true, true],
    sortOrder: 5,
    isEnabled: false,
    icon: "🥬",
    recommendedBy: ["Neuroscience research"],
    evidenceNote:
      "Greens powders provide a broad spectrum of vitamins, minerals, probiotics, and adaptogens. While not a substitute for a nutrient-dense diet, they can fill gaps especially during travel or periods of dietary inconsistency.",
    createdAt: "2026-01-01T00:00:00Z",
  },

  // ── EVENING (timingAnchor: "bed") ─────────────────────────────
  {
    id: "supplements-default-006",
    pillar: "supplements",
    name: "Magnesium Threonate",
    description:
      "200-400mg before bed. Crosses the blood-brain barrier to promote relaxation, improve sleep quality, and support cognitive function.",
    source: "default",
    itemType: "task",
    timingAnchor: "bed",
    timingOffsetMinutes: -30,
    timeOfDay: "night",
    daysActive: [true, true, true, true, true, true, true],
    sortOrder: 6,
    isEnabled: true,
    icon: "💊",
    recommendedBy: ["Clinical research"],
    evidenceNote:
      "Magnesium L-threonate (Magtein) is one of the few forms that effectively crosses the blood-brain barrier. It enhances GABAergic signaling, reduces cortisol, and has been shown to improve sleep quality and next-day cognitive performance.",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "supplements-default-007",
    pillar: "supplements",
    name: "L-Theanine",
    description:
      "100-200mg before bed. Amino acid from green tea that promotes alpha brain waves and relaxation without sedation.",
    source: "default",
    itemType: "task",
    timingAnchor: "bed",
    timingOffsetMinutes: -30,
    timeOfDay: "night",
    daysActive: [true, true, true, true, true, true, true],
    sortOrder: 7,
    isEnabled: false,
    icon: "🍵",
    recommendedBy: ["Neuroscience research"],
    evidenceNote:
      "L-theanine increases alpha brain wave activity (associated with calm alertness) and supports GABA, serotonin, and dopamine levels. Some research notes that some people experience excessively vivid dreams — discontinue if sleep feels disrupted.",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "supplements-default-008",
    pillar: "supplements",
    name: "Apigenin",
    description:
      "50mg before bed. A flavonoid that acts as a mild sedative by binding to GABA receptors and reducing anxiety.",
    source: "default",
    itemType: "task",
    timingAnchor: "bed",
    timingOffsetMinutes: -30,
    timeOfDay: "night",
    daysActive: [true, true, true, true, true, true, true],
    sortOrder: 8,
    isEnabled: false,
    icon: "🌼",
    recommendedBy: ["Neuroscience research"],
    evidenceNote:
      "Apigenin is found naturally in chamomile and acts as a chloride channel activator at GABA-A receptors. A common evening sleep stack includes it. Note: not recommended for women trying to conceive due to potential anti-estrogenic effects.",
    createdAt: "2026-01-01T00:00:00Z",
  },
];
