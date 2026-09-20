-- Sample rows so the map has pins before the real data is wired up.
-- Gainesville, FL landmarks. Replace with the real scans.

INSERT INTO sites (
    slug, name, short_description, description, category,
    latitude, longitude, model_id, model_format,
    address, admission_cost, currency, opening_hours,
    visit_duration_minutes, accessibility, year_built, website
) VALUES
(
    'university-auditorium',
    'University Auditorium',
    'Collegiate Gothic auditorium with a 1925 Anderson Memorial Organ.',
    'Completed in 1925, the University Auditorium anchors the historic district of the University of Florida campus. Its brick-and-limestone Collegiate Gothic facade opens onto a hall that still houses the Anderson Memorial Organ, a 6,000-pipe instrument installed for the building''s opening.',
    'Historic Building',
    29.649500, -82.343400,
    'ua-scan-001', 'glb',
    '333 Newell Dr, Gainesville, FL 32611',
    0, 'USD', 'Open during scheduled events',
    30, 'Step-free entry on the north side; accessible seating available.',
    1925, 'https://arts.ufl.edu'
),
(
    'bok-tower-plaza',
    'Plaza of the Americas',
    'Shaded campus green ringed by live oaks and historic halls.',
    'The Plaza of the Americas has served as the University of Florida''s central green since the 1930s. The live oaks framing it were planted to commemorate the republics of the Americas, and the surrounding buildings trace the campus''s growth from a handful of brick halls into a research university.',
    'Park',
    29.650900, -82.342200,
    'plaza-scan-002', 'glb',
    'Plaza of the Americas, Gainesville, FL 32611',
    0, 'USD', 'Daily, dawn to dusk',
    20, 'Paved paths throughout; gentle slope on the west edge.',
    1930, NULL
),
(
    'matheson-museum',
    'Matheson History Museum',
    'Alachua County history in a 1867 homestead and archive.',
    'The Matheson History Museum preserves Alachua County''s written and material record. The adjacent Matheson House, built in 1867, is one of the oldest standing residences in Gainesville and is furnished to reflect late-nineteenth-century family life.',
    'Museum',
    29.650200, -82.320600,
    'matheson-scan-003', 'glb',
    '513 E University Ave, Gainesville, FL 32601',
    5, 'USD', 'Tue-Sat, 11:00-16:00',
    60, 'Museum is fully accessible; historic house has a stepped entry.',
    1867, 'https://mathesonmuseum.org'
),
(
    'devils-millhopper',
    'Devil''s Millhopper Geological State Park',
    'A 120-foot sinkhole with a boardwalk down through exposed strata.',
    'Devil''s Millhopper is a National Natural Landmark: a bowl-shaped sinkhole 120 feet deep where small waterfalls drop into the basin. The stairway down the side passes through layers of limestone that hold fossilised shark teeth and marine shells from when Florida lay under a shallow sea.',
    'Natural Landmark',
    29.706100, -82.395600,
    'millhopper-scan-004', 'glb',
    '4732 Millhopper Rd, Gainesville, FL 32653',
    4, 'USD', 'Wed-Sun, 09:00-17:00',
    90, 'Rim trail is accessible; the 232-step boardwalk into the sink is not.',
    NULL, 'https://floridastateparks.org/DevilsMillhopper'
),
(
    'thomas-center',
    'Thomas Center',
    'Mediterranean Revival estate turned civic arts venue.',
    'Built as a private residence in 1906 and expanded into the Hotel Thomas in the 1920s, the Thomas Center is a Mediterranean Revival landmark in the Northeast Historic District. It now houses city galleries, and its formal gardens remain open to the public.',
    'Historic Building',
    29.657300, -82.322600,
    'thomas-scan-005', 'glb',
    '302 NE 6th Ave, Gainesville, FL 32601',
    0, 'USD', 'Mon-Fri, 08:00-17:00',
    45, 'Ramped entry and elevator to the second-floor galleries.',
    1906, 'https://www.gainesvillefl.gov'
)
ON CONFLICT (slug) DO NOTHING;
