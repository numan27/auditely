// app/_shared/lib/audit/nicheTypes.ts

// Maps a search niche to the schema.org types a business in that niche should
// use, and lists the LocalBusiness-family types GEO accepts as a business entity.

interface NicheRule {
  keywords: string[];
  types: string[];
  medical: boolean;
}

// First matching rule wins ("dental clinic" → Dentist, not MedicalClinic)
const NICHE_RULES: NicheRule[] = [
  { keywords: ['dentist', 'dental', 'orthodont'], types: ['Dentist'], medical: true },
  {
    keywords: ['clinic', 'medical', 'doctor', 'physician', 'chiropract', 'physio', 'dermatolog', 'pediatric'],
    types: ['MedicalClinic', 'Physician', 'MedicalBusiness', 'MedicalOrganization'],
    medical: true,
  },
  {
    keywords: ['school', 'academy', 'tutor', 'college', 'university', 'education', 'preschool', 'daycare', 'learning'],
    types: [
      'EducationalOrganization', 'School', 'CollegeOrUniversity', 'Preschool',
      'ElementarySchool', 'MiddleSchool', 'HighSchool',
    ],
    medical: false,
  },
];

// LocalBusiness and its common subtypes, plus the expected types above.
// Educational types aren't LocalBusiness subtypes in schema.org, but they are
// the local entity for schools.
const LOCAL_BUSINESS_TYPES = new Set([
  'LocalBusiness', 'ProfessionalService',
  'MedicalBusiness', 'MedicalClinic', 'MedicalOrganization', 'Dentist', 'Physician',
  'Optician', 'Pharmacy', 'VeterinaryCare',
  'HealthAndBeautyBusiness', 'BeautySalon', 'HairSalon', 'DaySpa', 'NailSalon',
  'HealthClub', 'ExerciseGym', 'SportsActivityLocation',
  'HomeAndConstructionBusiness', 'Plumber', 'Electrician', 'HVACBusiness',
  'RoofingContractor', 'GeneralContractor', 'HousePainter', 'Locksmith', 'MovingCompany',
  'AutomotiveBusiness', 'AutoRepair', 'AutoDealer',
  'LegalService', 'Attorney', 'Notary',
  'FinancialService', 'AccountingService', 'InsuranceAgency', 'RealEstateAgent',
  'FoodEstablishment', 'Restaurant', 'CafeOrCoffeeShop', 'Bakery', 'Store',
  'ChildCare', 'EntertainmentBusiness', 'LodgingBusiness', 'Hotel',
  'EmergencyService', 'EmploymentAgency', 'TravelAgency', 'AnimalShelter', 'Library',
  'EducationalOrganization', 'School', 'CollegeOrUniversity', 'Preschool',
  'ElementarySchool', 'MiddleSchool', 'HighSchool',
]);

function ruleFor(niche: string | null): NicheRule | null {
  if (!niche) return null;
  const n = niche.toLowerCase();
  return NICHE_RULES.find((rule) => rule.keywords.some((k) => n.includes(k))) ?? null;
}

export const expectedTypesForNiche = (niche: string | null): string[] | null =>
  ruleFor(niche)?.types ?? null;

export const isMedicalNiche = (niche: string | null): boolean => ruleFor(niche)?.medical ?? false;

export const isLocalBusinessType = (type: string): boolean => LOCAL_BUSINESS_TYPES.has(type);
