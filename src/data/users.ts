import { UserRole } from "../types";

export interface AuthUser {
  username: string;
  password: string;
  name: string;
  role: UserRole;
  nationalId: string;
  phone: string;
  email: string;
  district: string;
  sector: string;
}

export const MOCK_USERS: AuthUser[] = [
  {
    username: "citizen",
    password: "citizen123",
    name: "Marie Louise Uwikirezi",
    role: UserRole.CITIZEN,
    nationalId: "2198970034112948",
    phone: "+250 788 123 456",
    email: "uwikirezimarielouise@gmail.com",
    district: "Kigali City",
    sector: "Kimihurura",
  },
  {
    username: "surveyor",
    password: "surveyor123",
    name: "Pierre Claver Mugisha",
    role: UserRole.SURVEYOR,
    nationalId: "1198870045123789",
    phone: "+250 788 987 654",
    email: "pcmugisha@rlmua.gov.rw",
    district: "Kigali City",
    sector: "Nyarugenge",
  },
  {
    username: "officer",
    password: "officer123",
    name: "Land Officer Muganzi",
    role: UserRole.LAND_OFFICER,
    nationalId: "1197680033112567",
    phone: "+250 788 456 789",
    email: "jmuganzi@rlmua.gov.rw",
    district: "Kigali City",
    sector: "Gasabo",
  },
  {
    username: "admin",
    password: "admin123",
    name: "District Admin Gasabo",
    role: UserRole.ADMIN,
    nationalId: "1196580022111345",
    phone: "+250 788 321 654",
    email: "admin.gasabo@rlmua.gov.rw",
    district: "Kigali City",
    sector: "Gasabo",
  },
  {
    username: "registrar",
    password: "registrar123",
    name: "Registrar Esperance Mukamana",
    role: UserRole.REGISTRAR,
    nationalId: "1196580033122789",
    phone: "+250 788 456 001",
    email: "emukamana@rlmua.gov.rw",
    district: "Kigali City",
    sector: "Gasabo",
  },
  {
    username: "notary",
    password: "notary123",
    name: "Maitre Thierry Rugamba",
    role: UserRole.NOTARY,
    nationalId: "1197680044221567",
    phone: "+250 788 789 012",
    email: "trugamba@notariat.gov.rw",
    district: "Kigali City",
    sector: "Kimihurura",
  },
  {
    username: "drone",
    password: "drone123",
    name: "Capt. Jean Baptiste Habimana",
    role: UserRole.DRONE_MISSION,
    nationalId: "1195480011223456",
    phone: "+250 788 654 321",
    email: "jbhabimana@rlmua.gov.rw",
    district: "Kigali City",
    sector: "Kicukiro",
  },
];

export function authenticateUser(username: string, password: string): AuthUser | null {
  return MOCK_USERS.find((u) => u.username === username && u.password === password) || null;
}
