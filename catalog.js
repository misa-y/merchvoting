window.DESIGN_CATALOG = [
  { id: "charcoal_foldover_pants", name: "Charcoal Foldover Pants", image: "./charcoal_foldover_pants.png" },
  { id: "polkadot_white_tank", name: "Polkadot White Tank", image: "./polkadot_white_tank.png" },
  { id: "sequin_tank", name: "Sequin Tank", image: "./sequin_tank.png" },
  { id: "mustangbobiscalling_shirt", name: "Mustang Bob Is Calling Shirt", image: "./mustangbobiscalling_shirt.png" },
  { id: "asij_patchwork_tank", name: "ASIJ Patchwork Tank", image: "./asij_patchwork_tank.png" },
  { id: "asij_hoodie", name: "ASIJ Hoodie", image: "./asij_hoodie.png" },
  { id: "asij_pants", name: "ASIJ Pants", image: "./asij_pants.png" },
  { id: "pov_shirt", name: "POV Shirt", image: "./pov_shirt.png" },
  { id: "AP_exam_survivor_shirt", name: "AP Exam Survivor Shirt", image: "./AP_exam_survivor_shirt.png" },
  { id: "athleisure_longsleeve", name: "Athleisure Longsleeve", image: "./athleisure_longsleeve.png" },
  { id: "asij_fleece", name: "ASIJ Fleece", image: "./asij_fleece.png" },
  { id: "asij_sweatpants", name: "ASIJ Sweatpants", image: "./asij_sweatpants.png" },
];

// Concept options describe possible future variants, not stock availability.
window.MERCH_COLORS = {
  Navy: '#223856', Black: '#25262a', Gray: '#92969b', White: '#f6f3e9',
  Burgundy: '#823d50', Sage: '#9ba997', Pink: '#e2a6bb', Butter: '#ede59b',
};
window.DESIGN_CATALOG = window.DESIGN_CATALOG.map((design) => {
  const kind = /pants/.test(design.id) ? 'pants'
    : /hoodie/.test(design.id) ? 'hoodie'
    : /tank/.test(design.id) ? 'tank'
    : /fleece|longsleeve/.test(design.id) ? 'longsleeve' : 'shirt';
  return {
    ...design, kind,
    colors: ['asij_hoodie', 'asij_pants'].includes(design.id) ? ['Navy', 'Black', 'Gray', 'White', 'Butter']
      : kind === 'pants' ? ['Navy', 'Black', 'Gray', 'Sage']
      : kind === 'tank' ? ['White', 'Black', 'Pink', 'Navy']
      : ['Navy', 'Black', 'Gray', 'White', 'Burgundy'],
    fits: kind === 'pants' ? ['Regular', 'Relaxed', 'Wide leg']
      : kind === 'tank' ? ['Regular', 'Cropped'] : ['Regular', 'Oversized', 'Cropped'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  };
});
