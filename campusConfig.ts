export interface CampusZone {
  id: string;
  name: string;
  category: 'building' | 'cafeteria' | 'parking' | 'lecture_hall' | 'classroom' | 'hostel' | 'sports' | 'garden';
  coordinates: [number, number][];
}

// Converts a single center point into a 4-point polygon square for Leaflet
const makeBox = (lat: number, lng: number, size = 0.00015): [number, number][] => [
  [lat + size, lng - size],
  [lat + size, lng + size],
  [lat - size, lng + size],
  [lat - size, lng - size],
];

export const CAMPUS_CENTER: [number, number] = [12.66113, 77.44950]; // CDSIMER Center

// --- RAW DATA ARRAYS ---
const rawLectureHalls = [
  [12.66211, 77.45022], [12.66220, 77.45034], [12.66232, 77.45049], 
  [12.66206, 77.45024], [12.66216, 77.45038], [12.66227, 77.45055]
];

const rawClassrooms = [
  [12.66189, 77.45115], [12.66195, 77.45127], [12.66206, 77.45140], [12.66199, 77.45159],
  [12.66180, 77.45167], [12.66155, 77.45171], [12.66143, 77.45148], [12.66134, 77.45124],
  [12.66148, 77.45113], [12.66134, 77.45068], [12.66133, 77.45057], [12.66135, 77.45043],
  [12.66143, 77.45052], [12.66146, 77.45066], [12.66154, 77.45070], [12.66158, 77.45063],
  [12.66159, 77.45055], [12.66166, 77.45056], [12.66195, 77.45057], [12.66191, 77.45072],
  [12.66142, 77.44935], [12.66144, 77.44943], [12.66122, 77.44950], [12.66102, 77.44955],
  [12.66101, 77.44978], [12.66107, 77.44973], [12.66097, 77.44997], [12.66103, 77.45005],
  [12.66096, 77.45016]
];

const rawGardens = [
  [12.66175, 77.44965], [12.66178, 77.44971], [12.66164, 77.44983], [12.66193, 77.44987],
  [12.66178, 77.45000], [12.66197, 77.44998], [12.66190, 77.45008], [12.66110, 77.44891],
  [12.66120, 77.44897], [12.66117, 77.44907], [12.66088, 77.44885], [12.66085, 77.44892],
  [12.66065, 77.44895], [12.66037, 77.44900], [12.66019, 77.44913], [12.66069, 77.44872],
  [12.66173, 77.45029], [12.66162, 77.45030], [12.66127, 77.44994], [12.65915, 77.44841],
  [12.65929, 77.44862], [12.66080, 77.44839], [12.66063, 77.44857]
];

// --- MASTER ZONE EXPORT ---
export const campusZones: CampusZone[] = [
  // Main Buildings
  { id: 'cdsimer', name: 'CDSIMER Center', category: 'building', coordinates: makeBox(12.66113, 77.44950, 0.0002) },
  { id: 'soe', name: 'SOE Center', category: 'building', coordinates: makeBox(12.66186, 77.45063, 0.0002) },
  { id: 'a_block', name: 'A Block', category: 'building', coordinates: makeBox(12.66160, 77.45140, 0.0002) },
  { id: 'hospital', name: 'Hospital', category: 'building', coordinates: makeBox(12.66039, 77.44967, 0.0003) },
  { id: 'amphitheatre', name: 'Amphitheatre', category: 'building', coordinates: makeBox(12.66253, 77.45102, 0.0002) },
  { id: 'nursing', name: 'Nursing Block', category: 'building', coordinates: makeBox(12.65988, 77.44880, 0.0002) },
  { id: 'health_sciences', name: 'Health Sciences', category: 'building', coordinates: makeBox(12.65900, 77.44956, 0.0002) },
  { id: 'pharmacy', name: 'Pharmacy', category: 'building', coordinates: makeBox(12.65989, 77.45240, 0.0002) },

  // Cafeterias
  { id: 'cafe_tummy_trails', name: 'Tummy Trails (Cafe 1)', category: 'cafeteria', coordinates: makeBox(12.66026, 77.45270) },
  { id: 'cafe_bits_bites', name: 'Bits and Bites (Cafe 2)', category: 'cafeteria', coordinates: makeBox(12.66115, 77.44939) },
  { id: 'cafe_food_truck', name: 'Food Truck (Cafe 4)', category: 'cafeteria', coordinates: makeBox(12.66237, 77.45179) },

  // Parking
  { id: 'parking_1', name: 'Parking 1', category: 'parking', coordinates: makeBox(12.66226, 77.45001) },
  { id: 'parking_2', name: 'Parking 2', category: 'parking', coordinates: makeBox(12.66168, 77.44931) },
  { id: 'parking_3', name: 'Parking 3', category: 'parking', coordinates: makeBox(12.66039, 77.44844) },
  { id: 'parking_4', name: 'Parking 4', category: 'parking', coordinates: makeBox(12.66179, 77.45221) },
  { id: 'parking_5', name: 'Parking 5', category: 'parking', coordinates: makeBox(12.65766, 77.44655) },

  // Hostels & Laundry (Water Leak Monitoring)
  { id: 'hostel_1', name: 'Hostel 1', category: 'hostel', coordinates: makeBox(12.65753, 77.44749, 0.0002) },
  { id: 'hostel_2', name: 'Hostel 2', category: 'hostel', coordinates: makeBox(12.65805, 77.44711, 0.0002) },
  { id: 'hostel_3', name: 'Hostel 3', category: 'hostel', coordinates: makeBox(12.65776, 77.44730, 0.0002) },
  { id: 'hostel_4', name: 'Hostel 4', category: 'hostel', coordinates: makeBox(12.65875, 77.44868, 0.0002) },
  { id: 'laundry', name: 'Laundry Facility', category: 'hostel', coordinates: makeBox(12.65849, 77.44767) },

  // Stadiums (Irrigation/Maintenance)
  { id: 'stadium_cricket', name: 'Cricket Stadium', category: 'sports', coordinates: makeBox(12.66160, 77.45482, 0.0005) }, // Larger box
  { id: 'stadium_football', name: 'Football Stadium', category: 'sports', coordinates: makeBox(12.66149, 77.45588, 0.0005) }, // Larger box

  // Map over the raw arrays to dynamically generate the repeating zones
  ...rawLectureHalls.map((coords, i) => ({
    id: `lecture_hall_${i + 1}`, name: `Lecture Hall ${i + 1}`, category: 'lecture_hall' as const, coordinates: makeBox(coords[0], coords[1], 0.00008)
  })),

  ...rawClassrooms.map((coords, i) => ({
    id: `classroom_${i + 1}`, name: `Classroom ${i + 1}`, category: 'classroom' as const, coordinates: makeBox(coords[0], coords[1], 0.00005)
  })),

  ...rawGardens.map((coords, i) => ({
    id: `garden_${i + 1}`, name: `Garden Zone ${i + 1}`, category: 'garden' as const, coordinates: makeBox(coords[0], coords[1], 0.00006)
  }))
];