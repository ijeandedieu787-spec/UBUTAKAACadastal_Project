/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  CITIZEN = "Citizen",
  SURVEYOR = "Licensed Surveyor",
  LAND_OFFICER = "Land Officer",
  ADMIN = "District/National Administrator",
  NOTARY = "Notary",
  DRONE_MISSION = "Drone Mission Control",
  REGISTRAR = "District Registrar",
}

export enum OwnerType {
  INDIVIDUAL = "Individual",
  JOINT = "Joint",
  FAMILY = "Family",
  COMPANY = "Company",
  GOVERNMENT = "Government",
  COOPERATIVE = "Cooperative",
}

export enum LandUse {
  RESIDENTIAL = "Residential (R1/R2)",
  AGRICULTURAL = "Agricultural (A)",
  COMMERCIAL = "Commercial (C1/C2)",
  FORESTRY = "Forestry & Conservation",
  INDUSTRIAL = "Industrial (I)",
  PROTECTED = "Protected Wetlands",
}

export enum ParcelStatus {
  APPROVED = "Registered & Approved",
  UNDER_SURVEY = "Under Active Survey",
  DISPUTED = "Disputed",
  PENDING_MUTATION = "Pending Division/Mutation",
}

export interface RegistryHistory {
  date: string;
  type: "Registration" | "Transfer" | "Mutation" | "Survey" | "Dispute Filed" | "Dispute Resolved";
  details: string;
  actor: string;
  documentRef?: string;
}

export interface ParcelDocument {
  id: string;
  name: string;
  fileType: string;         // e.g., "application/pdf", "image/png"
  uploadedAt: string;       // ISO Timestamp or date string
  uploadedBy: string;       // User name or role
  digitalSignature: string; // Crypto sign ref, e.g., "SHA256:7f3b..."
  version: number;          // Document version number, e.g., 1, 2, 3
  size: string;             // E.g., "1.8 MB"
  category: "Land Deed" | "Survey Report" | "Tax Clearance" | "Court Order" | "Identity Document" | "Other";
}

export interface LandParcel {
  id: string;
  upi: string; // Unique Parcel Identifier (e.g., 1/02/11/04/1842)
  polygon: [number, number][]; // SVG space coordinate points [x, y]
  center: [number, number];
  area: number; // in sqm
  landUse: LandUse;
  status: ParcelStatus;
  ownerName: string;
  ownerId: string; // Rwanda National ID (16 digits starting with 1 or 2)
  ownerType: OwnerType;
  district: string;
  sector: string;
  cell: string;
  village: string;
  marketValue: number; // RWF
  annualTax: number; // RWF
  taxPaid: boolean;
  history: RegistryHistory[];
  documents?: ParcelDocument[];
}

export interface SurveyAssignment {
  id: string;
  parcelId?: string;
  upi?: string;
  requestorName: string;
  requestorPhone: string;
  assignedSurveyorId: string;
  assignedSurveyorName: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  status: "Pending" | "Active" | "Completed" | "Approved";
  requestedDate: string;
  surveyDate?: string;
  geofenceRadius: number; // 100, 250, 500, 1000 meters
  measuredPolygon?: [number, number][];
  measuredArea?: number;
  surveyPhotos?: string[];
  voiceNotesCount: number;
  notes?: string;
  beaconsConfirmed: number;
}

export interface LandDispute {
  id: string;
  parcelId: string;
  upi: string;
  claimantName: string;
  claimantId: string;
  claimantPhone: string;
  disputeType: "Boundary Encroachment" | "Inheritance / Family Claim" | "Double Allocation" | "Land Use Breach";
  description: string;
  status: "Filed" | "Investigation" | "Hearing Scheduled" | "Resolved";
  filedDate: string;
  hearingDate?: string;
  assignedOfficer: string;
  evidenceDocs: { name: string; url: string }[];
  resolutionDetails?: string;
}

export interface LandApplication {
  id: string;
  type: "First Registration" | "Transfer" | "Subdivision" | "Leaseholder Change";
  upi?: string;
  applicantName: string;
  applicantId: string;
  status: "Draft" | "Pending Surveyor" | "Pending Notary" | "Pending District Approval" | "Approved" | "Rejected";
  submittedDate: string;
  targetBuyerName?: string;
  targetBuyerId?: string;
  transferPrice?: number;
  documents: { name: string; status: "Verified" | "Pending" }[];
  paymentStatus: "Unpaid" | "Paid";
  paymentReceipt?: string;
}

export interface NeighborNotification {
  id: string;
  surveyId: string;
  neighborUpi: string;
  neighborName: string;
  neighborPhone: string;
  distance: number; // meters
  status: "Sent" | "Delivered" | "Read" | "Confirmed" | "Dispute_Raised";
  response?: "Attending" | "Reschedule_Requested" | "Objecting";
  responseNotes?: string;
}

export interface IoTSensorFeed {
  id: string;
  type: "GNSS" | "Weather" | "Soil";
  name: string;
  status: "Online" | "Offline";
  reading: string;
  coordinates: [number, number];
}

export interface DroneMission {
  id: string;
  pilotName: string;
  flightArea: string;
  status: "Ready" | "Flying" | "Processing" | "Completed";
  progress: number;
  photoCount: number;
  orthophotoUrl?: string;
}

export interface GeoFenceEvent {
  id: string;
  surveyId: string;
  type: "entry" | "exit" | "breach" | "proximity_alert";
  message: string;
  timestamp: string;
  position: [number, number];
  distance?: number;
  acknowledged: boolean;
  severity: "info" | "warning" | "critical";
}

export interface EquipmentLog {
  id: string;
  timestamp: string;
  surveyorId: string;
  surveyorName: string;
  action: "Checked Out" | "Returned" | "Status Changed" | "Reported Issue";
  details: string;
}

export interface SurveyEquipment {
  id: string;
  name: string;
  category: "RTK GNSS Receiver" | "Total Station" | "Survey Drone" | "Handheld Laser Measurer" | "CORS Base Station";
  model: string;
  serialNumber: string;
  status: "Available" | "In Use" | "Maintenance" | "Retired";
  batteryLevel?: number; // percentage
  lastCalibrated: string; // date string
  calibrationDue?: string; // ISO date when next calibration is due
  location?: string; // physical location description
  coordinates?: [number, number]; // SVG coordinate for mini-map
  assignedSurveyorId?: string;
  assignedSurveyorName?: string;
  logs: EquipmentLog[];
}

