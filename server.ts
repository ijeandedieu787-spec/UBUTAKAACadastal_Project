/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import { INITIAL_PARCELS, INITIAL_SURVEYS, INITIAL_DISPUTES } from "./src/data/mockData.ts";
import { LandParcel, LandDispute, SurveyAssignment, ParcelStatus } from "./src/types.ts";

const app = express();
const PORT = 3000;

// Shared In-Memory Server State (Sources of Truth)
let parcels: LandParcel[] = [...INITIAL_PARCELS];
let disputes: LandDispute[] = [...INITIAL_DISPUTES];
let assignments: SurveyAssignment[] = [...INITIAL_SURVEYS];
let messages: Array<{
  id: string;
  text: string;
  senderName: string;
  senderRole: string;
  timestamp: string;
}> = [
  {
    id: "msg-init-1",
    text: "Welcome to the Ubutaka Smart Land Collaboration Space! Multiple users (surveyors, land officers) can collaborate, chat, view and edit parcel vectors, and track field surveyor GPS in real-time.",
    senderName: "LAIS System Bot",
    senderRole: "System Admin",
    timestamp: new Date().toLocaleTimeString()
  }
];

// User presence map: socketId -> user details
const presence = new Map<string, {
  socketId: string;
  userId: string;
  name: string;
  role: string;
  cursor?: { x: number; y: number; lat: number; lon: number };
  gps?: { lat: number; lon: number; x: number; y: number };
}>();

// JSON middleware
app.use(express.json());

// API route example (health check)
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    clientsConnected: presence.size,
    parcelsCount: parcels.length,
    disputesCount: disputes.length,
    assignmentsCount: assignments.length,
  });
});

// Create HTTP Server and bind Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.IO Connection Handler
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // 1. Join Collaboration Session
  socket.on("join-session", (user) => {
    presence.set(socket.id, {
      socketId: socket.id,
      userId: user.userId || socket.id,
      name: user.name || "Anonymous User",
      role: user.role || "Observer",
      cursor: { x: 0, y: 0, lat: 0, lon: 0 },
      gps: user.gps || undefined
    });

    socket.join("collaboration");

    // Send full current state of the database & active users to the newly connected user
    socket.emit("init-state", {
      parcels,
      disputes,
      assignments,
      messages,
      presence: Array.from(presence.values())
    });

    // Broadcast updated presence to other users
    io.to("collaboration").emit("presence-update", Array.from(presence.values()));
    
    // Auto system message
    const joinMsg = {
      id: `sys-${Math.random().toString(36).substring(2, 9)}`,
      text: `${user.name} (${user.role}) has joined the collaboration session.`,
      senderName: "System Notification",
      senderRole: "System Bot",
      timestamp: new Date().toLocaleTimeString()
    };
    messages.push(joinMsg);
    io.to("collaboration").emit("chat-message", joinMsg);
  });

  // 2. Real-time Cursor Movements on the GIS map
  socket.on("cursor-move", (coords) => {
    const user = presence.get(socket.id);
    if (user) {
      user.cursor = coords;
      socket.to("collaboration").emit("cursor-moved", {
        socketId: socket.id,
        userId: user.userId,
        name: user.name,
        role: user.role,
        ...coords
      });
    }
  });

  // 3. Real-time Surveyor GPS Tracking
  socket.on("update-gps", (gpsData) => {
    const user = presence.get(socket.id);
    if (user) {
      user.gps = gpsData;
      // Broadcast surveyor's updated GPS to all connected users
      io.to("collaboration").emit("surveyor-gps-updated", {
        socketId: socket.id,
        userId: user.userId,
        name: user.name,
        role: user.role,
        ...gpsData
      });
    }
  });

  // 4. Simultaneous Editing of Map Data (Parcels)
  socket.on("edit-parcel", (data: { parcel: LandParcel }) => {
    const idx = parcels.findIndex(p => p.id === data.parcel.id || p.upi === data.parcel.upi);
    if (idx !== -1) {
      parcels[idx] = data.parcel;
    } else {
      parcels.push(data.parcel);
    }
    
    // Broadcast updated parcels list to all users
    io.to("collaboration").emit("parcels-update", parcels);
  });

  // 5. Shared Land Disputes Registry State Sync
  socket.on("add-dispute", (data: { dispute: LandDispute }) => {
    disputes.unshift(data.dispute);

    // Automatically update corresponding parcel's status to Disputed
    const parcelIdx = parcels.findIndex(p => p.id === data.dispute.parcelId);
    if (parcelIdx !== -1) {
      const p = parcels[parcelIdx];
      const newHistory = {
        date: new Date().toISOString().split("T")[0],
        type: "Dispute Filed" as const,
        details: `Dispute Case ${data.dispute.id} registered by ${data.dispute.claimantName} (${data.dispute.disputeType}). Description: ${data.dispute.description}`,
        actor: "Legal System Autocommit"
      };
      parcels[parcelIdx] = {
        ...p,
        status: ParcelStatus.DISPUTED,
        history: [...p.history, newHistory]
      };
    }

    io.to("collaboration").emit("disputes-update", disputes);
    io.to("collaboration").emit("parcels-update", parcels);
  });

  // 6. Schedule Hearing & Arbitrate/Resolve Disputes
  socket.on("update-dispute", (data: {
    disputeId: string;
    status: LandDispute["status"];
    resolutionDetails?: string;
    hearingDate?: string;
    assignedOfficer?: string;
  }) => {
    const dIdx = disputes.findIndex(d => d.id === data.disputeId);
    if (dIdx !== -1) {
      const d = disputes[dIdx];
      disputes[dIdx] = {
        ...d,
        status: data.status,
        resolutionDetails: data.resolutionDetails !== undefined ? data.resolutionDetails : d.resolutionDetails,
        hearingDate: data.hearingDate !== undefined ? data.hearingDate : d.hearingDate,
        assignedOfficer: data.assignedOfficer !== undefined ? data.assignedOfficer : d.assignedOfficer
      };

      // If resolved, update corresponding parcel's status to APPROVED
      if (data.status === "Resolved" && data.resolutionDetails) {
        const parcelIdx = parcels.findIndex(p => p.id === d.parcelId);
        if (parcelIdx !== -1) {
          const p = parcels[parcelIdx];
          const resolutionHistory = {
            date: new Date().toISOString().split("T")[0],
            type: "Dispute Resolved" as const,
            details: `Land Dispute resolved. Decree: "${data.resolutionDetails}"`,
            actor: data.assignedOfficer || "Tribunal Gavel"
          };
          parcels[parcelIdx] = {
            ...p,
            status: ParcelStatus.APPROVED,
            history: [...p.history, resolutionHistory]
          };
        }
      }

      io.to("collaboration").emit("disputes-update", disputes);
      io.to("collaboration").emit("parcels-update", parcels);
    }
  });

  // 7. Instant Chat Functionality
  socket.on("chat-message", (msg) => {
    const fullMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      text: msg.text,
      senderName: msg.senderName,
      senderRole: msg.senderRole,
      timestamp: new Date().toLocaleTimeString()
    };
    messages.push(fullMsg);
    if (messages.length > 100) {
      messages.shift();
    }
    io.to("collaboration").emit("chat-message", fullMsg);
  });

  // 8. Handle Disconnection
  socket.on("disconnect", () => {
    const user = presence.get(socket.id);
    if (user) {
      presence.delete(socket.id);
      io.to("collaboration").emit("presence-update", Array.from(presence.values()));
      
      const leaveMsg = {
        id: `sys-${Math.random().toString(36).substring(2, 9)}`,
        text: `${user.name} (${user.role}) has disconnected.`,
        senderName: "System Notification",
        senderRole: "System Bot",
        timestamp: new Date().toLocaleTimeString()
      };
      messages.push(leaveMsg);
      io.to("collaboration").emit("chat-message", leaveMsg);
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Setup Vite Dev Middleware vs Static Production files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`LAIS Server running at http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer();
