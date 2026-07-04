/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LandParcel, LandUse, ParcelStatus, OwnerType, SurveyAssignment, LandDispute, LandApplication, NeighborNotification, IoTSensorFeed, DroneMission, GeoFenceEvent } from "../types";

export const RWANDA_PROVINCES = [
  { id: "1", name: "Kigali City" },
  { id: "2", name: "Northern Province" },
  { id: "3", name: "Southern Province" },
  { id: "4", name: "Eastern Province" },
  { id: "5", name: "Western Province" }
];

export const RWANDA_DISTRICTS: Record<string, string[]> = {
  "1": ["Gasabo", "Kicukiro", "Nyarugenge"],
  "2": ["Musanze", "Gicumbi", "Burera", "Rulindo", "Gakenke"],
  "3": ["Huye", "Nyanza", "Gisagara", "Kamonyi", "Muhanga", "Ruhango", "Nyamagabe", "Nyaruguru"],
  "4": ["Rwamagana", "Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare"],
  "5": ["Rubavu", "Karongi", "Rusizi", "Rutsiro", "Nyamasheke", "Nyabihu", "Ngororero"]
};

export const RWANDA_SECTORS: Record<string, string[]> = {
  "Gasabo": ["Kimihurura", "Kacyiru", "Remera", "Gisozi", "Ndera", "Bumbogo", "Jabana"],
  "Kicukiro": ["Kagarama", "Gatenga", "Kanombe", "Nyarugunga", "Kigarama", "Gahanga"],
  "Nyarugenge": ["Nyarugenge", "Nyamirambo", "Kanyinya", "Mageragere", "Kigali", "Kimisagara"]
};

export const INITIAL_PARCELS: LandParcel[] = [
  {
    id: "p1",
    upi: "1/02/11/04/1841",
    polygon: [[150, 150], [280, 140], [300, 240], [170, 260]],
    center: [225, 197],
    area: 14200,
    landUse: LandUse.RESIDENTIAL,
    status: ParcelStatus.APPROVED,
    ownerName: "Jean Bosco Nkurunziza",
    ownerId: "1198580045239104",
    ownerType: OwnerType.INDIVIDUAL,
    district: "Gasabo",
    sector: "Kimihurura",
    cell: "Rugando",
    village: "Gasasa",
    marketValue: 45000000,
    annualTax: 120000,
    taxPaid: true,
    history: [
      {
        date: "2018-05-12",
        type: "Registration",
        details: "Initial adjudication and registration under LAIS digital program.",
        actor: "District Land Registrar (Gasabo)",
        documentRef: "LAIS-REG-2018-0941"
      },
      {
        date: "2022-10-14",
        type: "Survey",
        details: "Boundary verification for building permit application.",
        actor: "Licensed Surveyor (Ndamage Eric)"
      }
    ],
    documents: [
      {
        id: "doc1-v1",
        name: "Land_Deed_JeanBosco_1841_v1.pdf",
        fileType: "application/pdf",
        uploadedAt: "2018-05-12T09:30:00Z",
        uploadedBy: "District Land Registrar (Gasabo)",
        digitalSignature: "SHA256:d8c6b20c9efb011d8c1e828a2a472db45e6ff93d258a183d2cb2f9011ba2ea81",
        version: 1,
        size: "2.4 MB",
        category: "Land Deed"
      },
      {
        id: "doc2-v1",
        name: "Boundary_Survey_Report_1841.pdf",
        fileType: "application/pdf",
        uploadedAt: "2022-10-14T14:15:00Z",
        uploadedBy: "Licensed Surveyor (Ndamage Eric)",
        digitalSignature: "SHA256:a914bc82dbca44018ca83de4c718ea918db4742a049d5c829e1fca942918b95c",
        version: 1,
        size: "3.1 MB",
        category: "Survey Report"
      },
      {
        id: "doc1-v2",
        name: "Land_Deed_JeanBosco_1841_v2_Signed.pdf",
        fileType: "application/pdf",
        uploadedAt: "2024-03-10T11:05:00Z",
        uploadedBy: "District Land Registrar (Gasabo)",
        digitalSignature: "SHA256:f4b1e389d09a1c849e7b419c832a4e9812f8a7e098a76d8b9e7314f8231a409e",
        version: 2,
        size: "2.5 MB",
        category: "Land Deed"
      }
    ]
  },
  {
    id: "p2",
    upi: "1/02/11/04/1842",
    polygon: [[300, 240], [280, 140], [450, 120], [430, 220]],
    center: [365, 180],
    area: 15100,
    landUse: LandUse.RESIDENTIAL,
    status: ParcelStatus.APPROVED,
    ownerName: "Marie Louise Uwikirezi",
    ownerId: "2198970034112948",
    ownerType: OwnerType.INDIVIDUAL,
    district: "Gasabo",
    sector: "Kimihurura",
    cell: "Rugando",
    village: "Gasasa",
    marketValue: 48000000,
    annualTax: 135000,
    taxPaid: true,
    history: [
      {
        date: "2019-02-18",
        type: "Registration",
        details: "Inherited from parent's estate, registered directly under LAIS system.",
        actor: "Notary Public of Gasabo",
        documentRef: "LAIS-REG-2019-1142"
      }
    ],
    documents: [
      {
        id: "doc3-v1",
        name: "Succession_Certificate_1842.pdf",
        fileType: "application/pdf",
        uploadedAt: "2019-02-18T10:00:00Z",
        uploadedBy: "Notary Public of Gasabo",
        digitalSignature: "SHA256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        version: 1,
        size: "1.8 MB",
        category: "Identity Document"
      },
      {
        id: "doc4-v1",
        name: "UPI_1842_Original_Deed.pdf",
        fileType: "application/pdf",
        uploadedAt: "2019-02-18T10:30:00Z",
        uploadedBy: "Notary Public of Gasabo",
        digitalSignature: "SHA256:4a8b7c9e0d1f2e3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a",
        version: 1,
        size: "4.2 MB",
        category: "Land Deed"
      }
    ]
  },
  {
    id: "p3",
    upi: "1/02/11/04/1843",
    polygon: [[430, 220], [450, 120], [580, 110], [600, 260], [500, 270]],
    center: [512, 196],
    area: 21800,
    landUse: LandUse.PROTECTED,
    status: ParcelStatus.APPROVED,
    ownerName: "State of Rwanda (MINICOF)",
    ownerId: "0000000000000000",
    ownerType: OwnerType.GOVERNMENT,
    district: "Gasabo",
    sector: "Kimihurura",
    cell: "Rugando",
    village: "Kamazazi",
    marketValue: 120000000,
    annualTax: 0,
    taxPaid: true,
    history: [
      {
        date: "2015-08-01",
        type: "Registration",
        details: "National environmental wetland preservation boundary established.",
        actor: "Director General REMA",
        documentRef: "REMA-WET-2015-01"
      }
    ]
  },
  {
    id: "p4",
    upi: "1/02/11/04/1844",
    polygon: [[170, 260], [300, 240], [430, 220], [500, 270], [460, 420], [200, 400]],
    center: [343, 318],
    area: 52400,
    landUse: LandUse.AGRICULTURAL,
    status: ParcelStatus.PENDING_MUTATION,
    ownerName: "Gasabo Cooperative Agronome",
    ownerId: "4002340051184900",
    ownerType: OwnerType.COOPERATIVE,
    district: "Gasabo",
    sector: "Kimihurura",
    cell: "Rugando",
    village: "Gasasa",
    marketValue: 85000000,
    annualTax: 85000,
    taxPaid: false,
    history: [
      {
        date: "2017-04-10",
        type: "Registration",
        details: "Cooperative agricultural consolidation program entry.",
        actor: "District Land Registrar (Gasabo)",
        documentRef: "COOP-REG-2017-482"
      },
      {
        date: "2026-06-15",
        type: "Mutation",
        details: "Application submitted for dividing the parcel into 3 smaller residential lots.",
        actor: "Cooperative President (Habimana Faustin)"
      }
    ]
  },
  {
    id: "p5",
    upi: "1/02/11/04/1845",
    polygon: [[580, 110], [750, 100], [770, 250], [600, 260]],
    center: [675, 180],
    area: 25500,
    landUse: LandUse.COMMERCIAL,
    status: ParcelStatus.APPROVED,
    ownerName: "Akagera Estates Ltd",
    ownerId: "3008400192023910",
    ownerType: OwnerType.COMPANY,
    district: "Gasabo",
    sector: "Kimihurura",
    cell: "Rugando",
    village: "Kamazazi",
    marketValue: 145000000,
    annualTax: 580000,
    taxPaid: true,
    history: [
      {
        date: "2021-11-20",
        type: "Transfer",
        details: "Transferred from previous private owner Alphonsine Mukamana.",
        actor: "Notary Public of Gasabo",
        documentRef: "NOT-TRANS-2021-884"
      }
    ]
  }
];

export const INITIAL_SURVEYS: SurveyAssignment[] = [
  {
    id: "srv-001",
    parcelId: "p4",
    upi: "1/02/11/04/1844",
    requestorName: "Gasabo Cooperative Agronome",
    requestorPhone: "+250 788 555 123",
    assignedSurveyorId: "sv-101",
    assignedSurveyorName: "Pierre Claver Mugisha",
    district: "Gasabo",
    sector: "Kimihurura",
    cell: "Rugando",
    village: "Gasasa",
    status: "Active",
    requestedDate: "2026-06-20",
    surveyDate: "2026-07-02",
    geofenceRadius: 250,
    beaconsConfirmed: 3,
    voiceNotesCount: 2,
    notes: "Division/Mutation survey in progress. Measuring southern boundaries and checking alignment with neighboring road reserve."
  },
  {
    id: "srv-002",
    requestorName: "Karasira Gatera Alain",
    requestorPhone: "+250 784 112 345",
    assignedSurveyorId: "sv-102",
    assignedSurveyorName: "Dative Uwase",
    district: "Gasabo",
    sector: "Kacyiru",
    cell: "Kamutwa",
    village: "Inyange",
    status: "Pending",
    requestedDate: "2026-06-30",
    geofenceRadius: 100,
    beaconsConfirmed: 0,
    voiceNotesCount: 0,
    notes: "First-time adjudication and digital registration for a commercial plot."
  }
];

export const INITIAL_DISPUTES: LandDispute[] = [
  {
    id: "dsp-001",
    parcelId: "p1",
    upi: "1/02/11/04/1841",
    claimantName: "Alphonsine Mukamana",
    claimantId: "2197580092104523",
    claimantPhone: "+250 788 332 990",
    disputeType: "Boundary Encroachment",
    description: "Claims that Jean Bosco Nkurunziza shifted his eastern boundary fence by 2.5 meters during a recent wall reconstruction, encroaching into the adjacent buffer zone.",
    status: "Investigation",
    filedDate: "2026-05-18",
    assignedOfficer: "Clarisse Nyiramana (Gasabo Land Officer)",
    evidenceDocs: [
      { name: "Boundary_Survey_2018.pdf", url: "#" },
      { name: "Fence_Photo_Encroach.jpg", url: "#" }
    ]
  },
  {
    id: "dsp-002",
    parcelId: "p2",
    upi: "1/02/11/04/1842",
    claimantName: "Uwera Solange",
    claimantId: "2199270034451109",
    claimantPhone: "+250 785 443 112",
    disputeType: "Inheritance / Family Claim",
    description: "Contests the sole ownership of Marie Louise Uwikirezi, claiming that the land was family estate and should have been split among three siblings.",
    status: "Hearing Scheduled",
    filedDate: "2026-06-05",
    hearingDate: "2026-07-15",
    assignedOfficer: "Emmanuel Ruzindana (District Arbitrator)",
    evidenceDocs: [
      { name: "Family_Succession_Decree_2019.pdf", url: "#" }
    ]
  }
];

export const INITIAL_APPLICATIONS: LandApplication[] = [
  {
    id: "app-001",
    type: "Transfer",
    upi: "1/02/11/04/1841",
    applicantName: "Jean Bosco Nkurunziza",
    applicantId: "1198580045239104",
    status: "Pending Notary",
    submittedDate: "2026-06-25",
    targetBuyerName: "Patrick Mugenzi",
    targetBuyerId: "1199180029304112",
    transferPrice: 42000000,
    documents: [
      { name: "Sales_Agreement_Signed.pdf", status: "Verified" },
      { name: "Buyer_National_ID.pdf", status: "Verified" },
      { name: "Seller_Tax_Clearance.pdf", status: "Verified" }
    ],
    paymentStatus: "Paid",
    paymentReceipt: "Irembo-Receipt-7749103"
  },
  {
    id: "app-002",
    type: "Subdivision",
    upi: "1/02/11/04/1844",
    applicantName: "Gasabo Cooperative Agronome",
    applicantId: "4002340051184900",
    status: "Pending Surveyor",
    submittedDate: "2026-06-28",
    documents: [
      { name: "Cooperative_Resolution.pdf", status: "Verified" },
      { name: "Proposed_Mutation_Layout.pdf", status: "Pending" }
    ],
    paymentStatus: "Unpaid"
  }
];

export const INITIAL_NEIGHBOR_NOTIFICATIONS: NeighborNotification[] = [
  {
    id: "ntf-101",
    surveyId: "srv-001",
    neighborUpi: "1/02/11/04/1841",
    neighborName: "Jean Bosco Nkurunziza",
    neighborPhone: "+250 788 442 110",
    distance: 145,
    status: "Confirmed",
    response: "Attending",
    responseNotes: "I will be present at the site to verify the border beacons."
  },
  {
    id: "ntf-102",
    surveyId: "srv-001",
    neighborUpi: "1/02/11/04/1842",
    neighborName: "Marie Louise Uwikirezi",
    neighborPhone: "+250 788 123 456",
    distance: 220,
    status: "Read",
    response: "Reschedule_Requested",
    responseNotes: "Can we start at 11:00 AM instead of 8:00 AM? I have another meeting."
  },
  {
    id: "ntf-103",
    surveyId: "srv-001",
    neighborUpi: "1/02/11/04/1843",
    neighborName: "REMA Officer (Wetland Boundary)",
    neighborPhone: "+250 781 110 002",
    distance: 98,
    status: "Sent"
  }
];

export const INITIAL_IOT_SENSORS: IoTSensorFeed[] = [
  {
    id: "iot-001",
    type: "GNSS",
    name: "Gasabo CORS RTK Station (GSA1)",
    status: "Online",
    reading: "Satellites: 24 | PDOP: 1.15 | H-Accuracy: 0.008m | V-Accuracy: 0.014m",
    coordinates: [120, 80]
  },
  {
    id: "iot-002",
    type: "Weather",
    name: "Kigali Land Weather Beacon (W1)",
    status: "Online",
    reading: "Temp: 24.2°C | Humidity: 62% | Wind: 8.4 km/h SW | Pressure: 1012 hPa",
    coordinates: [400, 320]
  },
  {
    id: "iot-003",
    type: "Soil",
    name: "Wetland Soil Moisture Anchor (S-4)",
    status: "Online",
    reading: "Moisture: 74% | PH: 6.8 | Temp: 19.5°C",
    coordinates: [520, 220]
  }
];

export const INITIAL_DRONE_MISSIONS: DroneMission[] = [
  {
    id: "drn-01",
    pilotName: "Claude Mugabo (RCAA Licensed)",
    flightArea: "Kimihurura West Sector",
    status: "Completed",
    progress: 100,
    photoCount: 142,
    orthophotoUrl: "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1200&q=80"
  },
  {
    id: "drn-02",
    pilotName: "Divine Giramata",
    flightArea: "Kacyiru Valley Reserve",
    status: "Flying",
    progress: 68,
    photoCount: 88
  }
];

export const INITIAL_GEOFENCE_EVENTS: GeoFenceEvent[] = [
  {
    id: "gf-001",
    surveyId: "srv-001",
    type: "entry",
    message: "Surveyor Pierre Claver Mugisha entered geofence zone (250m radius) around UPI 1/02/11/04/1844",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    position: [340, 310],
    distance: 12,
    acknowledged: true,
    severity: "info"
  },
  {
    id: "gf-002",
    surveyId: "srv-001",
    type: "proximity_alert",
    message: "Neighbor beacon detected 98m from wetland conservation boundary (Nyabugogo zone)",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    position: [520, 220],
    distance: 98,
    acknowledged: true,
    severity: "warning"
  },
  {
    id: "gf-003",
    surveyId: "srv-001",
    type: "breach",
    message: "CRITICAL: Survey beacon placement overlaps protected wetland buffer by 4.2m — REMA violation risk",
    timestamp: new Date(Date.now() - 900000).toISOString(),
    position: [510, 215],
    distance: 4,
    acknowledged: false,
    severity: "critical"
  },
  {
    id: "gf-004",
    surveyId: "srv-001",
    type: "exit",
    message: "Surveyor exited primary geofence zone. RTK base station signal re-acquired.",
    timestamp: new Date(Date.now() - 60000).toISOString(),
    position: [290, 250],
    distance: 310,
    acknowledged: false,
    severity: "info"
  }
];
